# Contributing to Plexus Mesh

First off, thank you for considering contributing to Plexus Mesh! We are building the sovereign neural mesh, and your help is invaluable.

## 🛠️ Development Setup

1.  **Rust Environment**: Ensure you have the latest stable Rust.
    ```bash
    rustup update stable
    ```
2.  **Node.js**: Require v18+ for the `plexus-ui` frontend.
3.  **Dependencies**:
    - **Protobuf Compiler**: Required for `libp2p`.
      - macOS: `brew install protobuf`
      - Linux: `apt-get install protobuf-compiler`

## 🧪 Testing Guidelines

We enforce a strict testing culture to ensure stability.

### 1. Run the Test Suite

Before submitting any code, run the full verification suite:

```bash
# Run Unit & Integration Tests (Backend)
cargo test --workspace

# Run UI End-to-End Tests (if modifying frontend)
cd plexus-ui
npx playwright test
```

### 2. CI/CD Checks (`test.yml`)

Our CI automatically runs:

- `cargo clippy` (Linting)
- `cargo tarpaulin` (Code Coverage)
- `playwright` (E2E)

Ensure your PR passes these checks.

## 📝 Coding Standards

- **Error Handling**: Use `anyhow::Result` for apps and `thiserror` for libraries. **Avoid `unwrap()`** in production code; use `expect()` or handle errors gracefully.
- **Async**: Utilize `tokio` for async runtimes.
- **Logging**: Use `tracing` macros (`info!`, `warn!`, `error!`) instead of `println!`.
- **Persistence**: Use `pled` / `plexus-core` for any persistent state. Do not create random files; use `directories-next`.

## 🚀 Pull Request Process

1.  **Fork** the repo and create your branch (`git checkout -b feature/amazing-feature`).
2.  **Commit** your changes with clear messages.
3.  **Test** your changes locally.
4.  **Open a PR** describing what you changed and why.

Thank you for building the decentralized future with us! 🌐
