from ._llm import ask
from utils.severity_config import get as get_sev

COLOR = "#3b82f6"


def _get_rag_context(terms):
    try:
        from src.rag.retriever import retrieve_context
        return retrieve_context(terms)
    except Exception:
        return ("", [])


def run(state):
    sev = int(getattr(state, "severity", 3) or 3)
    cfg = get_sev(sev)
    options = cfg["intervention_options"]
    fallback = f"[sev {sev} · {cfg['label']}] Ranked options: " + " | ".join(options)

    context, refs = _get_rag_context(["signal phase", "lane closure", "speed"])
    state.__dict__["_last_policy_refs"] = refs

    prompt = (
        (f"Relevant policy context:\n{context}\n\n" if context else "")
        + f"You are a traffic intervention planner. Severity {sev}/5 ({cfg['label']}). "
        f"In 1 short sentence, rank these options from best to worst and give a "
        f"3-word reason for the top pick: " + " | ".join(options)
    )
    text = ask(prompt, fallback)
    if refs:
        text = f"{text} [refs: {', '.join(refs)}]"
    state.push_message("InterventionAgent", text, COLOR)
    return state
