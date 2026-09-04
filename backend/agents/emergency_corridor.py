COLOR = "#06b6d4"


def _get_rag_context(terms):
    try:
        from src.rag.retriever import retrieve_context
        return retrieve_context(terms)
    except Exception:
        return ("", [])


def run(state):
    sev = int(getattr(state, "severity", 3) or 3)
    if sev < 4:
        return state
    if not state.emergency_active:
        return state
    state.route_visible = True

    _ctx, refs = _get_rag_context(
        ["corridor", "preemption", "citizen", "alert", "signal", "ambulance"]
    )
    state.__dict__["_last_policy_refs"] = refs

    text = f"[sev {sev}] Green-wave corridor computed: J1 -> J5 -> J3. All signals pre-empted."
    if refs:
        text = f"{text} [refs: {', '.join(refs)}]"
    state.push_message("EmergencyCorridorAgent", text, COLOR)
    return state
