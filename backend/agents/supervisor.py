"""SupervisingAgent — chooses which downstream agent sequence should run.

Uses Groq (via ._llm.ask) to pick one of the five allowed sequences based on
the incident context already populated by IncidentAgent. Falls back to a
deterministic default when the LLM output cannot be parsed.
"""
import json
import re

from ._llm import ask


ALLOWED_AGENT_SEQUENCES = {
    "congestion": [
        "IncidentAgent", "PredictionAgent", "ConstraintAgent",
        "InterventionAgent", "CommsAgent",
    ],
    "minor_accident": [
        "IncidentAgent", "PredictionAgent", "ConstraintAgent",
        "InterventionAgent", "PoliceAgent", "CommsAgent",
    ],
    "major_accident": [
        "IncidentAgent", "PredictionAgent", "ConstraintAgent",
        "InterventionAgent", "PoliceAgent", "EMSAgent",
        "HospitalRoutingAgent", "EmergencyCorridorAgent", "CommsAgent",
    ],
    "fire_hazmat": [
        "IncidentAgent", "ConstraintAgent", "PoliceAgent", "EMSAgent",
        "HospitalRoutingAgent", "EmergencyCorridorAgent", "CommsAgent",
    ],
    "medical_emergency": [
        "IncidentAgent", "EMSAgent", "HospitalRoutingAgent",
        "EmergencyCorridorAgent", "CommsAgent",
    ],
}

COLOR = "#a78bfa"


def _parse_json(text: str):
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


def _default_key(incident: dict, severity: int) -> str:
    itype = str(incident.get("type") or "").lower()
    if "fire" in itype or "hazmat" in itype:
        return "fire_hazmat"
    if "medical" in itype:
        return "medical_emergency"
    if incident.get("is_accident") or severity >= 4:
        return "major_accident" if severity >= 4 else "minor_accident"
    return "congestion"


def run(state):
    incident = state.__dict__.get("_incident", {}) or {}
    parsed_custom = state.__dict__.get("_parsed_custom", {}) or {}
    severity = int(getattr(state, "severity", 3) or 3)

    ctx = {
        "severity": severity,
        "incident_type": incident.get("type"),
        "is_accident": bool(incident.get("is_accident")),
        "junction": incident.get("junction"),
        "custom": {
            "description": parsed_custom.get("description"),
            "incident_type": parsed_custom.get("incident_type"),
            "injury_indicators": parsed_custom.get("injury_indicators"),
        },
    }
    keys = list(ALLOWED_AGENT_SEQUENCES.keys())
    fallback_key = _default_key(incident, severity)
    fallback = json.dumps({
        "sequence_key": fallback_key,
        "reasoning": "default heuristic based on severity/type",
        "priority_level": "HIGH" if severity >= 4 else ("MEDIUM" if severity == 3 else "LOW"),
    })

    prompt = (
        "You are the SupervisingAgent orchestrating downstream response agents. "
        "Pick ONE sequence key from this set: " + ", ".join(keys) + ". "
        "Reply with a single JSON object only (no prose), with keys: "
        "sequence_key (string, one of the set), reasoning (short string, <=120 chars), "
        "priority_level (one of LOW|MEDIUM|HIGH|CRITICAL).\n"
        f"Incident context: {json.dumps(ctx)}\nJSON:"
    )
    raw = ask(prompt, fallback)
    parsed = _parse_json(raw) or {}

    key = str(parsed.get("sequence_key") or "").strip().lower()
    if key not in ALLOWED_AGENT_SEQUENCES:
        key = fallback_key if fallback_key in ALLOWED_AGENT_SEQUENCES else "congestion"

    reasoning = str(parsed.get("reasoning") or "default heuristic")
    priority = str(parsed.get("priority_level") or ("HIGH" if severity >= 4 else "MEDIUM"))
    sequence = list(ALLOWED_AGENT_SEQUENCES[key])

    state.__dict__["_supervisor_plan"] = {
        "sequence_key": key,
        "sequence": sequence,
        "reasoning": reasoning,
        "priority_level": priority,
    }
    state.push_message(
        "SupervisingAgent",
        f"Activating {key.upper()} protocol · agents: {', '.join(sequence)} · priority {priority}",
        COLOR,
    )
    return state
