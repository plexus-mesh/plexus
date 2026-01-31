use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tokio::sync::mpsc;
use tracing::{error, info};

pub struct Microphone {
    stream: Option<cpal::Stream>,
    is_recording: bool,
    sender: mpsc::Sender<Vec<f32>>,
}

impl Microphone {
    pub fn new(sender: mpsc::Sender<Vec<f32>>) -> Self {
        Self {
            stream: None,
            is_recording: false,
            sender,
        }
    }

    pub fn start(&mut self) -> anyhow::Result<()> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| anyhow::anyhow!("No input device"))?;

        // We want a config that supports f32
        let config = device.default_input_config()?;
        let sample_rate = config.sample_rate();
        info!(
            "Input device: {}, Sample Rate: {}",
            device.name()?,
            sample_rate.0
        );

        let err_fn = |err| error!("an error occurred on stream: {}", err);
        let sender = self.sender.clone();

        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &_| {
                    // Send data
                    // For now, we just clone and send. In prod, use a ringbuffer or similar to avoid alloc on callback
                    // But for MVP, let's just push.
                    // Note: This is on audio thread, so sending on async channel might block or be bad.
                    // Better to use a non-blocking way or a dedicated transfer thread.
                    // Tokios `try_send` is non-blocking.
                    if let Err(_e) = sender.try_send(data.to_vec()) {
                        // Buffer full or channel closed
                    }
                },
                err_fn,
                None, // None=blocking, usually fine for cpal on desktop
            )?,
            _ => return Err(anyhow::anyhow!("Unsupported sample format, need F32")),
        };

        stream.play()?;
        self.stream = Some(stream);
        self.is_recording = true;
        info!("Microphone started");
        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(stream) = self.stream.take() {
            let _ = stream.pause(); // or drop
        }
        self.is_recording = false;
        info!("Microphone stopped");
    }
}
