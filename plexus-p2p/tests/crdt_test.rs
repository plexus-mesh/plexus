use plexus_p2p::crdt::MeshState;
use plexus_p2p::protocol::{Heartbeat, NodeCapabilities};
use proptest::prelude::*;

// Strategy to generate random Heartbeats
fn heartbeat_strategy() -> impl Strategy<Value = Heartbeat> {
    (
        "[a-z0-9]{10}", // peer_id
        "[a-z0-9]{5}",  // model
        any::<u64>(),   // timestamp
        any::<usize>(), // cpu_cores
        any::<u64>(),   // total_memory
    )
        .prop_map(
            |(peer_id, model, timestamp, cpu_cores, total_memory)| Heartbeat {
                peer_id,
                model,
                timestamp,
                capabilities: NodeCapabilities {
                    cpu_cores,
                    total_memory,
                    gpu_info: None,
                    model_loaded: true,
                },
            },
        )
}

// Strategy to generate random MeshStates
fn mesh_state_strategy() -> impl Strategy<Value = MeshState> {
    proptest::collection::vec(heartbeat_strategy(), 0..10).prop_map(|heartbeats| {
        let mut state = MeshState::new();
        for hb in heartbeats {
            state.update(hb);
        }
        state
    })
}

proptest! {
    #[test]
    fn test_merge_associativity(
        a in mesh_state_strategy(),
        b in mesh_state_strategy(),
        c in mesh_state_strategy()
    ) {
        // (A + B) + C == A + (B + C)

        // Left side
        let mut ab = a.clone();
        ab.merge(b.clone());
        let mut abc = ab.clone();
        abc.merge(c.clone());

        // Right side
        let mut bc = b.clone();
        bc.merge(c.clone());
        let mut a_bc = a.clone();
        a_bc.merge(bc.clone());

        // Assert equality by comparing the internal maps
        // Note: HashMaps order doesn't matter, but we need meaningful equality check.
        // Derived Debug on Heartbeat might not be enough if we want strict equality of contents.
        // We compare expected peers.

        assert_eq!(abc.peers.len(), a_bc.peers.len());
        for (k, v) in &abc.peers {
            assert!(a_bc.peers.contains_key(k));
            let other_v = a_bc.peers.get(k).unwrap();
            assert_eq!(v.timestamp, other_v.timestamp);
            assert_eq!(v.peer_id, other_v.peer_id); // Basic check
        }
    }

    #[test]
    fn test_merge_commutativity(
        a in mesh_state_strategy(),
        b in mesh_state_strategy()
    ) {
        // A + B == B + A

        let mut ab = a.clone();
        ab.merge(b.clone());

        let mut ba = b.clone();
        ba.merge(a.clone());

        assert_eq!(ab.peers.len(), ba.peers.len());
        for (k, v) in &ab.peers {
             assert!(ba.peers.contains_key(k));
             let other_v = ba.peers.get(k).unwrap();
             assert_eq!(v.timestamp, other_v.timestamp);
        }
    }

    #[test]
    fn test_merge_idempotency(
        a in mesh_state_strategy()
    ) {
        // A + A == A
        let mut aa = a.clone();
        aa.merge(a.clone());

        assert_eq!(aa.peers.len(), a.peers.len());
        for (k, v) in &aa.peers {
            let other_v = a.peers.get(k).unwrap();
            assert_eq!(v.timestamp, other_v.timestamp);
        }
    }
}
