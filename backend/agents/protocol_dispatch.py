from utils.alert_dispatcher import AlertDispatcher
from utils.severity_config import get as get_sev

COLOR = "#ec4899"


def run(state):
    sev = int(getattr(state, "severity", 3) or 3)
    if sev < 4:
        return state
    incident = state.__dict__.get("_incident", {})
    if not incident.get("is_accident") and sev < 4:
        return state
    cfg = get_sev(sev)
    alerts = AlertDispatcher.dispatch(
        incident.get("type", "accident"),
        incident.get("severity", sev),
        incident.get("junction", "J1"),
        state.selected_hospital,
        severity=sev,
    )
    for a in alerts:
        state.push_alert(a["department"], a["message"], a["icon"])
    state.protocol_active = True
    state.push_message(
        "ProtocolDispatchAgent",
        f"[sev {sev} · {cfg['label']}] Dispatched {len(alerts)} alerts to {', '.join(cfg['departments_alerted'])}.",
        COLOR,
    )
    return state
