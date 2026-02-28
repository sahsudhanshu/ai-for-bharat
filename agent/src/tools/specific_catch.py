"""
Specific catch tool — queries a single image analysis result from DynamoDB.
"""
from __future__ import annotations
from langchain_core.tools import tool
from boto3.dynamodb.conditions import Key

from src.config.settings import IMAGES_TABLE
from src.utils.dynamodb import dynamodb


@tool
async def get_catch_details(image_id: str, user_id: str = "") -> str:
    """
    Get the detailed analysis of a specific catch (fish upload) using its image_id.
    This provides detailed metrics like length, weight, quality grade, and market value.
    Do NOT pass user_id — it is injected automatically.

    Args:
        image_id: The unique identifier of the catch/image to look up.
        user_id: Auto-injected by the system. Do not provide.
    """
    table = dynamodb.Table(IMAGES_TABLE)

    try:
        response = table.get_item(Key={"imageId": image_id})
    except Exception as e:
        return f"⚠️ Could not fetch details for catch {image_id}: {e}"

    item = response.get("Item")
    if not item:
        return f"Could not find any catch record with ID {image_id}."
        
    if item.get("userId") != user_id:
        return f"You do not have permission to view catch {image_id}."

    # Parse details
    species = item.get("species", "Unknown")
    confidence = item.get("confidence", 0) * 100
    location = item.get("location", "Unknown location")
    date = item.get("createdAt", "Unknown date")[:10]
    weight = item.get("weightEstimate", 0.0)
    price_per_kg = item.get("marketPriceEstimate", 0)
    total_value = round(weight * price_per_kg)
    quality = item.get("qualityGrade", "Unknown")
    sustainable = item.get("isSustainable", False)

    lines = [
        f"🐟 **Specific Catch Details: {species}** ({date})",
        f"• Image ID: {image_id}",
        f"• Location: {location}",
        f"• Confidence: {confidence:.1f}%",
        f"• Quality Grade: {quality}",
        f"• Weight Estimate: {weight:.2f} KG",
        f"• Estimated Value: ₹{total_value} (@ ₹{price_per_kg}/kg)",
        f"• Sustainability: {'Sustainable' if sustainable else 'Limited/Not Sustainable'}",
    ]

    analysis_status = item.get("analysisStatus", "unknown")
    if analysis_status != "completed":
        lines.append(f"\nNote: Analysis status is currently '{analysis_status}'. Some metrics may be missing or inaccurate until completed.")

    return "\n".join(lines)
