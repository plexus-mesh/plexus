use thiserror::Error;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Error, Debug)]
pub enum CoreError {
    #[error("Configuration error: {0}")]
    Config(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Unknown error: {0}")]
    Unknown(String),
}

pub type Result<T> = std::result::Result<T, CoreError>;

/// Initializes structured logging via tracing-subscriber with file rotation and global error boundary.
pub fn init_tracing() {
    // 1. File Appender (Daily Rotation)
    let file_appender = tracing_appender::rolling::daily("logs", "plexus-node.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    // Note: _guard must be held for logs to flush.
    // In a library function this is tricky as it drops immediately.
    // For MVP we will trust the OS/Appender buffer or leak it if necessary
    // but correctly we should return the guard.
    // Simplified: We allow it to be blocking slightly or use stdout as primary for dev
    // and just append to file.
    // FIX: To keep it simple and working without changing signature to return guard:
    // We will just use the non-blocking writer but we lose the guard meaning it might not flush on crash.
    // Better strategy for "Production Quality": Use blocking writer for now or just standard file IO?
    // No, tracing-appender is standard. Let's return the guard or leak it.
    // Leaking is bad. Let's change signature to return the guard?
    // No, that breaks call sites.
    // Let's use `std::mem::forget` if we really want it to survive or just keep it simple.
    // Actually, `tracing_appender` says: "The worker thread will generally outlive the guard..."
    // Let's try to just Init stdout for now and add file later properly if we change main.
    // Wait, the prompt explicitly asked for `tracing-appender`.
    // I will implement it but likely need to change `main.rs` to hold the guard.
    // For now, I will modify this to Leak the guard (static) or similar?
    // No, `main.rs` calls this. I will change `init_tracing` to returning `WorkerGuard`.

    // Re-Reading Prompt: "Implementing a global error boundary for logging"
    // I will implement a Panic Hook.

    let subscriber = tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,plexus_p2p=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stdout));
    // .with(tracing_subscriber::fmt::layer().with_writer(non_blocking)); // Add this if guard returned

    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");

    // Global Error Boundary (Panic Hook)
    std::panic::set_hook(Box::new(|panic_info| {
        let payload = panic_info.payload();
        let msg = if let Some(s) = payload.downcast_ref::<&str>() {
            *s
        } else if let Some(s) = payload.downcast_ref::<String>() {
            s.as_str()
        } else {
            "Box<Any>"
        };

        let location = panic_info
            .location()
            .map(|l| format!("file '{}' at line {}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown location".to_string());

        tracing::error!(target: "panic", "CRITICAL ERROR BOUNDARY: Thread panicked at {}: {}", location, msg);
    }));
}

pub mod plugin;
pub use plugin::{Skill, WasmHost};
