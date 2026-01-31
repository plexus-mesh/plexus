# 📘 Plexus User Guide & Best Practices

This guide is for **operators** and **users** running Plexus Mesh nodes. Follow these best practices to ensure stability, performance, and security.

## 🖥️ Hardware Recommendations

Plexus runs LLMs locally. Your experience depends heavily on your hardware.

| Tier         | RAM   | CPU/GPU                 | Recommended Models         |
| ------------ | ----- | ----------------------- | -------------------------- |
| **Entry**    | 8GB   | Apple M1 / Intel i5     | `TinyLlama-1.1B`, `Phi-2`  |
| **Standard** | 16GB  | Apple M2 / RTX 3060     | `Mistral-7B`, `Llama-3-8B` |
| **Power**    | 32GB+ | Apple M3 Max / RTX 4090 | `Mixtral-8x7B` (Quantized) |

> **💡 Tip**: If you experience slow tokens/sec, switch to a smaller quantized model (e.g., `Q4_K_M`).

## 🌐 Network Configuration

Plexus uses `libp2p` to connect nodes. While we support "Hole Punching", optimal performance requires good network hygiene.

### 1. UPnP / Port Forwarding (Best Performance)

For the fastest direct connections, enable **UPnP** on your router.
If manual forwarding is needed, Plexus defaults to:

- **TCP/UDP**: `0` (Random, check logs) - _Configurable in future versions_

### 2. Behind Carrier-Grade NAT (CGNAT)?

If you cannot forward ports (e.g., Starlink, Mobile), Plexus automatically falls back to **Relay Nodes**.

- _Note_: Latency will be higher.
- _Best Practice_: Ensure at least one node in your mesh has a public IP or UPnP enabled to act as a pivot.

## 🔐 Security Best Practices

### 1. Identity Key (`identity.key`)

When you start Plexus, it generates a unique **Ed25519 identity key**.

- **Location**: User Data Directory (e.g., `~/.local/share/com.plexus.mesh/identity.key`).
- **⚠️ WARNING**: **NEVER share this file.** It is your cryptographic identity on the mesh. If lost, you lose your reputation and address. Back it up securely.

### 2. Mesh State (`mesh_state.db`)

This database stores your known peers and trust scores.

- **Corruption**: If the node crashes repeatedly, this DB might be corrupted.
- **Fix**: Delete `mesh_state.db` to reset your topology view (your Identity Key remains safe).

## 🚀 Performance Tuning

### 1. Release Mode

Always run heavy workloads with the optimized release binary:

```bash
cargo run --release -p plexus-node
```

Debug builds are ~10-50x slower for AI inference.

### 2. Multi-Node Local Cluster

To simulate a mesh grid on a single machine (e.g., for testing connectivity):

```bash
# Terminal 1 (Main Node)
npm run tauri dev

# Terminal 2 (Worker Node)
cargo run -p plexus-node -- --data-dir tmp/worker-1
```

This isolates the database and identity keys, preventing lock conflicts.

### 2. Environment Variables

- `RUST_LOG=info` (Default): Good balance.
- `RUST_LOG=error`: Use for maximum performance to reduce I/O overhead.
- `RUST_LOG=debug`: Only for troubleshooting (generates huge logs).

## 🛠️ Troubleshooting

**"Node not discovering peers?"**

1.  Check `RUST_LOG=debug` output.
2.  Ensure mDNS is allowed in your OS Firewall.
3.  Try manually adding a bootstrap peer via config (coming soon).

**"Model fails to load?"**

1.  Check disk space (Models are 1GB - 5GB).
2.  Delete the cached model in `~/.cache/huggingface/hub` to force re-download.
