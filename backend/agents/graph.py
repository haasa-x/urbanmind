"""Sequential agent orchestrator (LangGraph-compatible interface).

Adds a SupervisingAgent that picks one of the allowed downstream sequences
based on the incident context. Falls back to the legacy full sequence when
the supervisor produces no plan (catastrophic LLM failure) so scripted
playback (SC-01/02/03) keeps working.
"""
from . import (
    incident,
    prediction,
    constraint,
    emission,
    safety,
    intervention,
    protocol_dispatch,
    hospital_routing,
    narrator,
    emergency_corridor,
    supervisor,
    police,
    ems,
)


AGENT_DISPATCH = {
    "PredictionAgent": prediction,
    "ConstraintAgent": constraint,
    "EmissionAgent": emission,
    "SafetyAgent": safety,
    "InterventionAgent": intervention,
    "PoliceAgent": police,
    "EMSAgent": ems,
    "HospitalRoutingAgent": hospital_routing,
    "EmergencyCorridorAgent": emergency_corridor,
    "CommsAgent": narrator,
    "ProtocolDispatchAgent": protocol_dispatch,
}


LEGACY_SEQUENCE = (
    prediction, constraint, emission, safety, intervention,
    protocol_dispatch, hospital_routing, narrator,
)


class _Graph:
    def invoke(self, state):
        # Step 1: Incident first (needed for supervisor to decide)
        state = incident.run(state)

        # Step 2: Supervisor picks a sequence
        try:
            state = supervisor.run(state)
        except Exception as e:
            state.push_message("System", f"Supervisor error: {e}", "#ef4444")

        plan = state.__dict__.get("_supervisor_plan")

        # Step 3: Severity escalation — bump congestion→major_accident when sev >= 4
        if plan and int(getattr(state, "severity", 3) or 3) >= 4 \
                and plan.get("sequence_key") == "congestion":
            plan["sequence_key"] = "major_accident"
            plan["sequence"] = list(supervisor.ALLOWED_AGENT_SEQUENCES["major_accident"])
            state.__dict__["_supervisor_plan"] = plan
            state.push_message(
                "SupervisingAgent",
                "Escalated to MAJOR_ACCIDENT protocol (severity >= 4).",
                supervisor.COLOR,
            )

        # Step 4: Dispatch
        if plan and isinstance(plan.get("sequence"), list):
            for name in plan["sequence"]:
                if name == "IncidentAgent":
                    continue
                mod = AGENT_DISPATCH.get(name)
                if mod is None:
                    continue
                try:
                    state = mod.run(state)
                except Exception as e:
                    state.push_message("System", f"{name} error: {e}", "#ef4444")
            # ensure corridor still runs if emergency was flipped mid-flight
            if state.emergency_active and "EmergencyCorridorAgent" not in plan["sequence"]:
                state = emergency_corridor.run(state)
        else:
            # Legacy fallback — full sequential pipeline (preserves scripted playback)
            for mod in LEGACY_SEQUENCE:
                state = mod.run(state)
            if state.emergency_active:
                state = emergency_corridor.run(state)
        return state


agent_graph = _Graph()
