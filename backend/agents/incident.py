from ._llm import ask
from utils.causal_graph import get_spillover_predictions
from utils.severity_config import get as get_sev

COLOR = "#f59e0b"


def run(state):
    density = state.density
    hot = [j for j, v in density.items() if v > 0.75]
    sev = int(getattr(state, "severity", 3) or 3)
    cfg = get_sev(sev)
    if hot:
        j = hot[0]
        spillover = get_spillover_predictions(j, density)
        spillover_ids = ", ".join(s["junction"] for s in spillover) or "none"
        fallback = (
            f"[{cfg['label']} · sev {sev}] INCIDENT_CONFIRMED at {j}: severity {sev}/5, "
            f"clearance ETA {cfg['clearance_eta_minutes']}min. Spillover: {spillover_ids}."
        )
        prompt = (
            f"You are an autonomous traffic incident classifier. Severity {sev}/5 "
            f"labelled {cfg['label']} (color {cfg['color']}). In 1 short sentence, "
            f"describe an incident at junction {j} with density {density[j]:.2f}, "
            f"clearance ETA {cfg['clearance_eta_minutes']}min, spillover to {spillover_ids}. "
            f"Prefix with '[{cfg['label']} · sev {sev}]'. Terse cyberpunk sysop tone."
        )
        state.push_message("IncidentAgent", ask(prompt, fallback), COLOR)
        state.__dict__["_incident"] = {
            "junction": j,
            "severity": sev,
            "type": "accident" if cfg.get("is_accident") else "congestion",
            "lanes": 2,
            "eta": cfg["clearance_eta_minutes"],
            "spillover": spillover,
            "is_accident": bool(cfg.get("is_accident")),
            "severity_label": cfg["label"],
            "severity_color": cfg["color"],
        }
    else:
        state.push_message(
            "IncidentAgent",
            f"[{cfg['label']} · sev {sev}] Monitoring nominal traffic flow across all junctions.",
            COLOR,
        )
        state.__dict__["_incident"] = {"is_accident": False, "severity": sev}
    return state
