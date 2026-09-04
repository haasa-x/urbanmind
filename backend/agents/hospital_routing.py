"""HospitalRoutingAgent — capability-first hospital selection.

Loads the hospital roster from backend/data/hospitals.json on import. Picks the
nearest hospital whose capability flags satisfy the required_capability, with
graceful fallbacks (trauma > emergency).
"""
import json
from pathlib import Path
from typing import Optional

from utils.causal_graph import DEFAULT_ORIGIN

COLOR = "#06b6d4"

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "hospitals.json"

try:
    with _DATA_PATH.open("r") as fh:
        HOSPITALS = json.load(fh)
except Exception:
    HOSPITALS = []


def _get_rag_context(terms):
    try:
        from src.rag.retriever import retrieve_context
        return retrieve_context(terms)
    except Exception:
        return ("", [])


_CAPABILITY_FLAG = {
    "trauma": "trauma",
    "cardiac": "cardiac",
    "burn": "burn_unit",
    "burn_unit": "burn_unit",
    "icu": "icu",
    "emergency": "emergency",
    "general": "emergency",
}


def _origin_lon(o):
    if "lon" in o:
        return o["lon"]
    return o.get("lng")


def _distance_km(h: dict, origin: dict) -> float:
    olat = origin.get("lat", 0.0)
    olon = _origin_lon(origin) or 0.0
    d2 = (h["lat"] - olat) ** 2 + (h["lon"] - olon) ** 2
    # ~111 km per degree at Bangalore latitude; good enough for city-scale ranking.
    return (d2 ** 0.5) * 111.0


def _normalize_capabilities(caps) -> list:
    """Accept a string or iterable of capability names and normalize to
    unique hospital flag names (e.g. 'trauma', 'cardiac', 'emergency')."""
    if caps is None:
        return []
    if isinstance(caps, str):
        caps = [caps]
    out = []
    for c in caps:
        if not c:
            continue
        flag = _CAPABILITY_FLAG.get(str(c).lower())
        if flag and flag not in out:
            out.append(flag)
    return out


def select_capability_hospital(required_capability, origin: dict) -> Optional[dict]:
    """Pick the nearest hospital that satisfies ALL required capabilities.

    `required_capability` may be a single string (legacy) or an iterable
    of capability names. Falls back progressively: all-match -> any-match ->
    trauma -> emergency -> any hospital.
    """
    if not HOSPITALS:
        return None
    origin = origin or DEFAULT_ORIGIN
    req_flags = _normalize_capabilities(required_capability)
    if not req_flags:
        req_flags = ["emergency"]

    def _matches_all(flags):
        return [h for h in HOSPITALS if all(h.get(f) for f in flags)]

    def _matches_any(flags):
        return [h for h in HOSPITALS if any(h.get(f) for f in flags)]

    pool = _matches_all(req_flags)
    matched_label = ",".join(req_flags)
    if not pool and len(req_flags) > 1:
        pool = _matches_any(req_flags)
        matched_label = "any-of:" + ",".join(req_flags)
    if not pool and "trauma" not in req_flags:
        pool = [h for h in HOSPITALS if h.get("trauma")]
        matched_label = "trauma"
    if not pool:
        pool = [h for h in HOSPITALS if h.get("emergency")]
        matched_label = "emergency"
    if not pool:
        pool = list(HOSPITALS)
        matched_label = "any"

    best = min(pool, key=lambda h: _distance_km(h, origin))
    eta = max(3, round(_distance_km(best, origin) * 1.6))
    return {
        "name": best["name"],
        "lat": best["lat"],
        "lng": best["lon"],
        "trauma": bool(best.get("trauma")),
        "eta_from_J1": int(eta),
        "capability_matched": matched_label,
        "capabilities_required": list(req_flags),
    }


def _collect_required_capabilities(state) -> list:
    """Combine required capabilities from field assessment > EMS dispatch >
    incident type. Field assessment takes precedence but does not clobber the
    others — union them so trauma+cardiac is preserved."""
    caps = []
    assessment = state.__dict__.get("_ems_assessment", {}) or {}
    ems = state.__dict__.get("_ems_dispatch", {}) or {}
    incident = state.__dict__.get("_incident", {}) or {}

    if assessment.get("specialty_needed"):
        caps.append(assessment["specialty_needed"])
    if ems.get("required_medical_capability"):
        caps.append(ems["required_medical_capability"])
    itype = str(incident.get("type") or "").lower()
    if "fire" in itype or "hazmat" in itype:
        caps.append("burn_unit")
    if "cardiac" in itype:
        caps.append("cardiac")
    if incident.get("is_accident") and incident.get("severity", 0) >= 4:
        caps.append("trauma")
    indicators = incident.get("injury_indicators") or []
    if isinstance(indicators, (list, tuple)):
        joined = " ".join(str(x).lower() for x in indicators)
        if "burn" in joined:
            caps.append("burn_unit")
        if "cardiac" in joined or "chest" in joined:
            caps.append("cardiac")
    if not caps:
        caps.append("emergency")
    # Dedup preserving order
    seen, out = set(), []
    for c in caps:
        k = str(c).lower()
        if k not in seen:
            seen.add(k)
            out.append(c)
    return out


def run(state):
    incident = state.__dict__.get("_incident", {}) or {}
    # keep the legacy guard for scripted playback safety
    if not (incident.get("is_accident") or incident.get("severity", 0) >= 4
            or state.__dict__.get("_ems_dispatch") or state.__dict__.get("_ems_assessment")):
        return state
    origin = incident.get("origin") or DEFAULT_ORIGIN
    caps = _collect_required_capabilities(state)
    h = select_capability_hospital(caps, origin)
    if not h:
        return state
    state.selected_hospital = h

    _ctx, refs = _get_rag_context(
        ["hospital", "capability", "trauma", "pre-arrival", "selection", "ranking"]
    )
    state.__dict__["_last_policy_refs"] = refs

    source_bits = []
    if state.__dict__.get("_ems_dispatch"):
        source_bits.append("EMS dispatch")
    if state.__dict__.get("_ems_assessment"):
        source_bits.append("field assessment")
    source_str = " + ".join(source_bits) if source_bits else "incident type"

    text = (f"HOSPITAL SELECTED: {h['name']} — matched capabilities "
            f"[{h['capability_matched']}], ETA {h['eta_from_J1']} min, "
            f"using {source_str}")
    if refs:
        text = f"{text} [refs: {', '.join(refs)}]"
    state.push_message("HospitalRoutingAgent", text, COLOR)
    return state
