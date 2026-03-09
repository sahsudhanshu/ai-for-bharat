"""
DynamoDB store for Telegram subscriptions.

Table: ai-bharat-telegram-subs
  PK: telegramChatId (str)  - Telegram chat ID
  Attributes:
    userId         - matsya AI user ID (linked account)
    latitude       - user's home location
    longitude      - user's home location
    locationName   - human-readable place name
    language       - preferred language code (en, hi, ta, …)
    alertsEnabled  - bool, master toggle
    subscribedAt   - ISO timestamp
    updatedAt      - ISO timestamp
"""
from __future__ import annotations
import time
from typing import Any, Dict, List, Optional

from boto3.dynamodb.conditions import Attr

from src.config.settings import TELEGRAM_SUBS_TABLE
from src.utils.dynamodb import dynamodb


def get_subscriber(telegram_chat_id: int) -> Optional[Dict[str, Any]]:
    """Get a single subscriber by Telegram chat ID."""
    table = dynamodb.Table(TELEGRAM_SUBS_TABLE)
    resp = table.get_item(Key={"telegramChatId": str(telegram_chat_id)})
    return resp.get("Item")


def upsert_subscriber(
    telegram_chat_id: int,
    latitude: float,
    longitude: float,
    location_name: str = "",
    language: str = "en",
    user_id: str = "",
) -> Dict[str, Any]:
    """Create or update a subscriber."""
    table = dynamodb.Table(TELEGRAM_SUBS_TABLE)
    now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    item: Dict[str, Any] = {
        "telegramChatId": str(telegram_chat_id),
        "latitude": str(latitude),
        "longitude": str(longitude),
        "locationName": location_name,
        "language": language,
        "alertsEnabled": True,
        "updatedAt": now,
    }
    if user_id:
        item["userId"] = user_id

    # Check if exists already - preserve subscribedAt
    existing = get_subscriber(telegram_chat_id)
    if existing:
        item["subscribedAt"] = existing.get("subscribedAt", now)
    else:
        item["subscribedAt"] = now

    table.put_item(Item=item)
    return item


def set_alerts_enabled(telegram_chat_id: int, enabled: bool) -> None:
    """Toggle alerts on/off."""
    table = dynamodb.Table(TELEGRAM_SUBS_TABLE)
    table.update_item(
        Key={"telegramChatId": str(telegram_chat_id)},
        UpdateExpression="SET alertsEnabled = :v, updatedAt = :now",
        ExpressionAttributeValues={
            ":v": enabled,
            ":now": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        },
    )


def delete_subscriber(telegram_chat_id: int) -> None:
    """Remove a subscriber."""
    table = dynamodb.Table(TELEGRAM_SUBS_TABLE)
    table.delete_item(Key={"telegramChatId": str(telegram_chat_id)})


def get_all_active_subscribers() -> List[Dict[str, Any]]:
    """Get all subscribers with alerts enabled. Uses scan (fine for < 10k users)."""
    table = dynamodb.Table(TELEGRAM_SUBS_TABLE)
    resp = table.scan(
        FilterExpression=Attr("alertsEnabled").eq(True),
    )
    items = resp.get("Items", [])
    # Handle pagination for large tables
    while "LastEvaluatedKey" in resp:
        resp = table.scan(
            FilterExpression=Attr("alertsEnabled").eq(True),
            ExclusiveStartKey=resp["LastEvaluatedKey"],
        )
        items.extend(resp.get("Items", []))
    return items
