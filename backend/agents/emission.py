from utils.severity_config import get as get_sev

COLOR = "#10b981"


def run(state):
    sev = int(getattr(state, "severity", 3) or 3)
    cfg = get_sev(sev)
    before = sum(state.density.values()) / max(1, len(state.density))
    after = max(0.0, before - 0.15)
    base_co2 = (before - after) * 200 * 0.13 * 15
    co2 = base_co2 * cfg["co2_multiplier"]
    state.push_message(
        "EmissionAgent",
        f"Estimated CO2 avoided this window: {co2:.0f} kg "
        f"(Δdensity {before-after:.2f} · sev {sev} x{cfg['co2_multiplier']:.1f}).",
        COLOR,
    )
    return state
