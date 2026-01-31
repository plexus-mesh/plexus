use anyhow::{Context, Result};
use clap::Parser;
use plexus_p2p::{NodeCommand, NodeService};
use std::path::PathBuf;
use tokio::sync::mpsc;
use tracing::{error, info};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Name of the model to use (e.g., tinyllama, phi)
    #[arg(short, long, default_value = "tinyllama")]
    model: String,

    /// Custom data directory (for running multiple nodes)
    #[arg(long)]
    data_dir: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<()> {
    plexus_core::init_tracing();

    let args = Args::parse();

    info!("Starting Plexus Peer Node (Second Node)...");
    info!("Selected Model: {}", args.model);

    // Use a distinct identity for the second peer
    let identity_path = if let Some(ref dir) = args.data_dir {
        std::fs::create_dir_all(dir)?;
        dir.join("peer_identity.key")
    } else {
        PathBuf::from("peer_identity.key")
    };

    info!("Using identity file: {:?}", identity_path);

    let (tx, rx) = mpsc::channel(32);

    info!("Initializing Peer NodeService...");
    let service = NodeService::new(identity_path, rx, args.model, vec![], args.data_dir)
        .await
        .context("Failed to init service")?;
    info!("Peer NodeService initialized. Listening for main node...");

    // Spawn service in background or run it?
    // Run it directly since this is the main process.
    tokio::select! {
        res = service.run() => {
            if let Err(e) = res {
                error!("Node service crashed: {}", e);
            }
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Received Ctrl+C, shutting down...");
            let _ = tx.send(NodeCommand::Shutdown).await;
        }
    }

    Ok(())
}
