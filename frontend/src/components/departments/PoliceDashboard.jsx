import React, { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import DeptLayout from './DeptLayout'
import { SCENARIOS, nearestHospital } from '../../data/scenarios'
import { nearestPoliceStation } from '../../data/policeStations'

const THEME = '#1d4ed8'

function extractUnits(msg) {
  const m = /(\d+)\s*units?\s*(?:deployed|dispatched|assigned)?/i.exec(msg || '')
  return m ? m[1] : null
}

const incidentIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#ff3366;box-shadow:0 0 12px #ff3366;border:2px solid #fff;animation:pulseRed 1.4s ease-in-out infinite"></div>`,
  className: 'p-incident', iconSize: [20, 20], iconAnchor: [10, 10],
})
const hospitalIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#10b981;box-shadow:0 0 10px #10b981;border:2px solid #fff"></div>`,
  className: 'p-hosp', iconSize: [16, 16], iconAnchor: [8, 8],
})
const stationIcon = L.divIcon({
  html: `<div style="width:22px;height:22px;border-radius:4px;background:${THEME};border:2px solid #fff;box-shadow:0 0 10px ${THEME};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700">★</div>`,
  className: 'p-station', iconSize: [22, 22], iconAnchor: [11, 11],
})
const ambIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#e11d48;border:2px solid #fff;box-shadow:0 0 10px #e11d48"></div>`,
  className: 'p-amb', iconSize: [14, 14], iconAnchor: [7, 7],
})
const escortIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;background:${THEME};border:2px solid #fff;box-shadow:0 0 12px ${THEME};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">▲</div>`,
  className: 'p-escort', iconSize: [16, 16], iconAnchor: [8, 8],
})

function FitToBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions && positions.length > 1) {
      try { map.fitBounds(positions, { padding: [30, 30] }) } catch {}
    }
  }, [positions && positions.length])
  return null
}

function InvalidateOnMount() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(t)
  }, [map])
  return null
}

function interpolateAlong(positions, fraction) {
  if (!Array.isArray(positions) || positions.length < 2) return null
  const f = Math.max(0, Math.min(1, fraction))
  const idxF = (positions.length - 1) * f
  const i = Math.max(0, Math.min(positions.length - 1, Math.floor(idxF)))
  const t = idxF - i
  const a = positions[i]
  const b = positions[Math.min(i + 1, positions.length - 1)]
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return null
  const lat = a[0] + (b[0] - a[0]) * t
  const lng = a[1] + (b[1] - a[1]) * t
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return [lat, lng]
}

export default function PoliceDashboard() {
  const defaultScenario = SCENARIOS.SC01
  const [scenario, setScenario] = useState(defaultScenario)
  const [hospital, setHospital] = useState(null)
  const [route, setRoute] = useState(null) // { positions, duration_min, distance_km }
  const [t0, setT0] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const origin = (scenario && scenario.junctions && scenario.junctions[0]) || defaultScenario.junctions[0]

  const handleEvent = (evt) => {
    if (!evt || !evt.type) return
    if (evt.type === 'SCENARIO_LOADED' && evt.data) {
      setScenario(evt.data)
      setRoute(null)
      setT0(null)
      const j0 = (evt.data.junctions && evt.data.junctions[0]) || null
      if (j0) setHospital(nearestHospital(j0.lat, j0.lng, true))
    } else if (evt.type === 'SET_EMERGENCY') {
      const v = !!evt.data.value
      if (v && !t0) setT0(Date.now())
      if (!v) setT0(null)
    } else if (evt.type === 'SET_HOSPITAL' && evt.data) {
      const d = evt.data
      if (d.lat && (d.lng || d.lon)) setHospital({ ...d, lng: d.lng ?? d.lon })
    } else if (evt.type === 'SNAPSHOT') {
      const s = evt.data || {}
      if (s.custom_scenario) {
        setScenario(prev => (prev && prev.id === s.custom_scenario.id) ? prev : s.custom_scenario)
        const j0 = (s.custom_scenario.junctions && s.custom_scenario.junctions[0]) || null
        if (j0 && !s.selected_hospital) {
          setHospital(prev => prev ? prev : nearestHospital(j0.lat, j0.lng, true))
        }
      }
      if (s.selected_hospital && s.selected_hospital.lat) {
        const d = s.selected_hospital
        setHospital(prev => (prev && prev.name === d.name) ? prev : { ...d, lng: d.lng ?? d.lon })
      }
      if (typeof s.emergency_active === 'boolean' && s.emergency_active && !t0) {
        setT0(Date.now())
      }
    }
  }

  // Fetch OSRM route once we have hospital coords
  useEffect(() => {
    if (!hospital || !hospital.lat) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('http://localhost:8000/route', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin_lat: origin.lat, origin_lon: origin.lng,
            dest_lat: hospital.lat, dest_lon: hospital.lng ?? hospital.lon,
            alternatives: false,
          })
        })
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        const p = j && j.primary
        if (p && Array.isArray(p.geometry)) {
          setRoute({
            positions: p.geometry,
            duration_min: p.duration_min ?? p.eta_minutes ?? 8,
            distance_km: p.distance_km ?? 2.5,
          })
        } else {
          setRoute({
            positions: [[origin.lat, origin.lng], [hospital.lat, hospital.lng ?? hospital.lon]],
            duration_min: 8, distance_km: 3,
          })
        }
      } catch {
        if (!cancelled) {
          setRoute({
            positions: [[origin.lat, origin.lng], [hospital.lat, hospital.lng ?? hospital.lon]],
            duration_min: 8, distance_km: 3,
          })
        }
      }
    })()
    return () => { cancelled = true }
  }, [hospital && hospital.lat, hospital && hospital.lng, origin.lat, origin.lng, scenario && scenario.id])

  const station = useMemo(() => nearestPoliceStation(origin.lat, origin.lng), [origin.lat, origin.lng])

  const elapsedSec = t0 ? Math.floor((now - t0) / 1000) : 0
  const etaSec = route ? (route.duration_min || 8) * 60 : 8 * 60
  const ambFrac = t0 ? elapsedSec / etaSec : 0
  const escortFrac = t0 ? (elapsedSec + 30) / etaSec : 0
  const ambPos = useMemo(() => route ? interpolateAlong(route.positions, ambFrac) : null, [route, ambFrac])
  const escortPos = useMemo(() => route ? interpolateAlong(route.positions, escortFrac) : null, [route, escortFrac])

  return (
    <DeptLayout theme={THEME} title="Traffic Police Control Room" icon="🚔" filterDepartment="Traffic Police" onEvent={handleEvent}>
      {({ alerts, emergency, density }) => {
        const latest = alerts[alerts.length - 1]
        const units = latest ? extractUnits(latest.message) : null
        const sc = scenario
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ background: 'rgba(29,78,216,0.15)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: '#93c5fd' }}>DEPLOYMENT STATUS</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>{units || '—'} <span style={{ fontSize: 12, letterSpacing: 2 }}>UNITS</span></div>
                <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 4 }}>{emergency ? 'ACTIVE INCIDENT' : 'STANDBY'}</div>
              </div>
              <div style={{ background: 'rgba(29,78,216,0.15)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: '#93c5fd', marginBottom: 6 }}>DIVERSION ROUTES</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
                  <li>Inbound via BTM Ring Road</li>
                  <li>ORR service road bypass</li>
                  <li>Hosur Rd → Koramangala loop</li>
                </ul>
              </div>
              <div style={{ background: 'rgba(29,78,216,0.15)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: '#93c5fd', marginBottom: 6 }}>ESCORT ASSIGNMENT</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{station.name}</div>
                <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 4 }}>1 unit escorting {hospital ? hospital.name : '—'}</div>
                <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 2 }}>
                  {route ? `${(route.distance_km || 0).toFixed(1)} km · ETA ${Math.round(route.duration_min || 0)} min` : 'Route pending…'}
                </div>
              </div>
            </div>
            <div style={{ height: 300, borderRadius: 8, overflow: 'hidden', border: `1px solid ${THEME}` }}>
              <MapContainer
                key={`police-map-${(sc && sc.id) || 'default'}`}
                center={sc.mapCenter || [origin.lat, origin.lng]}
                zoom={sc.mapZoom || 13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png" attribution='&copy; Stadia' />
                <InvalidateOnMount />
                {sc.junctions.map(j => {
                  const d = density[j.id] ?? 0.4
                  return <CircleMarker key={j.id} center={[j.lat, j.lng]} radius={8 + d*8} pathOptions={{ color: THEME, fillColor: THEME, fillOpacity: 0.4 }}>
                    <Popup><b>{j.name}</b> · {(d*100).toFixed(0)}%</Popup>
                  </CircleMarker>
                })}
                {route && Array.isArray(route.positions) && route.positions.length > 1 && (
                  <>
                    <Polyline positions={route.positions} pathOptions={{ color: THEME, weight: 5, opacity: 0.9 }} />
                    <FitToBounds positions={route.positions} />
                  </>
                )}
                <Marker position={[station.lat, station.lng]} icon={stationIcon}>
                  <Popup><b>{station.name}</b></Popup>
                </Marker>
                {hospital && Number.isFinite(hospital.lat) && Number.isFinite(hospital.lng ?? hospital.lon) && (
                  <Marker position={[hospital.lat, hospital.lng ?? hospital.lon]} icon={hospitalIcon}>
                    <Popup><b>{hospital.name}</b></Popup>
                  </Marker>
                )}
                {emergency && <Marker position={[origin.lat, origin.lng]} icon={incidentIcon} />}
                {emergency && ambPos && <Marker position={ambPos} icon={ambIcon}><Popup>Ambulance</Popup></Marker>}
                {emergency && escortPos && <Marker position={escortPos} icon={escortIcon}><Popup>Escort (30s ahead)</Popup></Marker>}
              </MapContainer>
            </div>
          </>
        )
      }}
    </DeptLayout>
  )
}
