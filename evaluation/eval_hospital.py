"""HospitalRoutingAgent: capability-match precision/recall + top-k hospital accuracy."""
import json
import time
from pathlib import Path

from _common import load_gold, summary_stats

from agents import hospital_routing
from utils.city_state import CityState

BACKEND = Path(__file__).resolve().parent.parent / "backend"
HOSPITALS = json.loads((BACKEND / "data" / "hospitals.json").read_text())


def _origin_for(location):
    """Very small location-to-lat/lng lookup for the eval set."""
    m = {
        "silk board": (12.9177, 77.6228),
        "hebbal": (13.0382, 77.5919),
        "marathahalli": (12.9560, 77.7010),
        "koramangala": (12.9279, 77.6271),
        "bellandur": (12.9260, 77.6810),
        "whitefield": (12.9698, 77.7500),
        "majestic": (12.9773, 77.5731),
        "hosur road": (12.9081, 77.6476),
        "btm layout": (12.9116, 77.6088),
        "vidhana soudha": (12.9800, 77.5910),
        "indiranagar": (12.9784, 77.6408),
    }
    return m.get(location.lower(), (12.9177, 77.6228))


def _capabilities_of(hosp_name):
    for h in HOSPITALS:
        if h["name"] == hosp_name:
            caps = set()
            for k in ("trauma", "cardiac", "icu", "burn_unit", "emergency"):
                if h.get(k):
                    caps.add(k)
            return caps
    return set()


def _select(state, required_caps, origin):
    """Call the capability-first selector directly."""
    lat, lng = origin
    return hospital_routing.select_capability_hospital(
        required_caps, {"lat": lat, "lng": lng}
    )


def run():
    gold = load_gold()
    top1_hits, top3_hits = 0, 0
    cap_precisions, cap_recalls = [], []
    latencies = []
    per_case = []

    for g in gold:
        st = CityState()
        st.severity = g["severity_expected"]
        st.__dict__["_incident"] = {"type": g["incident_type_expected"],
                                    "is_accident": g["incident_type_expected"] == "accident",
                                    "injury_indicators": "injur" in g["description"].lower()}
        origin = _origin_for(g["location"])
        required = set(g["required_capabilities"])

        t0 = time.perf_counter()
        try:
            picked = _select(st, list(required), origin)
        except Exception as e:
            per_case.append({"id": g["id"], "error": f"{type(e).__name__}: {e}"})
            continue
        dt_ms = (time.perf_counter() - t0) * 1000
        latencies.append(dt_ms)

        top1 = picked["name"] if picked else None
        top1_hit = top1 == g["hospital_shortlist"][0] if g["hospital_shortlist"] else False
        top3_hit = top1 in g["hospital_shortlist"] if top1 else False
        if top1_hit:
            top1_hits += 1
        if top3_hit:
            top3_hits += 1

        picked_caps = _capabilities_of(top1) if top1 else set()
        overlap = required & picked_caps
        precision = len(overlap) / len(picked_caps) if picked_caps else 0.0
        recall = len(overlap) / len(required) if required else 0.0
        cap_precisions.append(precision)
        cap_recalls.append(recall)

        per_case.append({
            "id": g["id"],
            "required": sorted(required),
            "picked": top1,
            "picked_caps": sorted(picked_caps),
            "top1_hit": top1_hit,
            "top3_hit": top3_hit,
            "cap_precision": round(precision, 3),
            "cap_recall": round(recall, 3),
            "latency_ms": round(dt_ms, 2),
        })

    n = len(gold)
    return {
        "component": "HospitalRoutingAgent",
        "n": n,
        "top1_accuracy": top1_hits / n,
        "top3_accuracy": top3_hits / n,
        "capability_precision_mean": sum(cap_precisions) / n if n else 0.0,
        "capability_recall_mean": sum(cap_recalls) / n if n else 0.0,
        "latency_ms": summary_stats(latencies),
        "cases": per_case,
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
