# UrbanMind — Evaluation Suite

Custom metrics for the UrbanMind agent system.

## What it measures

| Component | Metric | File |
| --- | --- | --- |
| SupervisingAgent | Protocol classification accuracy + macro-F1 + confusion matrix | `eval_supervisor.py` |
| IncidentAgent | Severity label accuracy + type classification | `eval_incident.py` |
| HospitalRoutingAgent | Capability-match precision/recall + top-1 & top-3 hospital accuracy | `eval_hospital.py` |
| Vision (MobileViT) | Verification-status accuracy + confidence calibration (ECE) | `eval_vision.py` |
| End-to-end pipeline | Latency p50 / p90 / p99 + throughput + SSE delivery rate | `eval_latency.py` |

## Run everything

```bash
cd evaluation
source ../backend/venv/bin/activate
python run_all.py
```

Output is written to `evaluation/results.json` + `evaluation/report.md`.

## Ground truth

`datasets/gold.json` — hand-curated incidents with expected severity, protocol, hospital capability set, and hospital shortlist.
`datasets/vision_gold.json` — small labelled image list; `datasets/images/` optional.

## Notes

- Runs offline without touching the live backend; imports agent modules directly.
- Requires `GROQ_API_KEY` in `backend/.env` — falls back to deterministic stubs otherwise (which is itself a useful baseline).
- Vision eval requires MobileViT weights (auto-downloaded on first use).
