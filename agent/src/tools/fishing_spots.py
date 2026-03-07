"""
Fishing Spots tool — finds nearby water bodies and scores them for fishing.

Uses:
  • Overpass API (OpenStreetMap) to find real water bodies within a radius
  • OpenWeatherMap to get weather conditions at each location
  • DynamoDB catch records to gauge historical fish density
  • Distance from the user to estimate transport cost

Returns a JSON payload with up to 15 ranked spots, each containing:
  name, latitude, longitude, type, distance_km,
  weather_score (0-100), fish_density_score (0-100), transport_score (0-100),
  confidence (weighted composite 0-100), color (#hex).

Confidence weights:
  Weather       40 %  (low wind, no rain, partly cloudy)
  Fish Density  35 %  (catch-record count within 30 km)
  Transport     25 %  (closer distance → lower cost → higher score)
"""
from __future__ import annotations

import json
import math
from typing import Optional

import httpx
from boto3.dynamodb.conditions import Attr, Key
from langchain_core.tools import tool

from src.config.settings import IMAGES_TABLE, OPENWEATHERMAP_API_KEY
from src.utils.dynamodb import dynamodb


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _fetch_overpass_water_bodies(lat: float, lon: float, radius_m: int) -> list[dict]:
    """Query the Overpass API for nearby water bodies."""
    query = (
        f"[out:json][timeout:25];\n"
        f"(\n"
        f"  way[\"natural\"=\"water\"](around:{radius_m},{lat},{lon});\n"
        f"  way[\"waterway\"~\"river|canal\"](around:{radius_m},{lat},{lon});\n"
        f"  relation[\"natural\"=\"water\"](around:{radius_m},{lat},{lon});\n"
        f"  node[\"natural\"~\"bay|beach|cape\"](around:{radius_m},{lat},{lon});\n"
        f"  way[\"natural\"~\"beach|coastline\"](around:{radius_m},{lat},{lon});\n"
        f");\n"
        f"out center 30;"
    )
    try:
        async with httpx.AsyncClient(timeout=22) as client:
            resp = await client.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query},
            )
            resp.raise_for_status()
            elements = resp.json().get("elements", [])
    except Exception:
        return []

    spots: list[dict] = []
    seen: set[str] = set()

    for elem in elements:
        tags = elem.get("tags", {})
        name = (
            tags.get("name")
            or tags.get("name:en")
            or tags.get("name:hi")
            or tags.get("waterway")
            or tags.get("natural")
            or "Water Body"
        )

        if elem["type"] == "node":
            plat, plon = elem.get("lat"), elem.get("lon")
        else:
            center = elem.get("center", {})
            plat, plon = center.get("lat"), center.get("lon")

        if plat is None or plon is None:
            continue

        water_type = tags.get("natural") or tags.get("waterway") or "water"
        key = f"{name.lower().strip()}_{water_type}"
        if key in seen:
            continue
        seen.add(key)

        spots.append({"name": name, "lat": float(plat), "lon": float(plon), "type": water_type})

    return spots[:20]


def _weather_score(wind_speed: float, rain_1h: float, clouds: int) -> float:
    """0-100: higher = better fishing weather."""
    # Wind (dominant factor)
    if wind_speed < 3:
        wind_s = 100
    elif wind_speed < 6:
        wind_s = 85
    elif wind_speed < 10:
        wind_s = 65
    elif wind_speed < 14:
        wind_s = 40
    else:
        wind_s = 15

    # Rain penalty
    if rain_1h == 0:
        rain_pen = 0
    elif rain_1h < 1:
        rain_pen = 10
    elif rain_1h < 5:
        rain_pen = 25
    else:
        rain_pen = 40

    # Clouds: partly cloudy is good (fish near surface)
    if clouds < 20:
        cloud_s = 70
    elif clouds < 60:
        cloud_s = 90
    else:
        cloud_s = 60

    return max(0.0, min(100.0, wind_s * 0.55 + cloud_s * 0.25 - rain_pen))


def _fish_density_score(spot_lat: float, spot_lon: float, catch_markers: list[dict]) -> float:
    """0-100 based on number of historical catch records near the spot."""
    nearby = sum(
        1 for m in catch_markers
        if _haversine(spot_lat, spot_lon, m["lat"], m["lon"]) <= 30
    )
    if nearby == 0:
        return 20.0
    if nearby <= 2:
        return 40.0
    if nearby <= 7:
        return 60.0
    if nearby <= 20:
        return 80.0
    return 95.0


def _transport_score(dist_km: float) -> float:
    """0-100: closer distance = lower transport cost = higher score."""
    if dist_km < 5:
        return 100.0
    if dist_km < 15:
        return 90.0
    if dist_km < 25:
        return 78.0
    if dist_km < 40:
        return 62.0
    return 45.0


def _confidence_color(score: float) -> str:
    if score >= 68:
        return "#10b981"  # green
    if score >= 45:
        return "#f59e0b"  # amber
    return "#ef4444"       # red


# ─────────────────────────────────────────────────────────────────────────────
# Tool
# ─────────────────────────────────────────────────────────────────────────────

@tool
async def get_nearby_fishing_spots(
    latitude: float,
    longitude: float,
    radius_km: Optional[float] = 50,
) -> str:
    """
    Find nearby sea, river, lake, and other water bodies using real map data
    (OpenStreetMap), then compute a fishing confidence score for each location based on:
      • Weather conditions at that spot (wind speed, rainfall, cloud cover)
      • Fish density (historical catch records from the database near that spot)
      • Transport cost (distance from the user's current location)

    Returns a JSON object containing:
      - "spots": list of up to 15 ranked fishing locations, each with:
          name, latitude, longitude, type, distance_km,
          weather_score (0-100), fish_density_score (0-100),
          transport_score (0-100), confidence (0-100), color (hex string)
      - "summary": human-readable text ranking

    The color field indicates:
      🟢 green  (#10b981) — high confidence (≥68)
      🟡 amber  (#f59e0b) — medium confidence (45–67)
      🔴 red    (#ef4444) — low confidence (<45)

    Use this tool when the user asks about:
      - Best nearby fishing spots or locations
      - Where to fish near me / nearby water bodies
      - Fishing spots with weather and fish density info

    Args:
        latitude: User's current latitude (e.g. 15.4909 for Goa)
        longitude: User's current longitude (e.g. 73.8278 for Goa)
        radius_km: Search radius in kilometres (default 50)
    """
    print(f"[TOOL] get_nearby_fishing_spots -> lat={latitude}, lon={longitude}, radius={radius_km}km", flush=True)
    radius_m = int((radius_km or 50) * 1000)

    # 1. Real water body locations from OpenStreetMap ─────────────────────────
    spots = await _fetch_overpass_water_bodies(latitude, longitude, radius_m)

    if not spots:
        return json.dumps({
            "error": (
                "Could not fetch nearby water bodies from OpenStreetMap. "
                "Check your internet connection or try a larger radius."
            ),
            "spots": [],
        }, indent=2)

    # 2. Historical catch records from DynamoDB ───────────────────────────────
    catch_markers: list[dict] = []
    try:
        table = dynamodb.Table(IMAGES_TABLE)
        response = table.query(
            IndexName="status-createdAt-index",
            KeyConditionExpression=Key("status").eq("completed"),
            FilterExpression=Attr("latitude").exists() & Attr("longitude").exists(),
            ProjectionExpression="latitude, longitude",
            ScanIndexForward=False,
            Limit=400,
        )
        for item in response.get("Items", []):
            try:
                m_lat = float(item["latitude"])
                m_lon = float(item["longitude"])
                if math.isfinite(m_lat) and math.isfinite(m_lon):
                    catch_markers.append({"lat": m_lat, "lon": m_lon})
            except (TypeError, ValueError):
                continue
    except Exception:
        pass  # fish density will fall back to baseline 20

    # 3. Score each spot ───────────────────────────────────────────────────────
    # Keep only the 12 closest to avoid excessive weather API calls
    spots_with_dist = sorted(
        [{"spot": s, "dist": _haversine(latitude, longitude, s["lat"], s["lon"])} for s in spots],
        key=lambda x: x["dist"],
    )[:12]

    scored_spots: list[dict] = []

    async with httpx.AsyncClient(timeout=10) as client:
        for entry in spots_with_dist:
            spot = entry["spot"]
            dist = entry["dist"]

            transport_s = _transport_score(dist)
            fish_s = _fish_density_score(spot["lat"], spot["lon"], catch_markers)

            # Weather at this spot
            weather_s = 50.0
            if OPENWEATHERMAP_API_KEY:
                try:
                    wr = await client.get(
                        "https://api.openweathermap.org/data/2.5/weather",
                        params={
                            "lat": spot["lat"],
                            "lon": spot["lon"],
                            "appid": OPENWEATHERMAP_API_KEY,
                            "units": "metric",
                        },
                    )
                    if wr.status_code == 200:
                        wd = wr.json()
                        weather_s = _weather_score(
                            wind_speed=wd.get("wind", {}).get("speed", 5),
                            rain_1h=wd.get("rain", {}).get("1h", 0),
                            clouds=wd.get("clouds", {}).get("all", 50),
                        )
                except Exception:
                    pass

            confidence = round(weather_s * 0.40 + fish_s * 0.35 + transport_s * 0.25, 1)

            scored_spots.append({
                "name": spot["name"],
                "latitude": round(spot["lat"], 6),
                "longitude": round(spot["lon"], 6),
                "type": spot["type"],
                "distance_km": round(dist, 1),
                "weather_score": round(weather_s, 1),
                "fish_density_score": round(fish_s, 1),
                "transport_score": round(transport_s, 1),
                "confidence": confidence,
                "color": _confidence_color(confidence),
            })

    scored_spots.sort(key=lambda x: x["confidence"], reverse=True)
    top_spots = scored_spots[:15]

    # 4. Human-readable summary ───────────────────────────────────────────────
    lines = [
        f"🎣 **Nearby Fishing Spots** ({len(top_spots)} found within {radius_km:.0f} km):\n",
        "Score breakdown: Weather 40% | Fish Density 35% | Transport Cost 25%\n",
    ]
    for i, s in enumerate(top_spots, 1):
        emoji = "🟢" if s["confidence"] >= 68 else ("🟡" if s["confidence"] >= 45 else "🔴")
        lines.append(
            f"  {i}. {emoji} **{s['name']}** ({s['type']}) — {s['distance_km']} km away\n"
            f"     Confidence: **{s['confidence']}/100** | "
            f"Weather: {s['weather_score']}/100 | "
            f"Fish Density: {s['fish_density_score']}/100 | "
            f"Transport: {s['transport_score']}/100"
        )

    return json.dumps({
        "spots": top_spots,
        "user_location": {"lat": latitude, "lon": longitude},
        "summary": "\n".join(lines),
    }, indent=2)
