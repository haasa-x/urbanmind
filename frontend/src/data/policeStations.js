export const POLICE_STATIONS = [
  { name: "Silk Board Traffic Police",    lat: 12.9177, lng: 77.6228 },
  { name: "Koramangala Traffic Police",   lat: 12.9352, lng: 77.6245 },
  { name: "BTM Traffic Police",           lat: 12.9166, lng: 77.6101 },
  { name: "HAL Traffic Police",           lat: 12.9503, lng: 77.6648 },
  { name: "Marathahalli Traffic Police",  lat: 12.9560, lng: 77.7010 },
  { name: "Whitefield Traffic Police",    lat: 12.9698, lng: 77.7500 },
  { name: "Indiranagar Traffic Police",   lat: 12.9784, lng: 77.6408 },
  { name: "MG Road Traffic Police",       lat: 12.9750, lng: 77.6100 },
  { name: "Cubbon Park Traffic Police",   lat: 12.9762, lng: 77.5993 },
  { name: "Hebbal Traffic Police",        lat: 13.0382, lng: 77.5919 },
  { name: "Yeshwanthpur Traffic Police",  lat: 13.0284, lng: 77.5473 },
  { name: "Jayanagar Traffic Police",     lat: 12.9250, lng: 77.5850 },
  { name: "Rajajinagar Traffic Police",   lat: 12.9906, lng: 77.5533 },
  { name: "Electronic City Traffic",      lat: 12.8452, lng: 77.6602 },
  { name: "JP Nagar Traffic Police",      lat: 12.9070, lng: 77.5850 },
]

export function nearestPoliceStation(lat, lng) {
  let best = POLICE_STATIONS[0], bestD = Infinity
  for (const p of POLICE_STATIONS) {
    const dx = p.lat - lat, dy = p.lng - lng
    const d = dx*dx + dy*dy
    if (d < bestD) { bestD = d; best = p }
  }
  return best
}
