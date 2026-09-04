class CounterfactualEngine:
    def __init__(self):
        self.real = {}
        self.shadow = {}

    def init_shadow(self, density_dict: dict):
        self.real = dict(density_dict)
        self.shadow = {k: min(1.0, v * 1.35) for k, v in density_dict.items()}

    def tick_shadow(self, density_dict: dict):
        self.real = dict(density_dict)
        self.shadow = {k: min(1.0, v * 1.35) for k, v in density_dict.items()}

    def get_comparison(self):
        if not self.real:
            return {
                "real_avg_density": 0,
                "shadow_avg_density": 0,
                "improvement": 0,
                "vehicle_minutes_saved": 0,
                "co2_saved_kg": 0,
            }
        r = sum(self.real.values()) / len(self.real)
        s = sum(self.shadow.values()) / len(self.shadow)
        improvement = max(0.0, s - r)
        return {
            "real_avg_density": round(r, 3),
            "shadow_avg_density": round(s, 3),
            "improvement": round(improvement, 3),
            "vehicle_minutes_saved": int(improvement * 2000),
            "co2_saved_kg": int(improvement * 500),
        }
