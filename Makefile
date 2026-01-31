.PHONY: build run-node run-ui test clean

build:
	cargo build

run-node:
	cargo run --bin plexus-node

run-ui:
	cd plexus-ui && npm install --legacy-peer-deps --force --cache .npm-cache && npm run tauri dev

test:
	cargo test

clean:
	cargo clean
