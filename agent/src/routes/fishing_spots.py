"""
Fishing spots route — directly invokes the get_nearby_fishing_spots tool
and returns the structured JSON to the frontend for map rendering.

  GET /fishing-spots?lat=X&lon=Y&radius_km=50
"""
from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from src.utils.auth import TokenPayload, verify_token
from src.tools.fishing_spots import get_nearby_fishing_spots

router = APIRouter()


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
