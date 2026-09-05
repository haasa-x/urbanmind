from datetime import datetime
from .severity_config import get as get_sev


_FIRE_KEYWORDS = ("fire", "smoke", "hazmat", "chemical spill", "burn", "flame", "blaze")


def _is_fire_incident(incident_type: str, message_context: str = "") -> bool:
    if (incident_type or "").lower() in {"fire", "hazmat"}:
        return True
    lowered = (message_context or "").lower()
    return any(k in lowered for k in _FIRE_KEYWORDS)


class AlertDispatcher:
    @staticmethod
    def dispatch(incident_type: str, severity: int, location: str, selected_hospital: dict = None, severity_override: int = None, severity_kw: int = None, description: str = "", **kwargs):
        # allow ``severity=`` kwarg via **kwargs
        sev = kwargs.get("severity", severity)
        try:
            sev = int(sev)
        except Exception:
            sev = int(severity or 3)
        cfg = get_sev(sev)
        allowed = set(cfg["departments_alerted"])
        # Fire override: whenever incident type or description signals fire/hazmat,
        # Fire Department must be alerted regardless of severity.
        context_blob = " ".join(str(x) for x in (description, location, incident_type) if x)
        fire_forced = _is_fire_incident(incident_type, context_blob)
        if fire_forced:
            allowed.add("Fire")
        hospital_name = (selected_hospital or {}).get("name", "Manipal Hospital HAL")
        eta = (selected_hospital or {}).get("eta_from_J1", cfg["clearance_eta_minutes"])
        ts = datetime.utcnow().isoformat()
        label = cfg["label"]
        fire_msg = (
            f"[{label}] Fire Department: engine dispatched to {location} for {incident_type}. "
            f"Hydraulic tools + hazmat kit recommended."
            if fire_forced else
            f"[{label}] Rescue unit requested at {location} for {incident_type}. Hydraulic tools recommended."
        )
        all_alerts = [
            {
                "department": "Traffic Police",
                "icon": "🚔",
                "message": f"[{label}] Dispatch to {location}: {incident_type} sev {sev}. {cfg['units_deployed']} units deployed; divert inbound traffic.",
                "timestamp": ts,
            },
            {
                "department": "Hospital",
                "icon": "🏥",
                "message": f"[{label}] Standby trauma bay at {hospital_name}. Ambulance ETA {eta} min from {location}.",
                "timestamp": ts,
            },
            {
                "department": "Fire",
                "icon": "🚒",
                "message": fire_msg,
                "timestamp": ts,
            },
            {
                "department": "Public",
                "icon": "📱",
                "message": f"[{label}] Advisory: Avoid {location}. Estimated clearance {cfg['clearance_eta_minutes']} min. Use alternate route.",
                "timestamp": ts,
            },
            {
                "department": "BBMP",
                "icon": "🏛",
                "message": f"[{label}] Sanitation and debris crew on standby for {location} post-clearance.",
                "timestamp": ts,
            },
        ]
        return [a for a in all_alerts if a["department"] in allowed]
