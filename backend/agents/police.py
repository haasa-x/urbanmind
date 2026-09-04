"""PoliceAgent — units, deployment, diversion planning."""
import json
import re

from ._llm import ask

COLOR = "#3b82f6"


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


def _default(severity: int, incident: dict) -> dict:
    if severity >= 5:
        units = 6
    elif severity >= 4:
        units = 4
    elif severity >= 3:
        units = 2
    else:
        units = 1
    j = incident.get("junction") or "incident scene"
    return {
        "units_required": units,
        "deployment_instructions": f"Deploy to {j}; establish 200m perimeter and control flow",
        "suggested_route_closures": [j],
        "diversion_roads": ["ring road", "service lane"],
        "estimated_response_minutes": max(3, 12 - severity * 2),
        "priority_level": "HIGH" if severity >= 4 else ("MEDIUM" if severity == 3 else "LOW"),
    }


def run(state):
    ctx, refs = _get_rag_context(
        ["police", "officer", "deployment", "diversion", "accident", "response"]
    )
    incident = state.__dict__.get("_incident", {}) or {}
    severity = int(getattr(state, "severity", 3) or 3)
    fallback = _default(severity, incident)

    prompt = (
        (f"Policy context:\n{ctx}\n\n" if ctx else "")
        + "You are the PoliceAgent. Reply with a single JSON object only (no prose), keys: "
        "units_required (int), deployment_instructions (string, <=140 chars), "
        "suggested_route_closures (array of strings), diversion_roads (array of strings), "
        "estimated_response_minutes (int), priority_level (LOW|MEDIUM|HIGH|CRITICAL).\n"
        f"Severity: {severity}/5. Incident: {json.dumps(incident)}.\nJSON:"
    )
    raw = ask(prompt, json.dumps(fallback))
    parsed = _parse_json(raw)
    if not isinstance(parsed, dict):
        parsed = fallback
    # coerce
    out = dict(fallback)
    for k in ("deployment_instructions", "priority_level"):
        if isinstance(parsed.get(k), str):
            out[k] = parsed[k]
    for k in ("units_required", "estimated_response_minutes"):
        try:
            out[k] = int(parsed.get(k, out[k]))
        except Exception:
            pass
    for k in ("suggested_route_closures", "diversion_roads"):
        if isinstance(parsed.get(k), list):
            out[k] = [str(x) for x in parsed[k]]

    state.__dict__["_police_assignment"] = out
    ref_tag = refs[0] if refs else "sops"
    state.push_message(
        "PoliceAgent",
        f"{out['units_required']} units dispatched. {out['deployment_instructions']}. [refs: {ref_tag}]",
        COLOR,
    )
    state.push_alert(
        "Traffic Police",
        f"Deploy {out['units_required']} units · priority {out['priority_level']} · ETA {out['estimated_response_minutes']}min",
        "🚔",
    )
    return state
