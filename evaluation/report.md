# UrbanMind Evaluation Report

_Generated: 2026-09-05 06:50:26_

## Summary

| Component | Primary metric | Score |
|-----------|----------------|------:|
| SupervisingAgent | accuracy | **100.0%** |
| IncidentAgent | severity exact | 100.0% |
| IncidentAgent | severity ±1 | **100.0%** |
| IncidentAgent | type macro-F1 | 0.000 |
| HospitalRoutingAgent | top-1 hospital accuracy | **58.3%** |
| HospitalRoutingAgent | top-3 hospital accuracy | 91.7% |
| HospitalRoutingAgent | capability precision (mean) | 43.2% |
| HospitalRoutingAgent | capability recall (mean) | 100.0% |
| MobileViT | verification status accuracy | **33.3%** |
| MobileViT | expected calibration error | 0.083 |
| End-to-end pipeline (agent_graph.invoke) | p50 latency | 688 ms |
| End-to-end pipeline (agent_graph.invoke) | p90 latency | 1661 ms |
| End-to-end pipeline (agent_graph.invoke) | p99 latency | 1967 ms |
| End-to-end pipeline (agent_graph.invoke) | throughput | 67.7 incidents/min |

---
## SupervisingAgent

- n = **12**
- Macro precision / recall / F1: **1.000 / 1.000 / 1.000**
- Micro precision / recall / F1: 1.000 / 1.000 / 1.000

### Confusion matrix (rows = expected, cols = predicted)

|  | congestion | fire_hazmat | major_accident | medical_emergency | minor_accident |
|--|---:|---:|---:|---:|---:|
| **congestion** | 3 | 0 | 0 | 0 | 0 |
| **fire_hazmat** | 0 | 3 | 0 | 0 | 0 |
| **major_accident** | 0 | 0 | 2 | 0 | 0 |
| **medical_emergency** | 0 | 0 | 0 | 2 | 0 |
| **minor_accident** | 0 | 0 | 0 | 0 | 2 |

- Latency (ms): min 44.7, median 53.0, p90 327.3, p99 656.3, max 693.2

### Per-case detail

```json
[
  {
    "id": "gold-01",
    "expected": "congestion",
    "predicted": "congestion",
    "latency_ms": 693.2
  },
  {
    "id": "gold-02",
    "expected": "congestion",
    "predicted": "congestion",
    "latency_ms": 44.7
  },
  {
    "id": "gold-03",
    "expected": "minor_accident",
    "predicted": "minor_accident",
    "latency_ms": 54.5
  },
  {
    "id": "gold-04",
    "expected": "major_accident",
    "predicted": "major_accident",
    "latency_ms": 49.4
  },
  {
    "id": "gold-05",
    "expected": "major_accident",
    "predicted": "major_accident",
    "latency_ms": 357.4
  },
  {
    "id": "gold-06",
    "expected": "medical_emergency",
    "predicted": "medical_emergency",
    "latency_ms": 49.5
  },
  {
    "id": "gold-07",
    "expected": "fire_hazmat",
    "predicted": "fire_hazmat",
    "latency_ms": 55.2
  },
  {
    "id": "gold-08",
    "expected": "fire_hazmat",
    "predicted": "fire_hazmat",
    "latency_ms": 56.0
  },
  {
    "id": "gold-09",
    "expected": "minor_accident",
    "predicted": "minor_accident",
    "latency_ms": 54.0
  },
  {
    "id": "gold-10",
    "expected": "congestion",
    "predicted": "congestion",
    "latency_ms": 51.9
  },
  {
    "id": "gold-11",
    "expected": "medical_emergency",
    "predicted": "medical_emergency",
    "latency_ms": 50.1
  },
  {
    "id": "gold-12",
    "expected": "fire_hazmat",
    "predicted": "fire_hazmat",
    "latency_ms": 51.1
  }
]
```

---
## IncidentAgent

- n = **12**

### Incident-type confusion (expected × predicted)

|  | accident | congestion | fire | hazmat | medical | unknown |
|--|---:|---:|---:|---:|---:|---:|
| **accident** | 0 | 0 | 0 | 0 | 0 | 4 |
| **congestion** | 0 | 0 | 0 | 0 | 0 | 3 |
| **fire** | 0 | 0 | 0 | 0 | 0 | 2 |
| **hazmat** | 0 | 0 | 0 | 0 | 0 | 1 |
| **medical** | 0 | 0 | 0 | 0 | 0 | 2 |
| **unknown** | 0 | 0 | 0 | 0 | 0 | 0 |

- Latency (ms): min 0.0, median 48.9, p90 55.1, p99 57.8, max 58.2

### Per-case detail

```json
[
  {
    "id": "gold-01",
    "sev_expected": 2,
    "sev_predicted": 2,
    "type_expected": "congestion",
    "type_predicted": "unknown",
    "latency_ms": 0.0
  },
  {
    "id": "gold-02",
    "sev_expected": 3,
    "sev_predicted": 3,
    "type_expected": "congestion",
    "type_predicted": "unknown",
    "latency_ms": 58.2
  },
  {
    "id": "gold-03",
    "sev_expected": 2,
    "sev_predicted": 2,
    "type_expected": "accident",
    "type_predicted": "unknown",
    "latency_ms": 0.0
  },
  {
    "id": "gold-04",
    "sev_expected": 4,
    "sev_predicted": 4,
    "type_expected": "accident",
    "type_predicted": "unknown",
    "latency_ms": 55.4
  },
  {
    "id": "gold-05",
    "sev_expected": 4,
    "sev_predicted": 4,
    "type_expected": "accident",
    "type_predicted": "unknown",
    "latency_ms": 52.6
  },
  {
    "id": "gold-06",
    "sev_expected": 4,
    "sev_predicted": 4,
    "type_expected": "medical",
    "type_predicted": "unknown",
    "latency_ms": 51.4
  },
  {
    "id": "gold-07",
    "sev_expected": 5,
    "sev_predicted": 5,
    "type_expected": "fire",
    "type_predicted": "unknown",
    "latency_ms": 45.3
  },
  {
    "id": "gold-08",
    "sev_expected": 5,
    "sev_predicted": 5,
    "type_expected": "hazmat",
    "type_predicted": "unknown",
    "latency_ms": 49.0
  },
  {
    "id": "gold-09",
    "sev_expected": 3,
    "sev_predicted": 3,
    "type_expected": "accident",
    "type_predicted": "unknown",
    "latency_ms": 45.8
  },
  {
    "id": "gold-10",
    "sev_expected": 2,
    "sev_predicted": 2,
    "type_expected": "congestion",
    "type_predicted": "unknown",
    "latency_ms": 0.0
  },
  {
    "id": "gold-11",
    "sev_expected": 5,
    "sev_predicted": 5,
    "type_expected": "medical",
    "type_predicted": "unknown",
    "latency_ms": 48.9
  },
  {
    "id": "gold-12",
    "sev_expected": 4,
    "sev_predicted": 4,
    "type_expected": "fire",
    "type_predicted": "unknown",
    "latency_ms": 50.7
  }
]
```

---
## HospitalRoutingAgent

- n = **12**

- Latency (ms): min 0.0, median 0.1, p90 0.1, p99 1.5, max 1.7

### Per-case detail

```json
[
  {
    "id": "gold-01",
    "required": [
      "emergency"
    ],
    "picked": "St Johns Medical College Hospital",
    "picked_caps": [
      "burn_unit",
      "cardiac",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": false,
    "top3_hit": true,
    "cap_precision": 0.2,
    "cap_recall": 1.0,
    "latency_ms": 0.09
  },
  {
    "id": "gold-02",
    "required": [
      "emergency"
    ],
    "picked": "Columbia Asia Hospital Hebbal",
    "picked_caps": [
      "cardiac",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": false,
    "top3_hit": true,
    "cap_precision": 0.25,
    "cap_recall": 1.0,
    "latency_ms": 0.07
  },
  {
    "id": "gold-03",
    "required": [
      "emergency"
    ],
    "picked": "Rainbow Childrens Hospital Marathahalli",
    "picked_caps": [
      "cardiac",
      "emergency",
      "icu"
    ],
    "top1_hit": false,
    "top3_hit": true,
    "cap_precision": 0.333,
    "cap_recall": 1.0,
    "latency_ms": 0.06
  },
  {
    "id": "gold-04",
    "required": [
      "emergency",
      "trauma"
    ],
    "picked": "St Johns Medical College Hospital",
    "picked_caps": [
      "burn_unit",
      "cardiac",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": true,
    "top3_hit": true,
    "cap_precision": 0.4,
    "cap_recall": 1.0,
    "latency_ms": 0.06
  },
  {
    "id": "gold-05",
    "required": [
      "emergency",
      "trauma"
    ],
    "picked": "Sakra World Hospital",
    "picked_caps": [
      "cardiac",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": true,
    "top3_hit": true,
    "cap_precision": 0.5,
    "cap_recall": 1.0,
    "latency_ms": 0.06
  },
  {
    "id": "gold-06",
    "required": [
      "cardiac",
      "emergency"
    ],
    "picked": "Manipal Hospital Whitefield",
    "picked_caps": [
      "cardiac",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": true,
    "top3_hit": true,
    "cap_precision": 0.5,
    "cap_recall": 1.0,
    "latency_ms": 0.05
  },
  {
    "id": "gold-07",
    "required": [
      "burn_unit",
      "emergency",
      "trauma"
    ],
    "picked": "Victoria Hospital",
    "picked_caps": [
      "burn_unit",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": true,
    "top3_hit": true,
    "cap_precision": 0.75,
    "cap_recall": 1.0,
    "latency_ms": 0.04
  },
  {
    "id": "gold-08",
    "required": [
      "burn_unit",
      "emergency",
      "trauma"
    ],
    "picked": "St Johns Medical College Hospital",
    "picked_caps": [
      "burn_unit",
      "cardiac",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": true,
    "top3_hit": true,
    "cap_precision": 0.6,
    "cap_recall": 1.0,
    "latency_ms": 0.03
  },
  {
    "id": "gold-09",
    "required": [
      "emergency",
      "trauma"
    ],
    "picked": "St Johns Medical College Hospital",
    "picked_caps": [
      "burn_unit",
      "cardiac",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": true,
    "top3_hit": true,
    "cap_precision": 0.4,
    "cap_recall": 1.0,
    "latency_ms": 0.05
  },
  {
    "id": "gold-10",
    "required": [
      "emergency"
    ],
    "picked": "Fortis Hospital Cunningham Road",
    "picked_caps": [
      "cardiac",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": false,
    "top3_hit": false,
    "cap_precision": 0.25,
    "cap_recall": 1.0,
    "latency_ms": 0.05
  },
  {
    "id": "gold-11",
    "required": [
      "cardiac",
      "emergency",
      "trauma"
    ],
    "picked": "St Johns Medical College Hospital",
    "picked_caps": [
      "burn_unit",
      "cardiac",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": true,
    "top3_hit": true,
    "cap_precision": 0.6,
    "cap_recall": 1.0,
    "latency_ms": 0.06
  },
  {
    "id": "gold-12",
    "required": [
      "burn_unit",
      "emergency"
    ],
    "picked": "St Johns Medical College Hospital",
    "picked_caps": [
      "burn_unit",
      "cardiac",
      "emergency",
      "icu",
      "trauma"
    ],
    "top1_hit": false,
    "top3_hit": true,
    "cap_precision": 0.4,
    "cap_recall": 1.0,
    "latency_ms": 1.71
  }
]
```

---
## MobileViT

- n = **3**

- Latency (ms): min 21.3, median 26.5, p90 1821.8, p99 2225.7, max 2270.6

### Per-case detail

```json
[
  {
    "id": "synth-0",
    "expected": "insufficient_evidence",
    "predicted": "insufficient_evidence",
    "confidence": 0.25,
    "vehicle_count": 0,
    "injury_indicators": false,
    "latency_ms": 2270.6
  },
  {
    "id": "synth-1",
    "expected": "needs_verification",
    "predicted": "insufficient_evidence",
    "confidence": 0.25,
    "vehicle_count": 0,
    "injury_indicators": false,
    "latency_ms": 26.5
  },
  {
    "id": "synth-2",
    "expected": "supported",
    "predicted": "insufficient_evidence",
    "confidence": 0.25,
    "vehicle_count": 0,
    "injury_indicators": false,
    "latency_ms": 21.3
  }
]
```

---
## End-to-end pipeline (agent_graph.invoke)

- n = **12**

- Latency (ms): min 472.8, median 687.6, p90 1660.6, p99 1966.5, max 1995.3

### Per-case detail

```json
[
  {
    "id": "gold-01",
    "severity": 2,
    "protocol_picked": "congestion",
    "total_ms": 634.7,
    "messages": 5,
    "alerts": 0
  },
  {
    "id": "gold-02",
    "severity": 3,
    "protocol_picked": "congestion",
    "total_ms": 818.2,
    "messages": 5,
    "alerts": 0
  },
  {
    "id": "gold-03",
    "severity": 2,
    "protocol_picked": "congestion",
    "total_ms": 647.7,
    "messages": 5,
    "alerts": 0
  },
  {
    "id": "gold-04",
    "severity": 4,
    "protocol_picked": "major_accident",
    "total_ms": 1001.8,
    "messages": 9,
    "alerts": 1
  },
  {
    "id": "gold-05",
    "severity": 4,
    "protocol_picked": "major_accident",
    "total_ms": 472.8,
    "messages": 9,
    "alerts": 1
  },
  {
    "id": "gold-06",
    "severity": 4,
    "protocol_picked": "major_accident",
    "total_ms": 677.0,
    "messages": 9,
    "alerts": 1
  },
  {
    "id": "gold-07",
    "severity": 5,
    "protocol_picked": "major_accident",
    "total_ms": 1733.8,
    "messages": 9,
    "alerts": 1
  },
  {
    "id": "gold-08",
    "severity": 5,
    "protocol_picked": "major_accident",
    "total_ms": 473.9,
    "messages": 9,
    "alerts": 1
  },
  {
    "id": "gold-09",
    "severity": 3,
    "protocol_picked": "congestion",
    "total_ms": 968.1,
    "messages": 5,
    "alerts": 0
  },
  {
    "id": "gold-10",
    "severity": 2,
    "protocol_picked": "congestion",
    "total_ms": 515.8,
    "messages": 5,
    "alerts": 0
  },
  {
    "id": "gold-11",
    "severity": 5,
    "protocol_picked": "major_accident",
    "total_ms": 1995.3,
    "messages": 9,
    "alerts": 1
  },
  {
    "id": "gold-12",
    "severity": 4,
    "protocol_picked": "major_accident",
    "total_ms": 698.1,
    "messages": 9,
    "alerts": 1
  }
]
```
