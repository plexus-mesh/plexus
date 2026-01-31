use crate::{GenerateRequest, GenerateResponse};
use anyhow::Result;
use libp2p::{
    core::Transport,
    gossipsub,
    identity::Keypair,
    kad, mdns,
    multiaddr::Protocol,
    noise,
    request_response::{self, cbor, ProtocolSupport},
    swarm::NetworkBehaviour,
    tcp, yamux, StreamProtocol, Swarm,
};
use std::time::Duration;

#[derive(NetworkBehaviour)]
pub struct PlexusBehaviour {
    pub gossipsub: gossipsub::Behaviour,
    pub kademlia: kad::Behaviour<kad::store::MemoryStore>,
    pub mdns: mdns::tokio::Behaviour,
    pub request_response: cbor::Behaviour<GenerateRequest, GenerateResponse>,
    pub dcutr: libp2p::dcutr::Behaviour,
    pub relay: libp2p::relay::client::Behaviour,
}

pub async fn build_swarm(keypair: Keypair) -> Result<Swarm<PlexusBehaviour>> {
    let peer_id = keypair.public().to_peer_id();

    // Gossipsub config
    let gossipsub_config = gossipsub::ConfigBuilder::default()
        .heartbeat_interval(Duration::from_secs(10))
        .validation_mode(gossipsub::ValidationMode::Strict)
        .build()
        .map_err(|e| anyhow::anyhow!(e))?;

    let gossipsub = gossipsub::Behaviour::new(
        gossipsub::MessageAuthenticity::Signed(keypair.clone()),
        gossipsub_config,
    )
    .map_err(|e| anyhow::anyhow!(e))?;

    // Kademlia config
    let kademlia_store = kad::store::MemoryStore::new(peer_id);
    let kademlia = kad::Behaviour::new(peer_id, kademlia_store);

    // mDNS config
    let mdns = mdns::tokio::Behaviour::new(mdns::Config::default(), keypair.public().to_peer_id())?;

    // Request-Response config
    let mut rr_config = request_response::Config::default();
    rr_config.set_request_timeout(Duration::from_secs(300)); // 5 minutes for slow CPU inference

    let request_response = cbor::Behaviour::new(
        [(
            StreamProtocol::new("/plexus/compute/1.0.0"),
            ProtocolSupport::Full,
        )],
        rr_config,
    );

    // Hole Punching (DCUTR)
    let dcutr = libp2p::dcutr::Behaviour::new(peer_id);

    // Relay Client (for hole punching)
    // Note: In a real prod scenario we need a Relay server.
    // For now we add the client behaviour so nodes can use public relays.
    // Relay Client
    let (relay_transport, relay_behaviour) = libp2p::relay::client::new(peer_id);

    let transport = relay_transport
        .upgrade(libp2p::core::upgrade::Version::V1)
        .authenticate(noise::Config::new(&keypair).expect("Signing Keypair is valid"))
        .multiplex(yamux::Config::default());

    let behaviour = PlexusBehaviour {
        gossipsub,
        kademlia,
        mdns,
        request_response,
        dcutr,
        relay: relay_behaviour,
    };

    let swarm = libp2p::SwarmBuilder::with_existing_identity(keypair)
        .with_tokio()
        .with_tcp(
            tcp::Config::default(),
            noise::Config::new,
            yamux::Config::default,
        )?
        .with_quic() // QUIC is often better for hole punching
        .with_other_transport(|_key| transport)?
        .with_dns()?
        .with_behaviour(|_key| behaviour)?
        .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
        .build();

    Ok(swarm)
}
