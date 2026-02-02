use libp2p::{
    futures::StreamExt,
    kad::{Quorum, Record, RecordKey},
    swarm::SwarmEvent,
    Multiaddr, PeerId, Swarm,
};
use plexus_p2p::{build_swarm, IdentityStore, PlexusBehaviour};
use std::time::Duration;
use tokio::select;

async fn create_node(name: &str) -> (Swarm<PlexusBehaviour>, PeerId) {
    let id_store = IdentityStore::new(std::env::temp_dir().join(format!("{}.key", name)));
    let kp = id_store.load_or_generate().unwrap();
    let peer_id = kp.public().to_peer_id();
    let mut swarm = build_swarm(kp).await.unwrap();
    swarm
        .behaviour_mut()
        .kademlia
        .set_mode(Some(libp2p::kad::Mode::Server));
    (swarm, peer_id)
}

#[tokio::test]
async fn test_dht_partition_and_sync() {
    // 1. Setup Mesh: Alice, Bob, Carol
    let (mut alice, alice_id) = create_node("alice_test").await;
    let (mut bob, bob_id) = create_node("bob_test").await;
    let (mut carol, carol_id) = create_node("carol_test").await;

    // Listen
    let listen_addr: Multiaddr = "/ip4/127.0.0.1/tcp/0".parse().unwrap();
    alice.listen_on(listen_addr.clone()).unwrap();
    bob.listen_on(listen_addr.clone()).unwrap();
    carol.listen_on(listen_addr.clone()).unwrap();

    // Shared State to track addresses
    let mut alice_addr: Option<Multiaddr> = None;
    let mut bob_addr: Option<Multiaddr> = None;
    let mut carol_addr: Option<Multiaddr> = None;

    // Track test phases
    let mut phase = 0;
    // 0: Init, 1: Connecting, 2: Put Record (Alice), 3: Partition Bob, 4: Reconnect Bob, 5: Get Record (Bob)

    let key = RecordKey::new(&b"consensus_state".to_vec());
    let value = b"valid_block_hash_v1".to_vec();

    // Max duration for test
    let start = std::time::Instant::now();

    loop {
        if start.elapsed() > Duration::from_secs(30) {
            panic!("Test timed out");
        }

        select! {
            event = alice.select_next_some() => {
                match event {
                    SwarmEvent::NewListenAddr { address, .. } => {
                        alice_addr = Some(address);
                    }
                    SwarmEvent::Behaviour(plexus_p2p::swarm::PlexusBehaviourEvent::Kademlia(event)) => {
                        match event {
                            libp2p::kad::Event::OutboundQueryProgressed { result, .. } => {
                                match result {
                                    libp2p::kad::QueryResult::PutRecord(Ok(_)) => {
                                        println!("Alice PUT record successfully.");
                                        phase = 3;
                                    }
                                    libp2p::kad::QueryResult::PutRecord(Err(e)) => {
                                        println!("Alice PUT failed: {:?}. Retrying...", e);
                                        phase = 2; // Retry
                                    }
                                    libp2p::kad::QueryResult::Bootstrap(Ok(_)) => {
                                         println!("Alice Bootstrap successful! Starting PUT...");
                                         phase = 2; // Signal logic to put record

                                         // Alice PUTs data immediately
                                         let record = libp2p::kad::Record {
                                            key: libp2p::kad::RecordKey::new(&b"consensus_state".to_vec()),
                                            value: b"valid_block_hash_v1".to_vec(),
                                            publisher: None,
                                            expires: None,
                                        };
                                        // Workaround: Set a flag `ready_to_put = true` and handle it in the timeout/tick loop or check `phase` at top of loop.
                                    }
                                    _ => {}
                                }
                            }
                            _ => {
                                // println!("Alice Kademlia Event: {:?}", event);
                            }
                        }
                    }
                    _ => {}
                }
            }
            event = bob.select_next_some() => {
                match event {
                    SwarmEvent::NewListenAddr { address, .. } => {
                        bob_addr = Some(address);
                    }
                    SwarmEvent::Behaviour(plexus_p2p::swarm::PlexusBehaviourEvent::Kademlia(event)) => {
                        match event {
                            libp2p::kad::Event::OutboundQueryProgressed { result, .. } => {
                                match result {
                                    libp2p::kad::QueryResult::GetRecord(Ok(libp2p::kad::GetRecordOk::FoundRecord(peer_record))) => {
                                         if peer_record.record.value == value {
                                             println!("Bob successfully retrieved the record from DHT!");
                                             return; // TEST PASSED
                                         } else {
                                             println!("Bob found record but value mismatch");
                                         }
                                    }
                                    libp2p::kad::QueryResult::GetRecord(Err(e)) => {
                                        println!("Bob GET failed: {:?}", e);
                                    }
                                    _ => { println!("Bob Query Result: {:?}", result); }
                                }
                            }
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            event = carol.select_next_some() => {
                match event {
                    SwarmEvent::NewListenAddr { address, .. } => {
                        carol_addr = Some(address);
                    }
                    _ => {}
                }
            }
            // Control Logic Loop
            _ = tokio::time::sleep(Duration::from_millis(100)) => {
                match phase {
                    0 => {
                        // Phase 0: Wait for addresses
                        if alice_addr.is_some() && bob_addr.is_some() && carol_addr.is_some() {
                            println!("All nodes listening. Connecting...");
                            phase = 1;
                        }
                    }
                    1 => {
                        // Phase 1: Connect and Bootstrap
                        if let Some(addr) = bob_addr.clone() {
                            alice.dial(addr.clone()).unwrap();
                            alice.behaviour_mut().kademlia.add_address(&bob_id, addr);
                        }
                        if let Some(addr) = carol_addr.clone() {
                            alice.dial(addr.clone()).unwrap();
                            alice.behaviour_mut().kademlia.add_address(&carol_id, addr);
                        }

                        if let Some(addr) = alice_addr.clone() {
                            bob.dial(addr.clone()).unwrap();
                            bob.behaviour_mut().kademlia.add_address(&alice_id, addr);
                        }
                        if let Some(addr) = carol_addr.clone() {
                            bob.dial(addr.clone()).unwrap();
                            bob.behaviour_mut().kademlia.add_address(&carol_id, addr);
                        }

                        if let Some(addr) = alice_addr.clone() {
                            carol.dial(addr.clone()).unwrap();
                            carol.behaviour_mut().kademlia.add_address(&alice_id, addr);
                        }
                         if let Some(addr) = bob_addr.clone() {
                            carol.dial(addr.clone()).unwrap();
                            carol.behaviour_mut().kademlia.add_address(&bob_id, addr);
                        }

                        println!("Nodes dialed. Bootstrapping Kademlia...");
                        alice.behaviour_mut().kademlia.bootstrap().ok();
                        bob.behaviour_mut().kademlia.bootstrap().ok();
                        carol.behaviour_mut().kademlia.bootstrap().ok();

                        phase = 11; // Wait for functionality check (Bootstrap Success)
                    }
                    11 => {
                        // Waiting for bootstrap... (Handled in event loop)
                    }
                    2 => {
                        // Alice executes PUT (Triggered by Bootstrap success flag)
                        println!("Executing Alice PUT...");
                        let record = Record {
                           key: key.clone(),
                           value: value.clone(),
                           publisher: None,
                           expires: None,
                       };
                       alice.behaviour_mut().kademlia.put_record(record, Quorum::One).unwrap();
                       phase = 22; // Waiting for Put Success
                    }
                    3 => {
                         // PARTITION: Simulate Bob going offline
                         println!("Simulating Partition: Disconnecting Bob from Alice...");
                         let _ = bob.disconnect_peer_id(alice_id);
                         let _ = bob.disconnect_peer_id(carol_id); // Bob isolates himself

                         tokio::time::sleep(Duration::from_secs(1)).await;
                         phase = 4;
                    }
                    4 => {
                         println!("Reconnecting Bob...");
                         if let Some(addr) = alice_addr.clone() { bob.dial(addr).unwrap(); }
                         if let Some(addr) = carol_addr.clone() { bob.dial(addr).unwrap(); }

                         tokio::time::sleep(Duration::from_secs(2)).await;

                         println!("Bob requesting record...");
                         bob.behaviour_mut().kademlia.get_record(key.clone());
                         phase = 5; // Waiting for Bob's GetRecord event
                    }
                    _ => {}
                }
            }
        }
    }
}
