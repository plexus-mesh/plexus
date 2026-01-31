#!/bin/bash
set -e

echo "🔍 Starting Plexus Mesh Quality Verification..."

echo ""
echo "📦 1. Frontend Checks (Prettier)"
echo "--------------------------------"
npx prettier --check "plexus-ui/**/*.{ts,tsx,css,json}" "**/*.md"
echo "✅ Frontend/Docs Formatting OK"

echo ""
echo "🦀 2. Backend Checks (Rust)"
echo "---------------------------"
echo "Running 'cargo fmt'..."
cargo fmt --all -- --check
echo "✅ Rust Formatting OK"

echo "Running 'cargo clippy'..."
cargo clippy --workspace -- -D warnings
echo "✅ Rust Linting OK"

echo "Running 'cargo test'..."
cargo test --workspace
echo "✅ Rust Tests OK"

echo ""
echo "🎉 All Quality Checks Passed!"
echo "Your code meets the Plexus Standard and is ready for a Pull Request."
