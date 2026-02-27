"""
Catch history tool — queries the existing ai-bharat-images table.

Returns the user's last N catches (images analysed via Rekognition)
in a format useful for the agent.
"""
from __future__ import annotations
from typing import Optional
from boto3.dynamodb.conditions import Key
from langchain_core.tools import tool

from src.config.settings import IMAGES_TABLE, CATCH_HISTORY_PAGE_SIZE
from src.utils.dynamodb import dynamodb


@tool
async def get_catch_history(
    user_id: str,
    page: int = 1,
    limit: Optional[int] = None,
) -> str:
    """
    Get the user's recent catch history (fish species detected from images).
    Results are paginated — page 1 is the most recent.

    Args:
        user_id: The user ID to look up catches for.
        page: Page number (1-based). Default 1.
        limit: Max results per page. Default from settings.
    """
    page_size = limit or CATCH_HISTORY_PAGE_SIZE
    table = dynamodb.Table(IMAGES_TABLE)

    try:
        response = table.query(
            IndexName="userId-createdAt-index",
            KeyConditionExpression=Key("userId").eq(user_id),
            ScanIndexForward=False,  # newest first
            Limit=page_size * page,  # get enough to slice
        )
    except Exception as e:
        return f"⚠️ Could not fetch catch history: {e}"

    items = response.get("Items", [])

    # Paginate in-memory (DynamoDB Limit doesn't directly support offset)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    if not page_items:
        if page == 1:
            return "No catch records found yet. Upload a photo of your catch to start tracking!"
        return f"No more records on page {page}."

    lines = [f"🐟 **Catch History** (Page {page}, showing {len(page_items)} records):"]
    for i, item in enumerate(page_items, start=start + 1):
        species = item.get("species", "Unknown")
        location = item.get("location", "Unknown location")
        date = item.get("createdAt", "Unknown date")
        confidence = item.get("confidence")
        status = item.get("analysisStatus", "unknown")

        line = f"  {i}. **{species}** — {location} ({date[:10]})"
        if confidence:
            line += f" [Confidence: {confidence}%]"
        if status != "completed":
            line += f" [{status}]"
        lines.append(line)

    total = len(items)
    if total > start + page_size:
        lines.append(f"\n  → More records available. Ask for page {page + 1}.")

    return "\n".join(lines)
