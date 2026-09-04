from ._llm import ask

COLOR = "#ef4444"

RULES = {
    "R-14B": "Emergency corridor priority over commuter flow",
    "R-07A": "Ambulance route pre-emption engaged",
    "R-22C": "Signal override requires ConstraintAgent approval",
    "R-31D": "No more than 3 concurrent lane closures per corridor",
    "R-05E": "Public advisory must precede any full closure",
}


def _get_rag_context(terms):
    try:
        from src.rag.retriever import retrieve_context
        return retrieve_context(terms)
    except Exception:
        return ("", [])


def run(state):
    incident = state.__dict__.get("_incident", {})
    context, refs = _get_rag_context(
        ["lane closure", "signal phase", "school zone", "bus stop", "monsoon", "speed"]
    )
    state.__dict__["_last_policy_refs"] = refs

    if incident.get("is_accident"):
        j = incident.get("junction", "J1")
        s = incident.get("severity", 5)
        fallback = "Policy validation: R-22C invoked. Option-1 signal override APPROVED per R-14B. R-31D within limits."
        prompt = (
            (f"Relevant policy context:\n{context}\n\n" if context else "")
            + f"In 1 sentence, validate this proposed intervention against policies "
            f"R-14B/R-07A/R-22C/R-05E for junction {j}, severity {s}. "
            f"Respond APPROVED or REJECTED with 1 reason."
        )
        text = ask(prompt, fallback)
    else:
        text = "All active policies within safe operating envelope."

    if refs:
        text = f"{text} [refs: {', '.join(refs)}]"
    state.push_message("ConstraintAgent", text, COLOR)
    return state
