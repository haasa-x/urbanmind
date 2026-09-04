COLOR = "#10b981"

POI = {
    "J1": {"schools": 2, "hospitals": 1, "malls": 3},
    "J2": {"schools": 3, "hospitals": 0, "malls": 1},
    "J3": {"schools": 1, "hospitals": 2, "malls": 2},
    "J4": {"schools": 4, "hospitals": 1, "malls": 5},
    "J5": {"schools": 2, "hospitals": 0, "malls": 1},
}


def run(state):
    incident = state.__dict__.get("_incident", {})
    j = incident.get("junction", "J1")
    p = POI.get(j, {"schools": 1, "hospitals": 1, "malls": 1})
    score = max(0, 100 - (p["schools"] * 8 + p["hospitals"] * 5 + p["malls"] * 3) - incident.get("severity", 0) * 4)
    state.push_message(
        "SafetyAgent",
        f"Safety score at {j}: {score}/100. Nearby: {p['schools']} schools, {p['hospitals']} hospitals, {p['malls']} malls.",
        COLOR,
    )
    return state
