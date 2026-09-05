"""SupervisingAgent: protocol classification accuracy + macro-F1 + confusion matrix."""
import json
import time
from types import SimpleNamespace

from _common import load_gold, confusion_matrix, prf_from_confusion, summary_stats

from agents import supervisor
from utils.city_state import CityState


def _mk_state(gold):
    st = CityState()
    st.severity = gold["severity_expected"]
    st.__dict__["_incident"] = {
        "type": gold["incident_type_expected"],
        "junction": "J1",
        "severity": gold["severity_expected"],
        "is_accident": gold["incident_type_expected"] == "accident",
    }
    st.__dict__["_parsed_custom"] = {
        "description": gold["description"],
        "incident_type": gold["incident_type_expected"],
        "injury_indicators": "injur" in gold["description"].lower(),
    }
    return st


def run():
    gold = load_gold()
    y_true, y_pred, latencies = [], [], []
    per_case = []

    for g in gold:
        st = _mk_state(g)
        t0 = time.perf_counter()
        try:
            supervisor.run(st)
            plan = st.__dict__.get("_supervisor_plan", {})
            pred = plan.get("sequence_key") or "congestion"
        except Exception as e:
            pred = f"error:{type(e).__name__}"
        dt_ms = (time.perf_counter() - t0) * 1000
        latencies.append(dt_ms)
        y_true.append(g["protocol_expected"])
        y_pred.append(pred)
        per_case.append({"id": g["id"], "expected": g["protocol_expected"], "predicted": pred, "latency_ms": round(dt_ms, 1)})

    labels = sorted(set(y_true) | set(y_pred))
    cm_labels, cm = confusion_matrix(y_true, y_pred, labels)
    per_label, macro, micro = prf_from_confusion(cm_labels, cm)

    correct = sum(1 for a, b in zip(y_true, y_pred) if a == b)
    accuracy = correct / len(gold) if gold else 0.0

    return {
        "component": "SupervisingAgent",
        "n": len(gold),
        "accuracy": accuracy,
        "macro": macro,
        "micro": micro,
        "per_label": per_label,
        "confusion_matrix": {"labels": cm_labels, "matrix": cm},
        "latency_ms": summary_stats(latencies),
        "cases": per_case,
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
