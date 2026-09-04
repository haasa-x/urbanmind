import math

PROPAGATION_WEIGHTS = {
    "J1": {"J2": 7, "J5": 11},
    "J2": {"J4": 9},
    "J5": {"J3": 6},
}

HOSPITAL_TABLE = [
    {"name": "Manipal Hospital HAL", "trauma": True, "lat": 12.9516, "lng": 77.6648, "eta_from_J1": 6},
    {"name": "St Johns Medical College", "trauma": True, "lat": 12.9250, "lng": 77.6220, "eta_from_J1": 8},
    {"name": "Sakra World Hospital", "trauma": True, "lat": 12.9401, "lng": 77.6769, "eta_from_J1": 10},
    {"name": "Apollo Hospitals Bannerghatta", "trauma": False, "lat": 12.8900, "lng": 77.5970, "eta_from_J1": 14},
]


def get_spillover_predictions(junction_id: str, density: dict):
    downstream = PROPAGATION_WEIGHTS.get(junction_id, {})
    out = []
    for j, eta in downstream.items():
        out.append({"junction": j, "eta": eta})
    return out


DEFAULT_ORIGIN = {"lat": 12.9177, "lng": 77.6228}  # J1 Silk Board


def select_hospital(severity: int, origin=None):
    """Pick nearest hospital by Haversine-ish squared distance.

    origin may be a dict {lat, lng}, a string (legacy junction id — ignored,
    fallback to DEFAULT_ORIGIN), or None.
    """
    if isinstance(origin, dict) and "lat" in origin and "lng" in origin:
        o = origin
    else:
        o = DEFAULT_ORIGIN
    pool = [h for h in HOSPITAL_TABLE if h["trauma"]] if severity >= 4 else list(HOSPITAL_TABLE)
    if not pool:
        pool = list(HOSPITAL_TABLE)

    def d2(h):
        return (h["lat"] - o["lat"]) ** 2 + (h["lng"] - o["lng"]) ** 2

    return sorted(pool, key=d2)[0]
