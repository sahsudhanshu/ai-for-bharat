"""
Catch insights generator - fetches a user's catch history and group batches
from DynamoDB and produces a concise Gemini-summarised snapshot for the
Telegram /start welcome message.
"""
from __future__ import annotations
import logging
from typing import Optional
from decimal import Decimal

from boto3.dynamodb.conditions import Key
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from src.config.settings import (
    IMAGES_TABLE,
    GROUPS_TABLE,
    GOOGLE_API_KEY,
    GEMINI_MODEL,
)
from src.utils.dynamodb import dynamodb

logger = logging.getLogger(__name__)


def _dec(v) -> float:
    """Convert DynamoDB Decimal to float."""
    return float(v) if isinstance(v, (Decimal, int, float, str)) else 0.0


async def get_catch_insights(user_id: str) -> Optional[str]:
    """
    Build a short capture-insights summary for *user_id*.

    Returns a Markdown-formatted string ready for Telegram, or ``None``
    if the user has no catch records.
    """
    if not user_id:
        return None

    # ── 1. Fetch recent individual images ────────────────────────────────
    images_table = dynamodb.Table(IMAGES_TABLE)
    try:
        img_resp = images_table.query(
            IndexName="userId-createdAt-index",
            KeyConditionExpression=Key("userId").eq(user_id),
            ScanIndexForward=False,
            Limit=50,
        )
        images = img_resp.get("Items", [])
    except Exception as e:
        logger.error(f"Catch insights - images query failed: {e}")
        images = []

    # ── 2. Fetch recent group batches ────────────────────────────────────
    groups_table = dynamodb.Table(GROUPS_TABLE)
    try:
        grp_resp = groups_table.query(
            IndexName="userId-createdAt-index",
            KeyConditionExpression=Key("userId").eq(user_id),
            ScanIndexForward=False,
            Limit=30,
        )
        groups = grp_resp.get("Items", [])
    except Exception as e:
        logger.error(f"Catch insights - groups query failed: {e}")
        groups = []

    if not images and not groups:
        return None

    # ── 3. Compute quick stats ───────────────────────────────────────────
    species_count: dict[str, int] = {}
    total_catches = 0
    total_weight_g = 0.0
    total_value = 0.0

    # Individual images
    for item in images:
        ar = item.get("analysisResult") or {}
        species = ar.get("species", item.get("species", "Unknown"))
        species_count[species] = species_count.get(species, 0) + 1
        total_catches += 1

        measurements = ar.get("measurements") or {}
        total_weight_g += _dec(measurements.get("weight_g", 0))

        market = ar.get("marketEstimate") or {}
        total_value += _dec(market.get("estimated_value", 0))

    # Group batches
    for grp in groups:
        ar = grp.get("analysisResult") or {}
        agg = ar.get("aggregateStats") or {}

        fish_count = int(_dec(agg.get("totalFishCount", 0)))
        total_catches += fish_count

        dist = agg.get("speciesDistribution") or {}
        for sp, cnt in dist.items():
            species_count[sp] = species_count.get(sp, 0) + int(_dec(cnt))

        total_weight_g += _dec(agg.get("totalEstimatedWeight", 0))
        total_value += _dec(agg.get("totalEstimatedValue", 0))

    if total_catches == 0:
        return None

    top_species = sorted(species_count.items(), key=lambda x: x[1], reverse=True)[:5]
    total_weight_kg = total_weight_g / 1000 if total_weight_g > 0 else 0
    unique_species = len(species_count)

    # ── 4. Build stats context for LLM ───────────────────────────────────
    stats_text = (
        f"Total catches: {total_catches}\n"
        f"Unique species: {unique_species}\n"
        f"Top species: {', '.join(f'{s} ({c})' for s, c in top_species)}\n"
        f"Total weight: {total_weight_kg:.1f} kg\n"
        f"Estimated total value: ₹{total_value:,.0f}\n"
        f"Scan records: {len(images)} images, {len(groups)} group batches"
    )

    # ── 5. Generate a compact Gemini summary ─────────────────────────────
    try:
        llm = ChatGoogleGenerativeAI(
            model=GEMINI_MODEL or "gemini-3-flash-preview",
            google_api_key=GOOGLE_API_KEY,
            temperature=0.7,
            max_output_tokens=500,
        )
        prompt = (
            "You are matsya AI, an AI fishing companion for Indian fishermen.\n"
            "Given the user's capture stats below, write a SHORT, encouraging\n"
            "Telegram welcome summary (4-6 lines max). Use emojis. Mention their\n"
            "top species, total catches, weight, and estimated earnings.\n"
            "Keep it under 400 characters. Do NOT use Markdown headers.\n\n"
            f"Stats:\n{stats_text}"
        )
        response = await llm.ainvoke([
            SystemMessage(content="You are matsya AI, a concise Telegram bot for Indian fishermen."),
            HumanMessage(content=prompt),
        ])
        text = response.content
        if isinstance(text, list):
            text = "\n".join(str(c) for c in text)
        return text.strip()
    except Exception as e:
        logger.error(f"Catch insights - LLM summary failed: {e}")
        # Fallback: raw stats
        lines = [
            f"📊 *Your Capture Insights*",
            f"🐟 Total catches: {total_catches} ({unique_species} species)",
        ]
        if top_species:
            lines.append(f"⭐ Top: {', '.join(s for s, _ in top_species[:3])}")
        if total_weight_kg > 0:
            lines.append(f"⚖️ Total weight: {total_weight_kg:.1f} kg")
        if total_value > 0:
            lines.append(f"💰 Est. value: ₹{total_value:,.0f}")
        return "\n".join(lines)
