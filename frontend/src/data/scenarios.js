export const HOSPITALS = [
  { name: 'Manipal Hospital HAL', trauma: true, lat: 12.9516, lng: 77.6648, eta_from_J1: 6 },
  { name: 'St Johns Medical College', trauma: true, lat: 12.9250, lng: 77.6220, eta_from_J1: 8 },
  { name: 'Sakra World Hospital', trauma: true, lat: 12.9401, lng: 77.6769, eta_from_J1: 10 },
  { name: 'Apollo Hospitals Bannerghatta', trauma: false, lat: 12.8900, lng: 77.5970, eta_from_J1: 14 },
]

export function nearestHospital(lat, lng, requireTrauma = true) {
  const pool = requireTrauma ? HOSPITALS.filter(h => h.trauma) : HOSPITALS
  const list = pool.length ? pool : HOSPITALS
  let best = list[0]
  let bestD = Infinity
  for (const h of list) {
    const dx = h.lat - lat
    const dy = h.lng - lng
    const d = dx * dx + dy * dy
    if (d < bestD) { bestD = d; best = h }
  }
  return best
}

const SC01_EVENTS = [
  { t: 0, type: 'SET_DENSITY', data: { J1: 0.45, J2: 0.38, J3: 0.41, J4: 0.35, J5: 0.39 } },
  { t: 10, type: 'ADD_MESSAGE', data: { agent: 'IncidentAgent', text: 'Monitoring nominal flow across Silk Board grid.', color: '#f59e0b' } },
  { t: 30, type: 'SET_DENSITY', data: { J1: 0.89, J2: 0.55, J3: 0.41, J4: 0.4, J5: 0.6 } },
  { t: 30, type: 'ADD_MESSAGE', data: { agent: 'IncidentAgent', text: 'INCIDENT_CONFIRMED at J1: multi-vehicle collision, severity 5, 2 lanes down, ETA 18min.', color: '#f59e0b' } },
  { t: 33, type: 'ADD_MESSAGE', data: { agent: 'ConstraintAgent', text: 'Policy R-22C invoked. Checking R-14B priority.', color: '#ef4444' } },
  { t: 38, type: 'ADD_MESSAGE', data: { agent: 'InterventionAgent', text: 'Options: 1) Signal override  2) Divert BTM  3) Full closure.', color: '#3b82f6' } },
  { t: 41, type: 'ADD_MESSAGE', data: { agent: 'ConstraintAgent', text: 'Option 1 APPROVED per R-14B.', color: '#ef4444' } },
  { t: 43, type: 'ADD_ALERT', data: { department: 'Traffic Police', icon: '🚔', message: 'Dispatch to J1: sev 5, divert inbound.' } },
  { t: 43, type: 'ADD_ALERT', data: { department: 'Public', icon: '📱', message: 'Avoid Silk Board 20 min.' } },
  { t: 43, type: 'ADD_ALERT', data: { department: 'BBMP', icon: '🏛', message: 'Debris crew on standby.' } },
  { t: 45, type: 'SET_EMERGENCY', data: { value: true } },
  { t: 45, type: 'SET_ROUTE', data: { value: true } },
  { t: 45, type: 'SET_HOSPITAL', data: { name: 'Manipal Hospital HAL', trauma: true, lat: 12.9516, lng: 77.6648, eta_from_J1: 6 } },
  { t: 45, type: 'ADD_MESSAGE', data: { agent: 'EmergencyCorridorAgent', text: 'Green-wave J1 -> J5 -> J3 engaged.', color: '#06b6d4' } },
  { t: 45, type: 'ADD_ALERT', data: { department: 'Hospital', icon: '🏥', message: 'Standby trauma bay at Manipal HAL. ETA 6 min.' } },
  { t: 48, type: 'ADD_MESSAGE', data: { agent: 'ConstraintAgent', text: 'R-07A ambulance pre-emption engaged.', color: '#ef4444' } },
  { t: 52, type: 'SET_NARRATOR', data: { operator: 'Corridor override active for J1; R-14B invoked. Green-wave J1->J5->J3 clear.', public: 'Emergency crews clearing Silk Board; use alternate routes ~20 min.', audit: 'AUDIT: J1 sev-5 handled per R-14B/R-22C. Corridor engaged.' } },
  { t: 52, type: 'ADD_MESSAGE', data: { agent: 'CommsAgent', text: 'Narratives generated (operator/public/audit).', color: '#8b5cf6' } },
  { t: 55, type: 'ADD_MESSAGE', data: { agent: 'EmissionAgent', text: 'Projected CO2 avoided: 180 kg.', color: '#10b981' } },
  { t: 70, type: 'SET_DENSITY', data: { J1: 0.85, J2: 0.72, J3: 0.48, J4: 0.51, J5: 0.78 } },
  { t: 70, type: 'ADD_MESSAGE', data: { agent: 'InterventionAgent', text: 'Spillover confirmed at J2/J5; adjusting green-wave.', color: '#3b82f6' } },
  { t: 100, type: 'INCREMENT_METRICS', data: { vehicle_minutes_saved: 847, co2_avoided_kg: 180, corridors_cleared: 1, incidents_prevented: 1 } },
  { t: 120, type: 'SET_DENSITY', data: { J1: 0.55, J2: 0.48, J3: 0.42, J4: 0.4, J5: 0.5 } },
  { t: 120, type: 'SET_EMERGENCY', data: { value: false } },
  { t: 120, type: 'SET_ROUTE', data: { value: false } },
  { t: 120, type: 'ADD_MESSAGE', data: { agent: 'IncidentAgent', text: 'Incident clearing; lanes reopening.', color: '#f59e0b' } },
  { t: 150, type: 'SET_DENSITY', data: { J1: 0.42, J2: 0.38, J3: 0.4, J4: 0.36, J5: 0.39 } },
  { t: 150, type: 'ADD_MESSAGE', data: { agent: 'CommsAgent', text: 'All clear across Silk Board grid.', color: '#8b5cf6' } },
  { t: 150, type: 'SET_COMPLETION', data: { text: 'SCENARIO COMPLETE — Silk Board incident resolved.' } }
]

const SC02_EVENTS = [
  { t: 0, type: 'SET_DENSITY', data: { O1: 0.5, O2: 0.6, O3: 0.55, O4: 0.48, O5: 0.52 } },
  { t: 8, type: 'ADD_MESSAGE', data: { agent: 'IncidentAgent', text: 'VIP convoy request for ORR corridor.', color: '#f59e0b' } },
  { t: 20, type: 'SET_EMERGENCY', data: { value: true } },
  { t: 20, type: 'SET_ROUTE', data: { value: true } },
  { t: 20, type: 'ADD_MESSAGE', data: { agent: 'EmergencyCorridorAgent', text: 'Corridor O1 -> O3 -> O5 pre-empted.', color: '#06b6d4' } },
  { t: 45, type: 'SET_NARRATOR', data: { operator: 'Convoy corridor holding.', public: 'Short ORR delay complete.', audit: 'AUDIT: convoy per R-14B.' } },
  { t: 60, type: 'INCREMENT_METRICS', data: { vehicle_minutes_saved: 320, co2_avoided_kg: 60, corridors_cleared: 1, incidents_prevented: 0 } },
  { t: 75, type: 'SET_EMERGENCY', data: { value: false } },
  { t: 75, type: 'SET_ROUTE', data: { value: false } },
  { t: 80, type: 'SET_COMPLETION', data: { text: 'SCENARIO COMPLETE — ORR convoy released.' } }
]

const SC03_EVENTS = [
  { t: 0, type: 'SET_DENSITY', data: { H1: 0.55, H2: 0.6, H3: 0.5, H4: 0.58, H5: 0.52 } },
  { t: 10, type: 'ADD_MESSAGE', data: { agent: 'PredictionAgent', text: 'Peak build-up in T+15min.', color: '#f59e0b' } },
  { t: 25, type: 'SET_DENSITY', data: { H1: 0.82, H2: 0.78, H3: 0.7, H4: 0.75, H5: 0.68 } },
  { t: 28, type: 'ADD_MESSAGE', data: { agent: 'InterventionAgent', text: 'Adaptive signal cycle lengthened on H1-H2.', color: '#3b82f6' } },
  { t: 34, type: 'ADD_MESSAGE', data: { agent: 'ConstraintAgent', text: 'R-22C override APPROVED.', color: '#ef4444' } },
  { t: 55, type: 'ADD_MESSAGE', data: { agent: 'EmissionAgent', text: 'Projected CO2 avoided: 95 kg.', color: '#10b981' } },
  { t: 70, type: 'SET_DENSITY', data: { H1: 0.65, H2: 0.6, H3: 0.55, H4: 0.58, H5: 0.5 } },
  { t: 80, type: 'INCREMENT_METRICS', data: { vehicle_minutes_saved: 512, co2_avoided_kg: 95, corridors_cleared: 0, incidents_prevented: 1 } },
  { t: 95, type: 'SET_COMPLETION', data: { text: 'SCENARIO COMPLETE — Hebbal peak mitigated.' } }
]

export const SCENARIOS = {
  SC01: {
    id: 'SC01',
    code: 'SC01',
    name: 'Silk Board Accident',
    label: 'Silk Board Accident',
    severity: 3,
    description: 'Multi-vehicle collision + ambulance corridor',
    junctions: [
      { id: 'J1', name: 'Silk Board', lat: 12.9177, lng: 77.6228 },
      { id: 'J2', name: 'BTM Layout', lat: 12.9116, lng: 77.6088 },
      { id: 'J3', name: 'Hosur Road', lat: 12.9081, lng: 77.6476 },
      { id: 'J4', name: 'Koramangala', lat: 12.9279, lng: 77.6271 },
      { id: 'J5', name: 'Agara', lat: 12.9148, lng: 77.6384 }
    ],
    mapCenter: [12.9160, 77.6280],
    mapZoom: 14,
    totalDuration: 150,
    events: SC01_EVENTS
  },
  SC02: {
    id: 'SC02',
    code: 'SC02',
    name: 'ORR Emergency Convoy',
    label: 'ORR Emergency',
    severity: 4,
    description: 'VIP convoy corridor pre-emption on ORR',
    junctions: [
      { id: 'O1', name: 'Marathahalli', lat: 12.9560, lng: 77.7010 },
      { id: 'O2', name: 'Kadubeesanahalli', lat: 12.9385, lng: 77.6890 },
      { id: 'O3', name: 'Bellandur', lat: 12.9260, lng: 77.6810 },
      { id: 'O4', name: 'Ibblur', lat: 12.9200, lng: 77.6720 },
      { id: 'O5', name: 'Sarjapur Jn', lat: 12.9080, lng: 77.6650 }
    ],
    mapCenter: [12.9320, 77.6830],
    mapZoom: 13,
    totalDuration: 80,
    events: SC02_EVENTS
  },
  SC03: {
    id: 'SC03',
    code: 'SC03',
    name: 'Hebbal Peak Congestion',
    label: 'Hebbal Peak',
    severity: 2,
    description: 'Peak-hour adaptive signal plan for Hebbal',
    junctions: [
      { id: 'H1', name: 'Hebbal Flyover', lat: 13.0350, lng: 77.5970 },
      { id: 'H2', name: 'Mekhri Circle', lat: 13.0150, lng: 77.5850 },
      { id: 'H3', name: 'Bellary Rd', lat: 13.0450, lng: 77.5910 },
      { id: 'H4', name: 'Nagawara', lat: 13.0430, lng: 77.6220 },
      { id: 'H5', name: 'Ganga Nagar', lat: 13.0290, lng: 77.5780 }
    ],
    mapCenter: [13.0310, 77.5970],
    mapZoom: 13,
    totalDuration: 95,
    events: SC03_EVENTS
  }
}
