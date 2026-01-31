#!/bin/bash

# Get Project Root
PROJECT_ROOT=$(pwd)

echo "🚀 Starting Plexus Mesh Testing Suite..."

# 1. Start Plexus Gateway (Port 8080)
echo "   Opening Gateway..."
osascript -e "tell app \"Terminal\" to do script \"cd '$PROJECT_ROOT' && cargo run -p plexus-gateway\""

# 2. Start Plexus UI (Frontend)
echo "   Opening UI..."
osascript -e "tell app \"Terminal\" to do script \"cd '$PROJECT_ROOT/plexus-ui' && npm run tauri dev\""

# 3. Run Traffic Generator (Moltbot)
echo "   Opening Traffic Generator..."
osascript -e "tell app \"Terminal\" to do script \"cd '$PROJECT_ROOT' && sleep 10 && .venv/bin/python3 plexus-gateway/moltbot_adapter.py\""

echo "✅ All systems initiated. Check the opened Terminal windows."
