"""OSRM public-API router + Nominatim geocoder.

All network calls go through this module so the frontend never talks to the
public services directly (rate-limits, User-Agent policy, etc).
"""
import httpx
import asyncio

OSRM_BASE = "https://router.project-osrm.org"
NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
USER_AGENT = "UrbanMind/2.0 hackathon@nhce.edu"


def _convert_geometry(coords):
    # OSRM returns [lng, lat]; frontend uses [lat, lng]
    return [[c[1], c[0]] for c in coords]


def _parse_steps(legs):
    steps = []
    for leg in legs or []:
        for st in leg.get("steps", []) or []:
            man = st.get("maneuver", {}) or {}
            name = st.get("name") or ""
            mtype = man.get("type", "")
            modifier = man.get("modifier", "")
            instruction = " ".join(x for x in [mtype, modifier, ("onto " + name) if name else ""] if x).strip()
            steps.append({
                "instruction": instruction or "continue",
                "distance_m": st.get("distance", 0),
                "duration_s": st.get("duration", 0),
                "name": name,
            })
    return steps


async def get_route(origin_lat: float, origin_lon: float,
                    dest_lat: float, dest_lon: float,
                    alternatives: bool = True) -> dict:
    url = (
        f"{OSRM_BASE}/route/v1/driving/"
        f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        f"?overview=full&geometries=geojson&alternatives={'true' if alternatives else 'false'}&steps=true"
    )
    async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT}) as client:
        r = await client.get(url)
        r.raise_for_status()
        data = r.json()

    routes = data.get("routes", []) or []
    if not routes:
        return {"primary": None, "alternatives": [], "error": "no routes"}

    def _pack(rt):
        return {
            "geometry": _convert_geometry(rt.get("geometry", {}).get("coordinates", [])),
            "distance_km": round(rt.get("distance", 0) / 1000.0, 3),
            "duration_min": round(rt.get("duration", 0) / 60.0, 2),
            "eta_minutes": round(rt.get("duration", 0) / 60.0, 2),
            "steps": _parse_steps(rt.get("legs", [])),
        }

    primary = _pack(routes[0])
    alts = [_pack(rt) for rt in routes[1:]]
    return {"primary": primary, "alternatives": alts}


async def geocode(query: str):
    """Nominatim geocode — respects the 1-req/sec policy."""
    await asyncio.sleep(1.1)
    url = f"{NOMINATIM_BASE}/search"
    params = {"q": query, "format": "json", "limit": 1, "countrycodes": "in"}
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
        r = await client.get(url, params=params)
        if r.status_code != 200:
            return None
        j = r.json()
    if not j:
        return None
    top = j[0]
    return {
        "lat": float(top["lat"]),
        "lng": float(top["lon"]),
        "display": top.get("display_name", query),
    }


# ----- Pre-cached routes for reliable demo playback -----
PRE_CACHED_ROUTES = {
    "J1_to_manipal": {
        "geometry": [
            [12.9172, 77.6224],  # Silk Board (J1)
            [12.9250, 77.6280],
            [12.9350, 77.6350],
            [12.9450, 77.6420],
            [12.9550, 77.6480],
            [12.9650, 77.6520],
            [12.9720, 77.6560],  # Manipal Hospital (HAL / Old Airport Rd)
        ],
        "distance_km": 8.4,
        "duration_min": 14.5,
        "eta_minutes": 14.5,
        "steps": [
            {"instruction": "depart onto Hosur Road", "distance_m": 1200, "duration_s": 180, "name": "Hosur Road"},
            {"instruction": "turn left onto Inner Ring Road", "distance_m": 3500, "duration_s": 420, "name": "Inner Ring Road"},
            {"instruction": "continue onto HAL Old Airport Road", "distance_m": 2800, "duration_s": 300, "name": "HAL Old Airport Road"},
            {"instruction": "arrive at Manipal Hospital", "distance_m": 900, "duration_s": 90, "name": "Manipal Hospital"},
        ],
        "cached": True,
        "label": "Silk Board (J1) → Manipal Hospital (HAL)",
    },
}


def get_cached_route(route_key: str):
    return PRE_CACHED_ROUTES.get(route_key)
