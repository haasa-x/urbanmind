from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


def _default_density():
    return {"J1": 0.4, "J2": 0.4, "J3": 0.4, "J4": 0.4, "J5": 0.4}


def _default_metrics():
    return {
        "vehicle_minutes_saved": 0,
        "co2_avoided_kg": 0,
        "corridors_cleared": 0,
        "incidents_prevented": 0,
    }


def _default_narrator():
    return {"operator": "", "public": "", "audit": ""}


@dataclass
class CityState:
    density: dict = field(default_factory=_default_density)
    messages: list = field(default_factory=list)
    active_mode: str = "flow"
    emergency_active: bool = False
    route_visible: bool = False
    metrics: dict = field(default_factory=_default_metrics)
    narrator_outputs: dict = field(default_factory=_default_narrator)
    completion_banner: Optional[str] = None
    department_alerts: list = field(default_factory=list)
    selected_hospital: Optional[dict] = None
    protocol_active: bool = False
    severity: int = 3
    custom_banner: Optional[str] = None
    medical_assessments: list = field(default_factory=list)
    custom_scenario: Optional[dict] = None

    def push_message(self, agent: str, text: str, color: str):
        self.messages.append({
            "agent": agent,
            "text": text,
            "color": color,
            "timestamp": datetime.utcnow().isoformat(),
        })
        # Cap list size — SNAPSHOT payload grows unbounded across many submits.
        if len(self.messages) > 200:
            del self.messages[: len(self.messages) - 200]

    def push_alert(self, department: str, message: str, icon: str):
        self.department_alerts.append({
            "department": department,
            "message": message,
            "icon": icon,
            "timestamp": datetime.utcnow().isoformat(),
        })
        if len(self.department_alerts) > 200:
            del self.department_alerts[: len(self.department_alerts) - 200]

    def to_dict(self):
        return {
            "density": self.density,
            "messages": self.messages,
            "active_mode": self.active_mode,
            "emergency_active": self.emergency_active,
            "route_visible": self.route_visible,
            "metrics": self.metrics,
            "narrator_outputs": self.narrator_outputs,
            "completion_banner": self.completion_banner,
            "department_alerts": self.department_alerts,
            "selected_hospital": self.selected_hospital,
            "protocol_active": self.protocol_active,
            "severity": self.severity,
            "custom_banner": self.custom_banner,
            "medical_assessments": self.medical_assessments,
            "custom_scenario": self.custom_scenario,
        }
