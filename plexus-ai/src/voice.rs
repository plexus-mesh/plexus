use anyhow::{Error, Result};
use candle_core::{Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::whisper::{audio, model::Whisper as Model, Config};
use hf_hub::{api::tokio::Api, Repo, RepoType};
use std::sync::{Arc, Mutex};
use tokenizers::Tokenizer;
use tracing::info;

// Stub removed. Using aliased import.

pub struct WhisperEngine {
    model: Option<Arc<Mutex<Model>>>,
    tokenizer: Option<Tokenizer>,
    device: Device,
    config: Option<Config>,
    _mel_filters: Vec<f32>,
}

impl WhisperEngine {
    pub fn new() -> Self {
        let device = Device::new_metal(0).unwrap_or(Device::Cpu);
        Self {
            model: None,
            tokenizer: None,
            device,
            config: None,
            _mel_filters: vec![],
        }
    }

    pub async fn load_model(&mut self) -> Result<()> {
        let api = Api::new()?;
        let repo = api.repo(Repo::with_revision(
            "openai/whisper-tiny".to_string(),
            RepoType::Model,
            "main".to_string(),
        ));

        let config_filename = repo.get("config.json").await?;
        let tokenizer_filename = repo.get("tokenizer.json").await?;
        let weights_filename = repo.get("model.safetensors").await?;

        let config: Config = serde_json::from_str(&std::fs::read_to_string(config_filename)?)?;
        let tokenizer = Tokenizer::from_file(tokenizer_filename).map_err(Error::msg)?;

        // Load Mel Filters (simplified, in reality we need to load or compute them)
        // Usually these are in the model assets or computed.
        // For MVP, we'll assume we can use a crate or omit this step for now if we can't find it.
        // Actually, let's try to see if config has it.
        // self.mel_filters = config.mel_filters.clone(); // hypothetical

        let vb = unsafe {
            VarBuilder::from_mmaped_safetensors(
                &[weights_filename],
                candle_core::DType::F32,
                &self.device,
            )?
        };
        let model = Model::load(&vb, config.clone())?;

        self.model = Some(Arc::new(Mutex::new(model)));
        self.tokenizer = Some(tokenizer);
        self.config = Some(config);

        info!("Whisper model loaded successfully");
        Ok(())
    }

    pub async fn transcribe(&self, pcm_data: Vec<f32>) -> Result<String> {
        if self.model.is_none() {
            return Err(anyhow::anyhow!("Model not loaded"));
        }
        let model_arc = self.model.as_ref().unwrap();
        let mut model = model_arc.lock().unwrap();
        let tokenizer = self.tokenizer.as_ref().unwrap();
        let config = self.config.as_ref().unwrap();

        // 1. Preprocess Audio
        // Assumes pcm_data is 16kHz
        let mel = audio::pcm_to_mel(config, &pcm_data, &self._mel_filters); // Removed ?
        let mel_len = mel.len();
        let mel_tensor = Tensor::from_vec(mel, (1, 80, mel_len / 80), &self.device)?; // 80 bins

        // 2. Encode
        let audio_features = model.encoder.forward(&mel_tensor, true)?;

        // 3. Decode (Greedy)
        // SOT: <|startoftranscript|> (50258), <|en|> (50259), <|transcribe|> (50359), <|notimestamps|> (50363)
        // We can look these up dynamically or hardcode for MVP if tokenizer allows.
        // TinyLlama tokenizer might be different than Whisper tokenizer?
        // Whisper uses a specific tokenizer.
        // We loaded `openai/whisper-tiny` tokenizer.json, so lookups should work.

        let sot_token = tokenizer
            .token_to_id("<|startoftranscript|>")
            .unwrap_or(50258);
        let trans_token = tokenizer.token_to_id("<|transcribe|>").unwrap_or(50359);
        let notime_token = tokenizer.token_to_id("<|notimestamps|>").unwrap_or(50363);
        // We default to English usually, but let's just start with SOT

        let mut tokens = vec![sot_token, trans_token, notime_token];
        let mut generated_text = String::new();

        for _ in 0..100 {
            let input = Tensor::new(&tokens[..], &self.device)?.unsqueeze(0)?;
            let logits = model.decoder.forward(&input, &audio_features, true)?;
            let logits = logits.squeeze(0)?;
            let logits = logits.get(logits.dim(0)? - 1)?;

            let next_token = logits.argmax(0)?.to_scalar::<u32>()?;
            tokens.push(next_token);

            let token_str = tokenizer.decode(&[next_token], true).unwrap_or_default();
            generated_text.push_str(&token_str);

            if next_token == 50257 {
                // <|endoftext|>
                break;
            }
        }

        Ok(generated_text)
    }
}
