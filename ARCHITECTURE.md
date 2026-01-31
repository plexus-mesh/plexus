# 🏗️ Plexus Mesh Architecture

This document provides a high-level overview of the Plexus Mesh system architecture, designed for maximum sovereignty, performance, and decentralization.

## 🧩 System Layers

The application is structured as a Monorepo with four primary crates:

### 1. `plexus-ui` (The Interface)

- **Tech**: Tauri v2, React, TypeScript, TailwindCSS.
- **Role**: User interaction, visualization (Neural Pulse, Mesh Map).
- **Communication**: Talks to the Rust backend via Tauri IPC (`command` pattern).

### 2. `plexus-node` / `plexus-gateway` (The Runtime)

- **Tech**: Rust, Tokio.
- **Role**: The binary entry point. It initializes the Service Layer, loads configuration, and manages the lifecycle of the P2P swarm and AI engine.

### 3. `plexus-p2p` (The Network)

- **Tech**: `libp2p` (Swarm, Gossipsub, Kademlia, Noise, Yamux).
- **Role**:
  - **Discovery**: Finds peers via mDNS (local) and Kademlia DHT (global).
  - **Transport**: Encrypted (Noise), Multiplexed (Yamux), NAT-traversal enabled (DCUTR/Relay).
  - **State**: Maintains the `MeshState` using CRDTs (Last-Write-Wins) backed by `sled` database.

### 4. `plexus-ai` (The Brain)

- **Tech**: `candle` (HuggingFace), `tokenizers`.
- **Role**:
  - **Inference**: Runs quantized LLMs (e.g., TinyLlama, Phi) on CPU/Metal/CUDA.
  - **Verification**: Enforces SHA256 integrity checks on loaded models.
  - **Memory**: Vector database (`qdrant` / embedded) for RAG.

### 5. `plexus-gateway` (The Bridge)

- **Tech**: Rust, Axum, Tokio.
- **Role**:
  - **HTTP API**: Exposes OpenAI-compatible endpoints (e.g., `/v1/chat/completions`).
  - **Integration**: Allows external tools and agents to connect to the mesh network.
  - **WebSocket**: Real-time event streaming for mesh status updates.

## 🔄 Data Flow

1.  **User Input** -> `plexus-ui` -> IPC -> `plexus-node`.
2.  **Node Logic**:
    - If **Local Generation**: `plexus-node` -> `plexus-ai` -> Inference -> Stream back to UI.
    - If **Remote Request**: `plexus-node` -> `plexus-p2p` -> `libp2p Request/Response` -> Peer Node.
3.  **Peer Node**: Receives Request -> `plexus-ai` -> Generates -> Sends Response back over P2P.

## 💾 Persistence

- **Location**: OS-specific data directory (e.g., `~/.local/share/com.plexus.mesh`).
- **Engine**: `sled` embedded database.
- **Data**: Peer topology, Identity keys, Chat history.

## 🛡️ Security

- **Identity**: All nodes have an Ed25519 keypair.
- **Encryption**: All P2P traffic is encrypted with Noise.
- **Integrity**: AI models are verified via SHA256 before loading.
