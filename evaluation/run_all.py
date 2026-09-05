"""Run every eval and emit results.json + report.md."""
import json
import os
import sys
import time
import traceback
from pathlib import Path

from _common import pretty_pct

HERE = Path(__file__).resolve().parent
os.chdir(HERE)


def _run(name):
    """Import + run(). Returns dict; on error, catches & records."""
    print(f"[eval] running {name} ...", flush=True)
    t0 = time.perf_counter()
    try:
        mod = __import__(name)
        result = mod.run()
    except Exception as e:
        print(f"[eval] {name} FAILED: {e}", flush=True)
        traceback.print_exc()
        result = {"component": name, "error": f"{type(e).__name__}: {e}",
                  "traceback": traceback.format_exc()}
    dt = time.perf_counter() - t0
    print(f"[eval] {name} done in {dt:.1f}s", flush=True)
    return result


def build_report(results):
    lines = []
    lines.append("# UrbanMind Evaluation Report")
    lines.append("")
    lines.append(f"_Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}_")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append("| Component | Primary metric | Score |")
    lines.append("|-----------|----------------|------:|")
    for r in results:
        c = r.get("component", "?")
        if "error" in r:
            lines.append(f"| {c} | (error) | — |")
            continue
        if "accuracy" in r:
            lines.append(f"| {c} | accuracy | **{pretty_pct(r['accuracy'])}** |")
        if "top1_accuracy" in r:
            lines.append(f"| {c} | top-1 hospital accuracy | **{pretty_pct(r['top1_accuracy'])}** |")
            lines.append(f"| {c} | top-3 hospital accuracy | {pretty_pct(r['top3_accuracy'])} |")
            lines.append(f"| {c} | capability precision (mean) | {pretty_pct(r['capability_precision_mean'])} |")
            lines.append(f"| {c} | capability recall (mean) | {pretty_pct(r['capability_recall_mean'])} |")
        if "severity_exact_accuracy" in r:
            lines.append(f"| {c} | severity exact | {pretty_pct(r['severity_exact_accuracy'])} |")
            lines.append(f"| {c} | severity ±1 | **{pretty_pct(r['severity_within_1_accuracy'])}** |")
            lines.append(f"| {c} | type macro-F1 | {r['type_macro_f1']:.3f} |")
        if "status_accuracy" in r:
            lines.append(f"| {c} | verification status accuracy | **{pretty_pct(r['status_accuracy'])}** |")
            lines.append(f"| {c} | expected calibration error | {r['expected_calibration_error']:.3f} |")
        if "throughput_incidents_per_min" in r:
            lat = r["latency_ms"]
            lines.append(f"| {c} | p50 latency | {lat.get('median', 0):.0f} ms |")
            lines.append(f"| {c} | p90 latency | {lat.get('p90', 0):.0f} ms |")
            lines.append(f"| {c} | p99 latency | {lat.get('p99', 0):.0f} ms |")
            lines.append(f"| {c} | throughput | {r['throughput_incidents_per_min']:.1f} incidents/min |")
    lines.append("")

    # per-component detail
    for r in results:
        c = r.get("component", "?")
        lines.append(f"---")
        lines.append(f"## {c}")
        lines.append("")
        if "error" in r:
            lines.append(f"> ERROR: `{r['error']}`")
            lines.append("")
            continue
        lines.append(f"- n = **{r.get('n', 0)}**")

        if "macro" in r:
            m = r["macro"]; mi = r["micro"]
            lines.append(f"- Macro precision / recall / F1: **{m['precision']:.3f} / {m['recall']:.3f} / {m['f1']:.3f}**")
            lines.append(f"- Micro precision / recall / F1: {mi['precision']:.3f} / {mi['recall']:.3f} / {mi['f1']:.3f}")

        if "confusion_matrix" in r:
            cm = r["confusion_matrix"]
            lines.append("")
            lines.append("### Confusion matrix (rows = expected, cols = predicted)")
            lines.append("")
            header = "|  | " + " | ".join(cm["labels"]) + " |"
            sep = "|--|" + "|".join(["---:"] * len(cm["labels"])) + "|"
            lines.append(header); lines.append(sep)
            for lab, row in zip(cm["labels"], cm["matrix"]):
                lines.append("| **" + lab + "** | " + " | ".join(str(v) for v in row) + " |")

        if "type_confusion_matrix" in r:
            cm = r["type_confusion_matrix"]
            lines.append("")
            lines.append("### Incident-type confusion (expected × predicted)")
            lines.append("")
            header = "|  | " + " | ".join(cm["labels"]) + " |"
            sep = "|--|" + "|".join(["---:"] * len(cm["labels"])) + "|"
            lines.append(header); lines.append(sep)
            for lab, row in zip(cm["labels"], cm["matrix"]):
                lines.append("| **" + lab + "** | " + " | ".join(str(v) for v in row) + " |")

        if "latency_ms" in r and r["latency_ms"].get("n"):
            lat = r["latency_ms"]
            lines.append("")
            lines.append(
                f"- Latency (ms): min {lat['min']:.1f}, "
                f"median {lat['median']:.1f}, p90 {lat['p90']:.1f}, "
                f"p99 {lat['p99']:.1f}, max {lat['max']:.1f}"
            )

        if "cases" in r and r["cases"]:
            lines.append("")
            lines.append("### Per-case detail")
            lines.append("")
            lines.append("```json")
            lines.append(json.dumps(r["cases"], indent=2))
            lines.append("```")
        lines.append("")

    return "\n".join(lines)


def main():
    results = []
    for name in ("eval_supervisor", "eval_incident", "eval_hospital", "eval_vision", "eval_latency"):
        results.append(_run(name))

    (HERE / "results.json").write_text(json.dumps(results, indent=2))
    (HERE / "report.md").write_text(build_report(results))
    print(f"\n[eval] wrote results.json + report.md in {HERE}", flush=True)

    # quick console summary
    print("\n============ SUMMARY ============")
    for r in results:
        c = r.get("component", "?")
        if "error" in r:
            print(f"  {c:40s}  ERROR")
            continue
        parts = []
        if "accuracy" in r:                 parts.append(f"acc={pretty_pct(r['accuracy'])}")
        if "top1_accuracy" in r:            parts.append(f"top1={pretty_pct(r['top1_accuracy'])}")
        if "severity_within_1_accuracy" in r: parts.append(f"sev±1={pretty_pct(r['severity_within_1_accuracy'])}")
        if "status_accuracy" in r:          parts.append(f"vis={pretty_pct(r['status_accuracy'])}")
        if "throughput_incidents_per_min" in r:
            parts.append(f"p90={r['latency_ms'].get('p90', 0):.0f}ms")
            parts.append(f"th={r['throughput_incidents_per_min']:.1f}/min")
        print(f"  {c:40s}  " + "  ".join(parts))
    print("================================\n")


if __name__ == "__main__":
    main()
