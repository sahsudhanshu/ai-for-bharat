"""
Map / ocean data tool — provides region context for the agent.

Uses the same map-data logic as the backend's getMapData handler.
Provides ocean zones, depth data, and fishing markers in a text-friendly format.
"""
from __future__ import annotations
from typing import Optional
from langchain_core.tools import tool


# ── Static data matching the backend (could later be pulled from DynamoDB) ───

OCEAN_ZONES = [
    {
        "name": "Exclusive Economic Zone (EEZ) — India",
        "description": "India's 200 nautical mile exclusive economic zone. Fishing permitted with valid license.",
        "bounds": {"north": 23.5, "south": 6.5, "east": 80.0, "west": 66.0},
    },
    {
        "name": "Territorial Waters",
        "description": "12 nautical miles from coastline. Traditional fishing allowed.",
        "bounds": {"north": 23.5, "south": 6.5, "east": 78.0, "west": 68.0},
    },
]

FISHING_MARKERS = [
    {"name": "Mumbai Fishing Harbor", "lat": 18.9485, "lon": 72.8372, "type": "harbor"},
    {"name": "Sassoon Docks", "lat": 18.9265, "lon": 72.8312, "type": "market"},
    {"name": "Versova Jetty", "lat": 19.1347, "lon": 72.8120, "type": "harbor"},
    {"name": "Mangalore Fishing Port", "lat": 12.8650, "lon": 74.8302, "type": "harbor"},
    {"name": "Kochi Fishing Harbour", "lat": 9.9370, "lon": 76.2614, "type": "harbor"},
    {"name": "Visakhapatnam Fishing Harbour", "lat": 17.6915, "lon": 83.2974, "type": "harbor"},
    {"name": "Chennai Fishing Harbour", "lat": 13.1007, "lon": 80.2945, "type": "harbor"},
    {"name": "Paradip Port", "lat": 20.3166, "lon": 86.6114, "type": "harbor"},
    {"name": "Porbandar Fisheries", "lat": 21.6417, "lon": 69.6293, "type": "harbor"},
    {"name": "Tuticorin Harbour", "lat": 8.7642, "lon": 78.1348, "type": "harbor"},
    {"name": "Veraval Fish Market", "lat": 20.9067, "lon": 70.3679, "type": "market"},
    {"name": "Rameswaram", "lat": 9.2876, "lon": 79.3129, "type": "harbor"},
]

RESTRICTED_AREAS = [
    {
        "name": "Monsoon Fishing Ban Zone (West Coast)",
        "description": "Fishing banned June 1 – July 31 along west coast (mechanised boats).",
        "lat": 15.0, "lon": 72.0, "radius_km": 200,
    },
    {
        "name": "Monsoon Fishing Ban Zone (East Coast)",
        "description": "Fishing banned April 15 – June 14 along east coast (mechanised boats).",
        "lat": 14.0, "lon": 81.0, "radius_km": 200,
    },
]


def _haversine_approx(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Very rough km distance for nearby ranking."""
    import math
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@tool
async def get_map_data(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    query: Optional[str] = None,
) -> str:
    """
    Get ocean zone data, nearby harbors/markets, and restricted fishing areas.
    Provide latitude/longitude to get nearby data, or a text query.

    Args:
        latitude: User's latitude (optional)
        longitude: User's longitude (optional)
        query: Free text query like 'harbors near Mumbai' (optional)
    """
    lines: list[str] = []

    # ── Nearby markers ───────────────────────────────────────────────────
    if latitude is not None and longitude is not None:
        ranked = sorted(
            FISHING_MARKERS,
            key=lambda m: _haversine_approx(latitude, longitude, m["lat"], m["lon"]),
        )[:5]

        lines.append("📍 **Nearest Fishing Locations:**")
        for m in ranked:
            dist = _haversine_approx(latitude, longitude, m["lat"], m["lon"])
            lines.append(f"  • {m['name']} ({m['type']}) — ~{dist:.0f} km away")

        # Restricted areas
        lines.append("\n⚠️ **Restricted/Ban Zones Nearby:**")
        for area in RESTRICTED_AREAS:
            dist = _haversine_approx(latitude, longitude, area["lat"], area["lon"])
            if dist < area["radius_km"] + 100:
                lines.append(f"  • {area['name']}: {area['description']} (~{dist:.0f} km)")

    elif query:
        # Simple keyword search
        q = query.lower()
        matches = [m for m in FISHING_MARKERS if q in m["name"].lower()]
        if matches:
            lines.append(f"🔍 **Search results for '{query}':**")
            for m in matches:
                lines.append(f"  • {m['name']} ({m['type']}) — {m['lat']:.4f}°N, {m['lon']:.4f}°E")
        else:
            lines.append(f"No markers found matching '{query}'. Try with a broader term.")
    else:
        # Return overview
        lines.append("🗺️ **Indian Ocean Fishing Zones:**")
        for z in OCEAN_ZONES:
            lines.append(f"  • {z['name']}: {z['description']}")
        lines.append(f"\n  Total harbors/markets: {len(FISHING_MARKERS)}")
        lines.append(f"  Known restricted areas: {len(RESTRICTED_AREAS)}")

    return "\n".join(lines) if lines else "No map data available."
