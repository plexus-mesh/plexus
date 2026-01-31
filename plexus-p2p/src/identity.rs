use anyhow::{Context, Result};
use libp2p::identity::Keypair;
use plexus_core::CoreError;
use std::fs;
use std::path::PathBuf;
use tracing::info;

pub struct IdentityStore {
    path: PathBuf,
}

impl IdentityStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn load_or_generate(&self) -> Result<Keypair> {
        if self.path.exists() {
            info!("Loading identity from {:?}", self.path);
            let bytes = fs::read(&self.path).context("Failed to read identity file")?;
            let keypair = Keypair::from_protobuf_encoding(&bytes)
                .map_err(|e| CoreError::Unknown(e.to_string()))?;
            Ok(keypair)
        } else {
            info!("Generating new identity at {:?}", self.path);
            let keypair = Keypair::generate_ed25519();
            let bytes = keypair
                .to_protobuf_encoding()
                .map_err(|e| CoreError::Unknown(e.to_string()))?;

            if let Some(parent) = self.path.parent() {
                fs::create_dir_all(parent)?;
            }

            // Security Hardening: Set file permissions to 0600 (User Read/Write ONLY)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                // Create file first to set permissions
                let file =
                    fs::File::create(&self.path).context("Failed to create identity file")?;
                let mut perms = file.metadata()?.permissions();
                perms.set_mode(0o600);
                file.set_permissions(perms)?;
            }

            fs::write(&self.path, bytes).context("Failed to write identity file")?;
            Ok(keypair)
        }
    }
}
