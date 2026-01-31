use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateRequest {
    pub prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct NodeCapabilities {
    pub cpu_cores: usize,
    pub total_memory: u64, // Bytes
    pub gpu_info: Option<String>,
    pub model_loaded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Heartbeat {
    pub peer_id: String,
    pub model: String, // Active model (e.g. tinyllama)
    pub capabilities: NodeCapabilities,
    pub timestamp: u64, // Unix timestamp for LWW
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateResponse {
    pub response: String,
}
