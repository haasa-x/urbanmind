"""End-to-end pipeline latency: measure agent_graph.invoke on every gold incident.

Reports p50 / p90 / p99 wall-clock, per-agent contribution, and total throughput
in incidents / minute."""
import json
import time

from _common import load_gold, summary_stats

from agents.graph import agent_graph
from utils.city_state import CityState


def _seed(g):
    st = CityState()
    st.severity = g["severity_expected"]
    st.density["J1"] = 0.90 if g["severity_expected"] >= 4 else 0.7
    st.__dict__["_parsed_custom"] = {
        "description": g["description"],
        "incident_type": g["incident_type_expected"],
        "injury_indicators": "injur" in g["description"].lower(),
    }
    return st


def run():
    gold = load_gold()
    totals = []
    per_case = []

    for g in gold:
        st = _seed(g)
        t0 = time.perf_counter()
        try:
            agent_graph.invoke(st)
        except Exception as e:
            per_case.append({"id": g["id"], "error": f"{type(e).__name__}: {e}"})
            continue
        dt_ms = (time.perf_counter() - t0) * 1000
        totals.append(dt_ms)
        msgs = len(st.messages)
        alerts = len(getattr(st, "department_alerts", []))
        per_case.append({
            "id": g["id"],
            "severity": g["severity_expected"],
            "protocol_picked": (st.__dict__.get("_supervisor_plan") or {}).get("sequence_key"),
            "total_ms": round(dt_ms, 1),
            "messages": msgs,
            "alerts": alerts,
        })

    throughput_per_min = 60_000 / (sum(totals) / len(totals)) if totals else 0.0
    return {
        "component": "End-to-end pipeline (agent_graph.invoke)",
        "n": len(totals),
        "latency_ms": summary_stats(totals),
        "throughput_incidents_per_min": round(throughput_per_min, 2),
        "cases": per_case,
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
