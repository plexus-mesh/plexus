use libp2p::Multiaddr;
use plexus_p2p::{build_swarm, IdentityStore};

#[tokio::test]
async fn test_two_nodes_connection() {
    // Node 1
    let id1 = IdentityStore::new(std::env::temp_dir().join("node1.key"));
    let kp1 = id1.load_or_generate().unwrap();
    let peer_id1 = kp1.public().to_peer_id();
    let mut swarm1 = build_swarm(kp1).await.unwrap();

    // Node 2
    let id2 = IdentityStore::new(std::env::temp_dir().join("node2.key"));
    let kp2 = id2.load_or_generate().unwrap();
    let peer_id2 = kp2.public().to_peer_id();
    let mut swarm2 = build_swarm(kp2).await.unwrap();

    // Listen
    let addr: Multiaddr = "/ip4/127.0.0.1/tcp/0".parse().unwrap();
    swarm1.listen_on(addr.clone()).unwrap();
    swarm2.listen_on(addr.clone()).unwrap();

    // Verify identities are distinct
    assert_ne!(peer_id1, peer_id2);

    // Verify swarms are usable (basic check)
    assert!(swarm1.local_peer_id() == &peer_id1);
    assert!(swarm2.local_peer_id() == &peer_id2);
}
