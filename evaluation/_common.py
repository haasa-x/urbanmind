"""Shared helpers for every eval script."""
import json
import os
import sys
from collections import defaultdict
from pathlib import Path
from statistics import mean, median

# Make backend importable.
_THIS = Path(__file__).resolve()
_ROOT = _THIS.parent.parent
BACKEND = _ROOT / "backend"
sys.path.insert(0, str(BACKEND))

# Load .env if present so agents get GROQ_API_KEY.
_env = BACKEND / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

GOLD_PATH = _THIS.parent / "datasets" / "gold.json"


def load_gold():
    with GOLD_PATH.open() as f:
        return json.load(f)


def percentile(data, p):
    if not data:
        return 0.0
    s = sorted(data)
    k = (len(s) - 1) * (p / 100)
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def confusion_matrix(y_true, y_pred, labels=None):
    if labels is None:
        labels = sorted(set(y_true) | set(y_pred))
    idx = {l: i for i, l in enumerate(labels)}
    m = [[0] * len(labels) for _ in labels]
    for t, p in zip(y_true, y_pred):
        if t in idx and p in idx:
            m[idx[t]][idx[p]] += 1
    return labels, m


def prf_from_confusion(labels, m):
    """Per-label precision / recall / F1 and macro averages."""
    per = {}
    tp_all = fp_all = fn_all = 0
    for i, lab in enumerate(labels):
        tp = m[i][i]
        fp = sum(m[j][i] for j in range(len(labels))) - tp
        fn = sum(m[i][j] for j in range(len(labels))) - tp
        p = tp / (tp + fp) if (tp + fp) else 0.0
        r = tp / (tp + fn) if (tp + fn) else 0.0
        f = 2 * p * r / (p + r) if (p + r) else 0.0
        per[lab] = {"precision": p, "recall": r, "f1": f,
                    "support": tp + fn}
        tp_all += tp; fp_all += fp; fn_all += fn
    macro = {
        "precision": mean(v["precision"] for v in per.values()) if per else 0.0,
        "recall":    mean(v["recall"] for v in per.values()) if per else 0.0,
        "f1":        mean(v["f1"] for v in per.values()) if per else 0.0,
    }
    micro_p = tp_all / (tp_all + fp_all) if (tp_all + fp_all) else 0.0
    micro_r = tp_all / (tp_all + fn_all) if (tp_all + fn_all) else 0.0
    micro_f = 2 * micro_p * micro_r / (micro_p + micro_r) if (micro_p + micro_r) else 0.0
    return per, macro, {"precision": micro_p, "recall": micro_r, "f1": micro_f}


def summary_stats(values):
    if not values:
        return {"n": 0}
    return {
        "n": len(values),
        "min": min(values),
        "mean": mean(values),
        "median": median(values),
        "p90": percentile(values, 90),
        "p99": percentile(values, 99),
        "max": max(values),
    }


def pretty_pct(x):
    return f"{x*100:.1f}%"
