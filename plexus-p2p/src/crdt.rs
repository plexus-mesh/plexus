use crate::protocol::Heartbeat;
use std::collections::HashMap;

/// MeshState uses a Last-Write-Wins (LWW) element set strategy
/// to track the state of peers in the mesh.
///
/// Properties:
/// - Commutative: merge(A, B) == merge(B, A)
/// - Associative: merge(merge(A, B), C) == merge(A, merge(B, C))
/// - Idempotent: merge(A, A) == A
/// MeshState backed by Sled (persistent embedded DB).
/// Implements Last-Write-Wins (LWW) strategy via timestamp checking.
#[derive(Debug, Clone)]
pub struct MeshState {
    db: sled::Db,
}

impl MeshState {
    /// Opens or creates the mesh state database at the specified path.
    pub fn new(path: std::path::PathBuf) -> anyhow::Result<Self> {
        let db = sled::open(path)?;
        Ok(Self { db })
    }

    /// Updates the state with a new heartbeat using LWW rule.
    pub fn update(&self, heartbeat: Heartbeat) -> anyhow::Result<()> {
        let key = heartbeat.peer_id.as_bytes();
        let new_val = serde_json::to_vec(&heartbeat)?;

        // Transactional LWW check
        self.db.transaction::<_, _, sled::Error>(|tx_db| {
            if let Some(existing_bytes) = tx_db.get(key)? {
                if let Ok(existing) = serde_json::from_slice::<Heartbeat>(&existing_bytes) {
                    // LWW: Only update if new timestamp is greater
                    if heartbeat.timestamp <= existing.timestamp {
                        return Ok(());
                    }
                }
            }
            tx_db.insert(key, new_val.clone())?;
            Ok(())
        })?;

        Ok(())
    }

    /// Merges another list of heartbeats into this state.
    /// Note: true "merge" of two DBs assumes we just process the incoming list.
    pub fn merge(&self, other_heartbeats: Vec<Heartbeat>) -> anyhow::Result<()> {
        for hb in other_heartbeats {
            self.update(hb)?;
        }
        Ok(())
    }

    /// Returns all known peers as a vector.
    pub fn get_all(&self) -> Vec<Heartbeat> {
        self.db
            .iter()
            .filter_map(|res| {
                if let Ok((_, val)) = res {
                    serde_json::from_slice::<Heartbeat>(&val).ok()
                } else {
                    None
                }
            })
            .collect()
    }
}
