# 🧪 Manual Verification Guide

This guide walks you through manually verifying the full Plexus Mesh stack (Node, UI, P2P, AI, Gateway).

## ✅ Prerequisites

Ensure you have built the release binaries:

```bash
# Build Node & Gateway
cargo build --release -p plexus-node
cargo build --release -p plexus-gateway

# Build/Setup UI (depends on system)
cd plexus-ui && npm install && npm run build
```

---

## 1. Single Node Verification (The "Hello World")

**Goal**: Verify the node starts, generates an identity, and accepts commands.

1.  **Start the Node**:
    ```bash
    cargo run --release -p plexus-node
    ```
2.  **Verify Logs**:
    - Look for: `NodeService: Identity loaded: <PeerID>`
    - Look for: `Swarm initialized with behaviors: Gossipsub, Kademlia`
    - Look for: `Mesh DB Path: .../mesh_state.db`
3.  **Verify Persistence**:
    - Stop the node (`Ctrl+C`).
    - Restart it.
    - Confirm the **PeerID** matches the previous run (Identity Persistence).

---

## 2. AI Inference Verification (The "Brain")

**Goal**: Verify the LLM engine loads and generates text.

1.  **Start Node with Model**:
    ```bash
    cargo run --release -p plexus-node -- --model phi
    ```
2.  **Check Verification**:
    - Log: `Verifying model integrity...`
    - Log: `Model integrity verified.` or `Calculated Model Hash: ...`
3.  **Test via Gateway (API)**:
    - In a separate terminal, start the Gateway:
      ```bash
      cargo run --release -p plexus-gateway
      ```
    - Send a request (simulated - normally Gateway talks to Node):
      ```bash
      curl http://localhost:8080/v1/chat/completions \
        -H "Authorization: Bearer sk-test" \
        -H "Content-Type: application/json" \
        -d '{
          "model": "phi",
          "messages": [{"role": "user", "content": "Hello!"}]
        }'
      ```
    - _Note_: Since Gateway is currently a stub implementation (per Audit), it may return `503 Service Unavailable` if not fully wired to `plexus-node` via IPC/gRPC yet. Correct behavior for MVP is a structured JSON error, not a crash.

### Optional: Vector Database (Qdrant)

By default, Plexus tries to connect to a local Qdrant instance.

- **If missing**: You will see `Failed to connect to Qdrant... Falling back to In-Memory Store`. **This is normal.**
- **To enable persistence**:
  ```bash
  docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
  ```

---

## 3. P2P Mesh Verification (The "Network")

**Goal**: Verify two nodes can discover each other.

1.  **Start Node A (Bootstrap)**:

    ```bash
    cargo run --release -p plexus-node
    ```

    - Note its listening address (e.g., `/ip4/127.0.0.1/tcp/...`).

2.  **Start Node B (Peer)**:
    - Open a new terminal.
    - Run with a different port (libp2p usually handles this, or use env vars if configured):
      ```bash
      # Currently plexus-node defaults to random port or config
      cargo run --release -p plexus-node
      ```
3.  **Verify Discovery**:
    - Watch logs on **Node A**: `New peer connected: <NodeB-ID>`
    - Watch logs on **Node B**: `Kademlia: Found peer <NodeA-ID>`

---

## 4. UI Verification (The "Face")

**Goal**: Verify the frontend connects to the backend.

1.  **Run the Full App**:
    ```bash
    cd plexus-ui
    npm run tauri dev
    ```
2.  **Check Dashboard**:
    - **Hardware Stats**: Are CPU/RAM graphs moving? (IPC Check)
    - **Peer ID**: Is your ID displayed in the corner?
    - **Chat**: Navigate to "Chat", type "Hello". Does the spinner appear?

---

## ❌ Common Failure Modes

- **"Hash Mismatch"**: Delete `~/.cache/huggingface` and restart to redownload the model.
- **"Port In Use"**: Ensure no other `plexus-node` or `plexus-gateway` is running.
- **"Database Locked"**: `sled` only allows one process per DB. Ensure only one Instance uses the same data dir.
