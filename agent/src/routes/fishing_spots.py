"""
Fishing spots route - two endpoints:

  GET /fishing-spots              → plain JSON (legacy)
  GET /fishing-spots/stream       → SSE stream with progress + final result

SSE event types
───────────────
  data: {"type":"progress","stage":"scan","message":"...","pct":N}
  data: {"type":"result","spots":[...],"summary":"...","total_bodies_found":N}
  data: {"type":"error","error":"..."}
  data: {"type":"cancelled"}
"""
from __future__ import annotations

import asyncio
import json
import math
import httpx
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from boto3.dynamodb.conditions import Attr, Key

from src.utils.auth import TokenPayload, verify_token
from src.tools.fishing_spots import (
    get_nearby_fishing_spots,
    _fetch_overpass_bodies,
    _fetch_chlorophyll_score,
    _fetch_gemini_web_score,
    _sample_geometry_points,
    _haversine,
    _fish_density_score,
    _combined_density,
    _weather_score,
    _transport_score,
    _confidence_color,
)
from src.config.settings import OPENWEATHERMAP_API_KEY, IMAGES_TABLE
from src.utils.dynamodb import dynamodb

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


def _prog(stage: str, message: str, pct: int) -> str:
    return _sse({"type": "progress", "stage": stage, "message": message, "pct": pct})


# ── plain JSON endpoint (unchanged) ──────────────────────────────────────────

@router.get("")
async def get_fishing_spots(
    lat: float = Query(..., description="User latitude"),
    lon: float = Query(..., description="User longitude"),
    radius_km: float = Query(50.0, description="Search radius in km"),
    user: TokenPayload = Depends(verify_token),
):
    """Return scored fishing spots as structured JSON for map rendering."""
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    if not (1 <= radius_km <= 200):
        raise HTTPException(status_code=400, detail="radius_km must be between 1 and 200")

    result_str = await get_nearby_fishing_spots.ainvoke({
        "latitude": lat,
        "longitude": lon,
        "radius_km": radius_km,
    })

    try:
        data = json.loads(result_str)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=500, detail="Tool returned invalid JSON")

    return data


# ── SSE streaming endpoint ────────────────────────────────────────────────────

@router.get("/stream")
async def stream_fishing_spots(
    request: Request,
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(50.0),
    user: TokenPayload = Depends(verify_token),
):
    """
    SSE stream that runs the full fishing-spots scan step by step and emits
    progress events so the client can display a live DEEP SCAN animation.
    Aborts cleanly when the client closes the connection.
    """
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    if not (1 <= radius_km <= 200):
        raise HTTPException(status_code=400, detail="radius_km must be between 1 and 200")

    async def generate() -> AsyncIterator[str]:
        cancelled = False

        async def is_cancelled() -> bool:
            return await request.is_disconnected()

        try:
            # ── Stage 1: Initialising ──────────────────────────────────────
            yield _prog("init", "Initialising deep scan engine...", 2)
            await asyncio.sleep(0.3)

            if await is_cancelled():
                yield _sse({"type": "cancelled"})
                return

            yield _prog("init", "Linking up with satellite data feeds...", 5)
            await asyncio.sleep(0.4)

            # ── Stage 2: OSM / Overpass ───────────────────────────────────
            yield _prog("osm", " Scanning OpenStreetMap for water bodies...", 8)
            radius_m = int((radius_km or 50) * 1000)
            bodies = await _fetch_overpass_bodies(lat, lon, radius_m)

            if await is_cancelled():
                yield _sse({"type": "cancelled"})
                return

            if not bodies:
                yield _sse({"type": "error", "error": "No water bodies found in your area. Try increasing the radius."})
                return

            yield _prog("osm", f"Detected {len(bodies)} water bodies · sub-sampling key zones...", 18)
            await asyncio.sleep(0.2)

            # ── Stage 3: Catch history from DynamoDB ──────────────────────
            yield _prog("history", "Pulling historical catch records from database...", 22)
            now_utc = datetime.now(timezone.utc)
            catch_markers: list[dict] = []
            try:
                table = dynamodb.Table(IMAGES_TABLE)
                resp = table.query(
                    IndexName="status-createdAt-index",
                    KeyConditionExpression=Key("status").eq("completed"),
                    FilterExpression=Attr("latitude").exists() & Attr("longitude").exists(),
                    ProjectionExpression="latitude, longitude, createdAt",
                    ScanIndexForward=False,
                    Limit=500,
                )
                for item in resp.get("Items", []):
                    try:
                        m_lat, m_lon = float(item["latitude"]), float(item["longitude"])
                        if not (math.isfinite(m_lat) and math.isfinite(m_lon)):
                            continue
                        days_ago = 365
                        created = item.get("createdAt", "")
                        if created:
                            try:
                                ts = datetime.fromisoformat(created.replace("Z", "+00:00"))
                                days_ago = max(0, (now_utc - ts).days)
                            except ValueError:
                                pass
                        catch_markers.append({"lat": m_lat, "lon": m_lon, "days_ago": days_ago})
                    except (TypeError, ValueError):
                        continue
            except Exception:
                pass  # Non-fatal

            if await is_cancelled():
                yield _sse({"type": "cancelled"})
                return

            yield _prog("history", f"Loaded {len(catch_markers)} catch records · applying recency weights...", 28)
            await asyncio.sleep(0.2)

            # ── Stage 4: Per-body scoring ─────────────────────────────────
            bodies_sorted = sorted(
                bodies,
                key=lambda b: _haversine(lat, lon, b["centroid_lat"], b["centroid_lon"]),
            )[:10]

            all_spots: list[dict] = []
            stage_base = 30
            stage_range = 55  # pct span across all bodies

            async with httpx.AsyncClient(timeout=14) as client:
                for i, body in enumerate(bodies_sorted):
                    if await is_cancelled():
                        yield _sse({"type": "cancelled"})
                        return

                    body_name = body["name"]
                    c_lat, c_lon = body["centroid_lat"], body["centroid_lon"]
                    pct = stage_base + int((i / len(bodies_sorted)) * stage_range)

                    yield _prog(
                        "scan",
                        f"Scanning «{body_name}»...",
                        pct,
                    )

                    # Weather
                    weather_s = 50.0
                    if OPENWEATHERMAP_API_KEY:
                        try:
                            wr = await client.get(
                                "https://api.openweathermap.org/data/2.5/weather",
                                params={"lat": c_lat, "lon": c_lon,
                                        "appid": OPENWEATHERMAP_API_KEY, "units": "metric"},
                            )
                            if wr.status_code == 200:
                                wd = wr.json()
                                weather_s = _weather_score(
                                    wd.get("wind", {}).get("speed", 5),
                                    wd.get("rain", {}).get("1h", 0),
                                    wd.get("clouds", {}).get("all", 50),
                                )
                                yield _prog(
                                    "scan",
                                    f"Checking weather conditions at {body_name}...",
                                    pct + 2,
                                )
                        except Exception:
                            pass

                    if await is_cancelled():
                        yield _sse({"type": "cancelled"})
                        return

                    # Chlorophyll
                    yield _prog("scan", f"Analyzing water quality and food sources at {body_name}...", pct + 3)
                    chl_score = await _fetch_chlorophyll_score(client, c_lat, c_lon)
                    if chl_score is not None:
                        yield _prog(
                            "scan",
                            f"Water quality analysis complete for {body_name}",
                            pct + 4,
                        )

                    if await is_cancelled():
                        yield _sse({"type": "cancelled"})
                        return

                    # Gemini web score
                    yield _prog("scan", f"Gathering local fishing reports for {body_name}...", pct + 5)
                    web_score = await _fetch_gemini_web_score(client, body_name, c_lat, c_lon)

                    # Sub-points
                    sub_points = _sample_geometry_points(
                        body["geometry"], body_name, body["water_type"], n_sub=3
                    )

                    for pt in sub_points:
                        dist = _haversine(lat, lon, pt["lat"], pt["lon"])
                        transport_s = _transport_score(dist)
                        dynamo_s = _fish_density_score(pt["lat"], pt["lon"], catch_markers)
                        fish_s = _combined_density(chl_score, dynamo_s, web_score)
                        confidence = round(fish_s * 0.60 + weather_s * 0.25 + transport_s * 0.15, 1)
                        color = _confidence_color(confidence)

                        all_spots.append({
                            "name": pt["name"],
                            "parent_water_body": pt["parent_name"],
                            "latitude": round(pt["lat"], 6),
                            "longitude": round(pt["lon"], 6),
                            "type": pt["type"],
                            "is_sub_point": pt["is_sub"],
                            "distance_km": round(dist, 1),
                            "weather_score": round(weather_s, 1),
                            "fish_density_score": round(fish_s, 1),
                            "transport_score": round(transport_s, 1),
                            "chlorophyll_available": chl_score is not None,
                            "gemini_web_score": round(web_score, 1) if web_score is not None else None,
                            "confidence": confidence,
                            "color": color,
                        })

            if await is_cancelled():
                yield _sse({"type": "cancelled"})
                return

            # ── Stage 5: Finalising ───────────────────────────────────────
            yield _prog("finalise", "⚡  Ranking and filtering spots by confidence...", 88)
            await asyncio.sleep(0.2)

            all_spots.sort(key=lambda s: s["confidence"], reverse=True)
            top = all_spots[:20]

            yield _prog("finalise", "🗂️  Building scan report...", 94)
            await asyncio.sleep(0.2)

            green = sum(1 for s in top if s["color"] == "#10b981")
            amber = sum(1 for s in top if s["color"] == "#f59e0b")
            red   = sum(1 for s in top if s["color"] == "#ef4444")
            summary = (
                f"Deep scan complete - {len(top)} spots scored across "
                f"{len(bodies_sorted)} water bodies. "
                f"{green} excellent · {amber} moderate · {red} low confidence."
            )

            yield _prog("done", "Deep scan complete. Mapping results...", 100)

            yield _sse({
                "type": "result",
                "spots": top,
                "summary": summary,
                "total_bodies_found": len(bodies),
                "user_location": {"lat": lat, "lon": lon},
            })

        except asyncio.CancelledError:
            yield _sse({"type": "cancelled"})
        except Exception as exc:
            yield _sse({"type": "error", "error": str(exc)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
