from utils.causal_graph import PROPAGATION_WEIGHTS

COLOR = "#f59e0b"


def run(state):
    incident = state.__dict__.get("_incident", {})
    j = incident.get("junction")
    if not j:
        return state
    downstream = PROPAGATION_WEIGHTS.get(j, {})
    lines = [f"{k} in T+{v}min" for k, v in downstream.items()]
    state.push_message(
        "PredictionAgent",
        f"Cascade forecast: {', '.join(lines) if lines else 'contained'}. Horizon T+5/15/30min.",
        COLOR,
    )
    return state
