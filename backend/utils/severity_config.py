"""Severity-based dynamic scenario configuration."""

SEVERITY_CONFIG = {
    1: {
        "label": "MINOR",
        "color": "#00ff88",
        "agents_firing": ["Incident", "Prediction", "Comms"],
        "departments_alerted": ["Public"],
        "signal_extension_seconds": 15,
        "speed_cap_kmph": 40,
        "units_deployed": 0,
        "clearance_eta_minutes": 5,
        "co2_multiplier": 0.4,
        "vehicle_minutes_multiplier": 0.3,
        "intervention_options": [
            "1) Extend green cycle by 15s",
            "2) Update public advisory board",
            "3) Monitor only",
        ],
        "narrator_tone": "informational",
        "emergency_corridor": False,
        "is_accident": False,
    },
    2: {
        "label": "LOW",
        "color": "#eab308",
        "agents_firing": ["Incident", "Prediction", "Constraint", "Intervention", "Emission", "Comms"],
        "departments_alerted": ["Public"],
        "signal_extension_seconds": 30,
        "speed_cap_kmph": 35,
        "units_deployed": 1,
        "clearance_eta_minutes": 10,
        "co2_multiplier": 0.6,
        "vehicle_minutes_multiplier": 0.5,
        "intervention_options": [
            "1) Adaptive signal cycle (+30s)",
            "2) Reroute one bus line",
            "3) Public advisory push",
        ],
        "narrator_tone": "advisory",
        "emergency_corridor": False,
        "is_accident": False,
    },
    3: {
        "label": "MODERATE",
        "color": "#f97316",
        "agents_firing": ["Incident", "Prediction", "Constraint", "Intervention", "Emission", "Safety", "Comms", "Protocol"],
        "departments_alerted": ["Public", "Traffic Police", "BBMP"],
        "signal_extension_seconds": 60,
        "speed_cap_kmph": 25,
        "units_deployed": 2,
        "clearance_eta_minutes": 18,
        "co2_multiplier": 1.0,
        "vehicle_minutes_multiplier": 1.0,
        "intervention_options": [
            "1) Signal override + transit hold",
            "2) Divert traffic via ring road",
            "3) Two-lane closure + advisory",
        ],
        "narrator_tone": "urgent",
        "emergency_corridor": False,
        "is_accident": False,
    },
    4: {
        "label": "HIGH",
        "color": "#ef4444",
        "agents_firing": ["Incident", "Prediction", "Constraint", "Intervention", "Emission", "Safety", "Protocol", "Hospital", "Comms", "Corridor"],
        "departments_alerted": ["Public", "Traffic Police", "BBMP", "Fire", "Hospital"],
        "signal_extension_seconds": 90,
        "speed_cap_kmph": 20,
        "units_deployed": 4,
        "clearance_eta_minutes": 30,
        "co2_multiplier": 1.4,
        "vehicle_minutes_multiplier": 1.5,
        "intervention_options": [
            "1) Full green-wave corridor + all cross-traffic hold",
            "2) Multi-lane closure + fire rescue dispatch",
            "3) Hospital pre-alert + ambulance pre-emption",
        ],
        "narrator_tone": "emergency",
        "emergency_corridor": True,
        "is_accident": False,
    },
    5: {
        "label": "CRITICAL",
        "color": "#ff3366",
        "agents_firing": ["Incident", "Prediction", "Constraint", "Intervention", "Emission", "Safety", "Protocol", "Hospital", "Comms", "Corridor"],
        "departments_alerted": ["Public", "Traffic Police", "BBMP", "Fire", "Hospital"],
        "signal_extension_seconds": 120,
        "speed_cap_kmph": 15,
        "units_deployed": 6,
        "clearance_eta_minutes": 45,
        "co2_multiplier": 1.8,
        "vehicle_minutes_multiplier": 2.0,
        "intervention_options": [
            "1) Total corridor lockdown + green-wave to trauma center",
            "2) Mass diversion + multi-hospital pre-alert",
            "3) Full closure + fire/hazmat + BBMP debris crew",
        ],
        "narrator_tone": "critical",
        "emergency_corridor": True,
        "is_accident": True,
    },
}


def get(severity: int):
    """Safe accessor with clamp to [1,5]."""
    try:
        s = int(severity)
    except Exception:
        s = 3
    if s < 1:
        s = 1
    if s > 5:
        s = 5
    return SEVERITY_CONFIG[s]
