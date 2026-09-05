"""MobileViT vision evaluation.

If evaluation/datasets/vision_gold.json exists with real image paths and labels,
the script scores accuracy + expected-calibration-error (ECE). Otherwise it runs
a synthetic sanity check: builds a few in-memory PIL images (traffic-scene-ish
solid patches with vehicles/persons drawn) and checks that MobileViT emits
finite, well-formed output for each verification_status class.
"""
import io
import json
import time
from pathlib import Path

from _common import summary_stats

VISION_GOLD = Path(__file__).parent / "datasets" / "vision_gold.json"


def _bytes_of(img):
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _synthetic_frames():
    """Draw three synthetic frames of increasing 'busy' content to exercise the classifier."""
    try:
        from PIL import Image, ImageDraw
    except Exception:
        return []
    frames = []
    # empty road (should be insufficient_evidence)
    a = Image.new("RGB", (256, 256), (30, 30, 40))
    frames.append({"label": "insufficient_evidence", "img": a})
    # one vehicle (needs_verification)
    b = Image.new("RGB", (256, 256), (30, 30, 40))
    d = ImageDraw.Draw(b)
    d.rectangle([60, 100, 200, 180], fill=(180, 30, 30))
    frames.append({"label": "needs_verification", "img": b})
    # busy scene (supported)
    c = Image.new("RGB", (256, 256), (30, 30, 40))
    d = ImageDraw.Draw(c)
    d.rectangle([20, 100, 120, 190], fill=(180, 30, 30))
    d.rectangle([140, 110, 240, 195], fill=(30, 60, 180))
    d.ellipse([170, 40, 200, 100], fill=(230, 200, 160))  # 'person'
    frames.append({"label": "supported", "img": c})
    return frames


def _ece(probs, correct, n_bins=5):
    """Expected calibration error given per-sample confidence and 0/1 correctness."""
    if not probs:
        return 0.0
    bins = [[] for _ in range(n_bins)]
    for p, c in zip(probs, correct):
        idx = min(n_bins - 1, int(p * n_bins))
        bins[idx].append((p, c))
    total = len(probs)
    err = 0.0
    for b in bins:
        if not b:
            continue
        conf_mean = sum(p for p, _ in b) / len(b)
        acc_mean = sum(c for _, c in b) / len(b)
        err += (len(b) / total) * abs(conf_mean - acc_mean)
    return err


def run():
    try:
        from src.vision.analyzer import analyze_image
    except Exception as e:
        return {"component": "MobileViT", "error": f"vision not available: {e}"}

    entries = []
    if VISION_GOLD.exists():
        gold = json.loads(VISION_GOLD.read_text())
        for g in gold:
            p = Path(g["path"])
            if not p.exists():
                continue
            entries.append({"label": g["label"], "bytes": p.read_bytes(), "id": g.get("id", p.name)})
    if not entries:
        # synthetic fallback
        for i, f in enumerate(_synthetic_frames()):
            entries.append({"label": f["label"], "bytes": _bytes_of(f["img"]), "id": f"synth-{i}"})

    if not entries:
        return {"component": "MobileViT", "error": "no evaluation samples"}

    latencies, confidences, correct_flags = [], [], []
    per_case = []
    correct_status = 0
    for e in entries:
        t0 = time.perf_counter()
        try:
            out = analyze_image(e["bytes"])
        except Exception as ex:
            per_case.append({"id": e["id"], "error": f"{type(ex).__name__}: {ex}"})
            continue
        dt_ms = (time.perf_counter() - t0) * 1000
        latencies.append(dt_ms)

        pred = out.get("verification_status")
        conf = float(out.get("confidence", 0))
        hit = int(pred == e["label"])
        if hit:
            correct_status += 1
        confidences.append(conf)
        correct_flags.append(hit)
        per_case.append({
            "id": e["id"],
            "expected": e["label"],
            "predicted": pred,
            "confidence": conf,
            "vehicle_count": out.get("vehicle_count"),
            "injury_indicators": out.get("injury_indicators"),
            "latency_ms": round(dt_ms, 1),
        })

    n = len(entries)
    return {
        "component": "MobileViT",
        "n": n,
        "status_accuracy": correct_status / n if n else 0.0,
        "expected_calibration_error": _ece(confidences, correct_flags),
        "confidence_stats": summary_stats(confidences),
        "latency_ms": summary_stats(latencies),
        "cases": per_case,
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
