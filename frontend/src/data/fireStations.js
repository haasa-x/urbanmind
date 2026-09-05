export const FIRE_STATIONS = [
  { name: "Bengaluru City Fire Station",        lat: 12.9762, lng: 77.5993 },
  { name: "Koramangala Fire Station",           lat: 12.9352, lng: 77.6245 },
  { name: "Jayanagar Fire Station",             lat: 12.9250, lng: 77.5850 },
  { name: "Yeshwanthpur Fire Station",          lat: 13.0284, lng: 77.5473 },
  { name: "Whitefield Fire Station",            lat: 12.9698, lng: 77.7500 },
  { name: "Marathahalli Fire Station",          lat: 12.9560, lng: 77.7010 },
  { name: "HAL Fire Station",                   lat: 12.9503, lng: 77.6648 },
  { name: "Hebbal Fire Station",                lat: 13.0382, lng: 77.5919 },
  { name: "Electronic City Fire Station",       lat: 12.8452, lng: 77.6602 },
  { name: "Peenya Fire Station",                lat: 13.0272, lng: 77.5216 },
  { name: "Banashankari Fire Station",          lat: 12.9250, lng: 77.5600 },
  { name: "Rajajinagar Fire Station",           lat: 12.9906, lng: 77.5533 },
]

export function nearestFireStation(lat, lng) {
  let best = FIRE_STATIONS[0], bestD = Infinity
  for (const f of FIRE_STATIONS) {
    const dx = f.lat - lat, dy = f.lng - lng
    const d = dx*dx + dy*dy
    if (d < bestD) { bestD = d; best = f }
  }
  return best
}
