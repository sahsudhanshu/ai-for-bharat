import httpx
import json
import asyncio
import time

BASE_URL = "http://localhost:8001"
TOKEN = "Bearer demo_jwt_token_test123"
HEADERS = {"Authorization": TOKEN, "Content-Type": "application/json"}

async def test_stream():
    # 1. Create conversation
    r = httpx.post(f"{BASE_URL}/conversations", headers=HEADERS, json={"title": "Stream Test", "language": "en"})
    conv_id = r.json()["conversation"]["conversationId"]
    print(f"Created conversation: {conv_id}")

    # 2. Stream message
    print("\n--- Streaming Response ---")
    start = time.time()
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream("POST", f"{BASE_URL}/conversations/{conv_id}/messages/stream", headers=HEADERS, json={"message": "Write a 5 sentence story about a turtle."}) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = json.loads(line[6:])
                    if data["type"] == "chunk":
                        print(f"[{time.time() - start:.2f}s] {data['text']}", end="", flush=True)
                    elif data["type"] == "tool":
                        print(f"\n[{time.time() - start:.2f}s] [Tool Execution: {data['name']}]\n")
                    elif data["type"] == "end":
                        print(f"\n\n[{time.time() - start:.2f}s] [End of Stream, messageId: {data['messageId']}]")
                    elif data["type"] == "error":
                        print(f"\n[{time.time() - start:.2f}s] [Error: {data['error']}]")

if __name__ == "__main__":
    asyncio.run(test_stream())
