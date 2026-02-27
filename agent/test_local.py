"""
Quick smoke test — calls the agent endpoints locally.

Usage:
    1. Start the server: cd agent && uvicorn src.main:app --reload --port 8001
    2. Run this:         python test_local.py
"""
import httpx
import json

BASE_URL = "http://localhost:8001"
TOKEN = "Bearer demo_jwt_token_test123"
HEADERS = {"Authorization": TOKEN, "Content-Type": "application/json"}


def test_health():
    r = httpx.get(f"{BASE_URL}/health")
    print(f"✅ Health: {r.json()}")


def test_create_conversation():
    r = httpx.post(
        f"{BASE_URL}/conversations",
        headers=HEADERS,
        json={"title": "Test Chat", "language": "hi"},
    )
    data = r.json()
    print(f"✅ Create conversation: {json.dumps(data, indent=2, default=str)}")
    return data.get("conversation", {}).get("conversationId")


def test_list_conversations():
    r = httpx.get(f"{BASE_URL}/conversations", headers=HEADERS)
    data = r.json()
    print(f"✅ List conversations: {len(data.get('conversations', []))} found")
    return data


def test_send_message(conversation_id: str, message: str):
    r = httpx.post(
        f"{BASE_URL}/conversations/{conversation_id}/messages",
        headers=HEADERS,
        json={"message": message},
        timeout=60,
    )
    data = r.json()
    print(f"✅ Send message: {json.dumps(data, indent=2, default=str)[:500]}")
    return data


def test_get_messages(conversation_id: str):
    r = httpx.get(
        f"{BASE_URL}/conversations/{conversation_id}/messages",
        headers=HEADERS,
    )
    data = r.json()
    msgs = data.get("messages", [])
    print(f"✅ Get messages: {len(msgs)} messages")
    for m in msgs:
        print(f"   [{m.get('role')}] {m.get('content', '')[:100]}")
    return data


def test_delete_conversation(conversation_id: str):
    r = httpx.delete(
        f"{BASE_URL}/conversations/{conversation_id}",
        headers=HEADERS,
    )
    print(f"✅ Delete conversation: {r.json()}")


if __name__ == "__main__":
    print("=" * 60)
    print("OceanAI Agent — Local Smoke Test")
    print("=" * 60)

    test_health()

    conv_id = test_create_conversation()
    if not conv_id:
        print("❌ Failed to create conversation")
        exit(1)

    test_list_conversations()

    # Test Hindi message
    test_send_message(conv_id, "Namaste! Aaj samundar kaisa hai Goa mein?")

    # Test weather-related query
    test_send_message(conv_id, "Kya aaj machli pakadne jaana theek rahega?")

    # Test catch history
    test_send_message(conv_id, "Meri pichhli catches dikhao")

    # Test market prices
    test_send_message(conv_id, "Mumbai mein pomfret ka daam kya hai?")

    test_get_messages(conv_id)

    # Cleanup
    # test_delete_conversation(conv_id)

    print("\n" + "=" * 60)
    print("✅ All tests passed!")
    print("=" * 60)
