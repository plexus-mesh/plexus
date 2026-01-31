use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Role {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: Role,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatHistory {
    messages: VecDeque<ChatMessage>,
    max_history: usize,
}

impl ChatHistory {
    pub fn new(max_history: usize) -> Self {
        Self {
            messages: VecDeque::new(),
            max_history,
        }
    }

    pub fn add_user(&mut self, content: String) {
        self.push(ChatMessage {
            role: Role::User,
            content,
        });
    }

    pub fn add_assistant(&mut self, content: String) {
        self.push(ChatMessage {
            role: Role::Assistant,
            content,
        });
    }

    pub fn add_system(&mut self, content: String) {
        self.push(ChatMessage {
            role: Role::System,
            content,
        });
    }

    fn push(&mut self, message: ChatMessage) {
        if self.messages.len() >= self.max_history {
            self.messages.pop_front();
        }
        self.messages.push_back(message);
    }

    pub fn get_history(&self) -> Vec<ChatMessage> {
        self.messages.iter().cloned().collect()
    }

    pub fn clear(&mut self) {
        self.messages.clear();
    }

    pub fn format_for_llama(&self) -> String {
        let mut formatted = String::new();
        for msg in &self.messages {
            match msg.role {
                Role::User => {
                    formatted.push_str(&format!("<|user|>\n{}</s>\n", msg.content));
                }
                Role::Assistant => {
                    formatted.push_str(&format!("<|assistant|>\n{}</s>\n", msg.content));
                }
                Role::System => {
                    formatted.push_str(&format!("<|system|>\n{}</s>\n", msg.content));
                }
            }
        }
        // Prepare for next assistant response
        formatted.push_str("<|assistant|>\n");
        formatted
    }

    pub fn load_from_file(path: &std::path::Path) -> anyhow::Result<Self> {
        if path.exists() {
            let file = std::fs::File::open(path)?;
            let history: ChatHistory = serde_json::from_reader(file)?;
            Ok(history)
        } else {
            Ok(Self::new(10))
        }
    }

    pub fn save_to_file(&self, path: &std::path::Path) -> anyhow::Result<()> {
        let file = std::fs::File::create(path)?;
        serde_json::to_writer_pretty(file, self)?;
        Ok(())
    }
}
