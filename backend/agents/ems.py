"""EMSAgent — Mode 1 dispatch, Mode 2 field assessment summariser."""
import json
import re

from ._llm import ask

COLOR = "#22d3ee"


def _get_rag_context(terms):
    try:
        from src.rag.retriever import retrieve_context
        return retrieve_context(terms)
    except Exception:
        return ("", [])


def _parse_json(text: str):
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


def _dispatch_default(severity: int, incident: dict) -> dict:
    if severity >= 5:
        amb = 3
    elif severity >= 4:
        amb = 2
    else:
        amb = 1
    itype = str(incident.get("type") or "").lower()
    if "fire" in itype or "hazmat" in itype:
        capability = "burn_unit"
    elif "medical" in itype or "cardiac" in itype:
        capability = "cardiac"
    elif incident.get("is_accident") or "accident" in itype:
        capability = "trauma"
    else:
        capability = "emergency"
    return {
        "ambulances_required": amb,
        "ems_priority": "P1" if severity >= 4 else ("P2" if severity == 3 else "P3"),
        "required_medical_capability": capability,
        "estimated_scene_time": max(6, 4 + severity * 2),
    }


def run(state):
    ctx, refs = _get_rag_context(
        ["ambulance", "dispatch", "triage", "hospital", "handover", "corridor"]
    )
    incident = state.__dict__.get("_incident", {}) or {}
    severity = int(getattr(state, "severity", 3) or 3)
    fallback = _dispatch_default(severity, incident)

    injury_hint = state.__dict__.get("_parsed_custom", {}).get("injury_indicators")

    prompt = (
        (f"Policy context:\n{ctx}\n\n" if ctx else "")
        + "You are the EMSAgent (dispatch mode). Reply with a single JSON object only "
        "(no prose), keys: ambulances_required (int), ems_priority (P1|P2|P3), "
        "required_medical_capability (one of: trauma, cardiac, burn_unit, emergency), "
        "estimated_scene_time (int minutes).\n"
        f"Severity: {severity}/5. Incident: {json.dumps(incident)}. "
        f"Injury indicators from field: {injury_hint}.\nJSON:"
    )
    raw = ask(prompt, json.dumps(fallback))
    parsed = _parse_json(raw)
    if not isinstance(parsed, dict):
        parsed = fallback
    out = dict(fallback)
    for k in ("ems_priority", "required_medical_capability"):
        if isinstance(parsed.get(k), str):
            out[k] = parsed[k]
    for k in ("ambulances_required", "estimated_scene_time"):
        try:
            out[k] = int(parsed.get(k, out[k]))
        except Exception:
            pass

    state.__dict__["_ems_dispatch"] = out
    state.push_message(
        "EMSAgent",
        f"Dispatching {out['ambulances_required']} ambulance(s), priority "
        f"{out['ems_priority']}, capability required: {out['required_medical_capability']}",
        COLOR,
    )
    return state


def assess(raw_assessment_text: str, incident_id: str = None) -> dict:
    """Mode 2 — summarise a field medical attendant's raw notes.

    Instructs the model NEVER to fabricate diagnoses; only summarise observations.
    Returns a strict schema; falls back to deterministic defaults on parse failure.
    """
    raw = (raw_assessment_text or "").strip()
    fallback = {
        "condition_summary": raw[:200] or "no assessment provided",
        "consciousness_level": "unknown",
        "injury_summary": "unspecified",
        "recommended_preparations": "standard emergency bay",
        "specialty_needed": "general",
    }
    if not raw:
        return fallback

    prompt = (
        "You are the EMSAgent operating in MEDICAL ASSESSMENT mode. "
        "You are summarising a field attendant's raw notes for the receiving hospital. "
        "CRITICAL: NEVER invent diagnoses, vitals, medications or conditions the notes "
        "do not describe. Only summarise what is observed. If unsure, say 'unknown' "
        "or 'unspecified'.\n"
        "Reply with a single JSON object only (no prose), keys: "
        "condition_summary (short string), consciousness_level (string; e.g. alert, "
        "responsive to voice, unresponsive, unknown), injury_summary (short string), "
        "recommended_preparations (short string; equipment/bay type), "
        "specialty_needed (one of: trauma, cardiac, burn, general).\n"
        f"Raw field notes (incident_id={incident_id}): {raw}\nJSON:"
    )
    text = ask(prompt, json.dumps(fallback))
    parsed = _parse_json(text)
    if not isinstance(parsed, dict):
        return fallback
    out = dict(fallback)
    for k in ("condition_summary", "consciousness_level", "injury_summary",
              "recommended_preparations", "specialty_needed"):
        if isinstance(parsed.get(k), str) and parsed[k].strip():
            out[k] = parsed[k].strip()
    spec = out["specialty_needed"].lower()
    if spec not in ("trauma", "cardiac", "burn", "general"):
        spec = "general"
    out["specialty_needed"] = spec
    return out
