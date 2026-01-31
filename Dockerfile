# Build stage
FROM rust:1.75 as builder

WORKDIR /usr/src/app
COPY . .

# Build the node binary
RUN cargo build --release --bin plexus-node

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/plexus-node /usr/local/bin/plexus-node

WORKDIR /root
CMD ["plexus-node"]
