import openai
import requests
import json

# Configuration
GATEWAY_URL = "http://localhost:8080"
openai.api_base = f"{GATEWAY_URL}/v1"

def register_agent():
    print("📝 Registering Agent...")
    try:
        response = requests.post(f"{GATEWAY_URL}/v1/agents/register", json={"name": "Moltbot-POC"})
        response.raise_for_status()
        data = response.json()
        print(f"✅ Registered! ID: {data['agent_id']}")
        print(f"🔑 API Key: {data['api_key']}")
        return data['api_key']
    except Exception as e:
        print(f"❌ Registration Failed: {e}")
        return None

def test_chat(api_key):
    print("\n🤖 Connecting to Plexus Mesh Gateway...")
    
    # Set the authenticated key
    openai.api_key = api_key
    
    try:
        completion = openai.ChatCompletion.create(
            model="Llama-3-70b", 
            messages=[
                {"role": "system", "content": "You are a helpful assistant running on the Plexus decentralized mesh."},
                {"role": "user", "content": "Hello Plexus! Can you process this request properly with my new credentials?"}
            ]
        )
        
        response = completion.choices[0].message.content
        print(f"\n✅ Mesh Response: {response}")
        print(f"📦 Model Used: {completion.model}")
        print(f"🆔 Network ID: {completion.id}")

    except Exception as e:
        print(f"\n❌ Chat Error: {e}")

if __name__ == "__main__":
    key = register_agent()
    if key:
        test_chat(key)
