"""
Weather tool — OpenWeatherMap free-tier API.

Provides current weather + 3-hour forecast for a lat/lon.
Formats output for fishermen (wind, waves, rain, sea state).
"""
from __future__ import annotations
from typing import Optional
import httpx
from langchain_core.tools import tool
from src.config.settings import OPENWEATHERMAP_API_KEY


BEAUFORT_DESCRIPTIONS = [
    (0, 0.2, "शांत (Calm)", "Mirror-smooth sea"),
    (0.3, 1.5, "हल्की हवा (Light air)", "Small ripples"),
    (1.6, 3.3, "हल्की बयार (Light breeze)", "Small wavelets"),
    (3.4, 5.4, "मंद बयार (Gentle breeze)", "Large wavelets, some crests"),
    (5.5, 7.9, "तेज़ बयार (Moderate breeze)", "Small waves, frequent whitecaps"),
    (8.0, 10.7, "ताज़ा हवा (Fresh breeze)", "Moderate waves — be cautious!"),
    (10.8, 13.8, "तेज़ हवा (Strong breeze)", "Large waves — avoid deep sea!"),
    (13.9, 17.1, "भारी हवा (Near gale)", "⚠️ Dangerous — return to shore!"),
    (17.2, 100, "तूफ़ान (Gale+)", "🚨 DANGER — DO NOT GO TO SEA!"),
]


def _wind_advisory(speed_ms: float) -> str:
    """Return fishing-relevant wind advisory."""
    for low, high, label, desc in BEAUFORT_DESCRIPTIONS:
        if low <= speed_ms <= high:
            return f"{label} — {desc}"
    return "Unknown"


@tool
async def get_weather(latitude: float, longitude: float, location_name: Optional[str] = None) -> str:
    """
    Get current sea weather and 3-hour forecast for fishing.
    Provide the latitude and longitude of the location.
    Optionally provide a human-readable location name.

    Args:
        latitude: Latitude of the location (e.g. 15.4909 for Goa)
        longitude: Longitude of the location (e.g. 73.8278 for Goa)
        location_name: Optional human-readable place name
    """
    if not OPENWEATHERMAP_API_KEY:
        return "⚠️ Weather API not configured. Please set OPENWEATHERMAP_API_KEY."

    label = location_name or f"{latitude:.2f}°N, {longitude:.2f}°E"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Current weather
            current_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "appid": OPENWEATHERMAP_API_KEY,
                    "units": "metric",
                },
            )
            current_resp.raise_for_status()
            current = current_resp.json()

            # 3-hour forecast (next 4 entries = 12 hours)
            forecast_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "appid": OPENWEATHERMAP_API_KEY,
                    "units": "metric",
                    "cnt": 4,
                },
            )
            forecast_resp.raise_for_status()
            forecast = forecast_resp.json()

    except httpx.HTTPError as e:
        return f"⚠️ Could not fetch weather: {e}"

    # ── Format current conditions ────────────────────────────────────────
    wind_speed = current.get("wind", {}).get("speed", 0)
    wind_deg = current.get("wind", {}).get("deg", 0)
    temp = current["main"]["temp"]
    humidity = current["main"]["humidity"]
    description = current["weather"][0]["description"].title()
    clouds = current.get("clouds", {}).get("all", 0)
    rain_1h = current.get("rain", {}).get("1h", 0)
    visibility = current.get("visibility", 10000) / 1000  # km

    advisory = _wind_advisory(wind_speed)

    lines = [
        f"📍 **{label}** — Current Conditions",
        f"  🌤️ {description}",
        f"  🌡️ Temperature: {temp:.0f}°C | Humidity: {humidity}%",
        f"  💨 Wind: {wind_speed:.1f} m/s ({wind_deg}°) — {advisory}",
        f"  ☁️ Cloud cover: {clouds}% | Visibility: {visibility:.1f} km",
    ]
    if rain_1h > 0:
        lines.append(f"  🌧️ Rain (last 1h): {rain_1h} mm")

    # ── Forecast ─────────────────────────────────────────────────────────
    lines.append("\n📅 **Next 12-Hour Forecast**:")
    for entry in forecast.get("list", []):
        dt_txt = entry.get("dt_txt", "")
        f_temp = entry["main"]["temp"]
        f_wind = entry["wind"]["speed"]
        f_desc = entry["weather"][0]["description"].title()
        f_rain = entry.get("rain", {}).get("3h", 0)
        adv = _wind_advisory(f_wind)
        line = f"  {dt_txt[-8:-3]} — {f_desc}, {f_temp:.0f}°C, Wind {f_wind:.1f}m/s ({adv})"
        if f_rain > 0:
            line += f", Rain {f_rain}mm"
        lines.append(line)

    return "\n".join(lines)
