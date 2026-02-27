"""
DynamoDB persistence for conversations, messages, and long-term memory.
"""
from __future__ import annotations
import time
import uuid
from typing import Any, Dict, List, Optional

from boto3.dynamodb.conditions import Key

from src.config.settings import (
    CONVERSATIONS_TABLE,
    MESSAGES_TABLE,
    MEMORY_TABLE,
    SHORT_TERM_MESSAGE_LIMIT,
)
from src.utils.dynamodb import dynamodb


# ─────────────────────────────────────────────────────────────────────────────
# Conversations
# ─────────────────────────────────────────────────────────────────────────────

def create_conversation(user_id: str, title: str = "New Chat", language: str = "en") -> Dict[str, Any]:
    table = dynamodb.Table(CONVERSATIONS_TABLE)
    conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
    now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    item = {
        "conversationId": conversation_id,
        "userId": user_id,
        "title": title,
        "language": language,
        "summary": "",
        "messageCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    table.put_item(Item=item)
    return item


def list_conversations(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    table = dynamodb.Table(CONVERSATIONS_TABLE)
    resp = table.query(
        IndexName="userId-updatedAt-index",
        KeyConditionExpression=Key("userId").eq(user_id),
        ScanIndexForward=False,
        Limit=limit,
    )
    return resp.get("Items", [])


def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    table = dynamodb.Table(CONVERSATIONS_TABLE)
    resp = table.get_item(Key={"conversationId": conversation_id})
    return resp.get("Item")


def update_conversation(conversation_id: str, **kwargs) -> None:
    table = dynamodb.Table(CONVERSATIONS_TABLE)
    expr_parts, attr_names, attr_values = [], {}, {}
    for k, v in kwargs.items():
        safe = f"#{k}"
        attr_names[safe] = k
        attr_values[f":{k}"] = v
        expr_parts.append(f"{safe} = :{k}")
    attr_values[":now"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    attr_names["#updatedAt"] = "updatedAt"
    expr_parts.append("#updatedAt = :now")
    table.update_item(
        Key={"conversationId": conversation_id},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeNames=attr_names,
        ExpressionAttributeValues=attr_values,
    )


def delete_conversation(conversation_id: str) -> None:
    table = dynamodb.Table(CONVERSATIONS_TABLE)
    table.delete_item(Key={"conversationId": conversation_id})
    # Also delete all messages
    msg_table = dynamodb.Table(MESSAGES_TABLE)
    resp = msg_table.query(
        KeyConditionExpression=Key("conversationId").eq(conversation_id),
        ProjectionExpression="conversationId, #ts",
        ExpressionAttributeNames={"#ts": "timestamp"},
    )
    with msg_table.batch_writer() as batch:
        for item in resp.get("Items", []):
            batch.delete_item(Key={"conversationId": item["conversationId"], "timestamp": item["timestamp"]})


# ─────────────────────────────────────────────────────────────────────────────
# Messages
# ─────────────────────────────────────────────────────────────────────────────

def save_message(
    conversation_id: str,
    role: str,
    content: str,
    tool_calls: Optional[List] = None,
    metadata: Optional[Dict] = None,
) -> Dict[str, Any]:
    table = dynamodb.Table(MESSAGES_TABLE)
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    # Use ISO timestamp as sort key (matches table schema: conversationId HASH + timestamp RANGE)
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    # Append random suffix to avoid collisions within the same second
    now_iso = now_iso.replace(".000Z", f".{uuid.uuid4().hex[:3]}Z")
    item: Dict[str, Any] = {
        "conversationId": conversation_id,
        "messageId": message_id,
        "role": role,
        "content": content,
        "timestamp": now_iso,
    }
    if tool_calls:
        item["toolCalls"] = tool_calls
    if metadata:
        item["metadata"] = metadata
    table.put_item(Item=item)
    return item


def get_messages(
    conversation_id: str,
    limit: int = 50,
    ascending: bool = True,
) -> List[Dict[str, Any]]:
    """Get all messages for a conversation, sorted by timestamp."""
    table = dynamodb.Table(MESSAGES_TABLE)
    resp = table.query(
        KeyConditionExpression=Key("conversationId").eq(conversation_id),
        ScanIndexForward=ascending,
        Limit=limit,
    )
    return resp.get("Items", [])


def get_recent_messages(conversation_id: str) -> List[Dict[str, Any]]:
    """Get the last SHORT_TERM_MESSAGE_LIMIT messages (verbatim)."""
    return get_messages(conversation_id, limit=SHORT_TERM_MESSAGE_LIMIT, ascending=False)[::-1]


def count_messages(conversation_id: str) -> int:
    table = dynamodb.Table(MESSAGES_TABLE)
    resp = table.query(
        KeyConditionExpression=Key("conversationId").eq(conversation_id),
        Select="COUNT",
    )
    return resp.get("Count", 0)


# ─────────────────────────────────────────────────────────────────────────────
# Long-term memory
# ─────────────────────────────────────────────────────────────────────────────

def get_long_term_memory(user_id: str) -> Optional[str]:
    """Get aggregated long-term memory for a user."""
    table = dynamodb.Table(MEMORY_TABLE)
    resp = table.get_item(Key={"userId": user_id})
    item = resp.get("Item")
    return item.get("facts", "") if item else None


def update_long_term_memory(user_id: str, facts: str) -> None:
    """Replace the long-term memory blob for a user."""
    table = dynamodb.Table(MEMORY_TABLE)
    now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    table.put_item(Item={
        "userId": user_id,
        "facts": facts,
        "updatedAt": now,
    })
