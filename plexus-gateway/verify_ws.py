import asyncio
import websockets
import json

async def receive_events():
    uri = "ws://localhost:8080/v1/events"
    print(f"🔌 Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected! Waiting for events...")
            while True:
                message = await websocket.recv()
                data = json.loads(message)
                print(f"📨 Received Event: {data}")
                
                # Stop after receiving one mesh_status event to prove it works
                if data.get("type") == "mesh_status":
                    print("🎉 Verification Successful: Mesh Status received.")
                    break
    except Exception as e:
        print(f"❌ WebSocket Error: {e}")

if __name__ == "__main__":
    asyncio.run(receive_events())
