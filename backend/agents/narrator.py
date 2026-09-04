from ._llm import ask

COLOR = "#8b5cf6"


def run(state):
    incident = state.__dict__.get("_incident", {})
    j = incident.get("junction", "J1")
    sev = incident.get("severity", 0)
    op = ask(
        f"Two-sentence technical operator update for accident at {j} severity {sev}, corridor override active.",
        f"Corridor override active for {j}; policy R-14B invoked. Green-wave path J1->J5->J3 clear, ambulance ETA within SLA.",
    )
    pub = ask(
        f"One-sentence calming public advisory for closure near {j}.",
        f"Emergency crews are clearing {j}; please use alternate routes for ~20 minutes. Thank you for your patience.",
    )
    aud = ask(
        f"Formal audit log entry for accident at {j} severity {sev}.",
        f"AUDIT: Incident {j} sev {sev} handled per R-14B/R-22C. Interventions logged; hospital corridor engaged.",
    )
    state.narrator_outputs = {"operator": op, "public": pub, "audit": aud}
    state.push_message("CommsAgent", "Narratives generated (operator/public/audit).", COLOR)
    return state
