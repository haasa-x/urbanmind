import React, { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import DeptLayout from './DeptLayout'
import { SCENARIOS } from '../../data/scenarios'
import { nearestFireStation } from '../../data/fireStations'

const THEME = '#ea580c'

const FIRE_KEYWORDS = ['fire', 'smoke', 'hazmat', 'chemical spill', 'burn', 'flame', 'blaze']

function looksLikeFire(text) {
  const s = (text || '').toLowerCase()
  return FIRE_KEYWORDS.some(k => s.includes(k))
}

const incidentIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#ff3366;box-shadow:0 0 12px #ff3366;border:2px solid #fff;animation:pulseRed 1.4s ease-in-out infinite"></div>`,
  className: 'f-incident', iconSize: [20, 20], iconAnchor: [10, 10],
})
const stationIcon = L.divIcon({
  html: `<div style="width:24px;height:24px;border-radius:4px;background:${THEME};border:2px solid #fff;box-shadow:0 0 12px ${THEME};display:flex;align-items:center;justify-content:center;font-size:14px">🚒</div>`,
  className: 'f-station', iconSize: [24, 24], iconAnchor: [12, 12],
})
const truckIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;background:${THEME};border:2px solid #fff;box-shadow:0 0 12px ${THEME};display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">F</div>`,
  className: 'f-truck', iconSize: [16, 16], iconAnchor: [8, 8],
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

export default function FireDashboard() {
  const defaultScenario = SCENARIOS.SC01
  const [scenario, setScenario] = useState(defaultScenario)
  const [emergency, setEmergency] = useState(false)
  const [fireRoute, setFireRoute] = useState(null) // { positions, duration_min, distance_km }
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
      setFireRoute(null)
      setT0(null)
      // Any scenario coming through means active incident; keep fire route conditional on emergency
    } else if (evt.type === 'SET_EMERGENCY') {
      const v = !!evt.data.value
      setEmergency(v)
      if (v && !t0) setT0(Date.now())
      if (!v) setT0(null)
    } else if (evt.type === 'SET_HOSPITAL' && evt.data) {
      // Fire doesn't need hospital, ignore silently
    } else if (evt.type === 'SNAPSHOT') {
      const s = evt.data || {}
      if (s.custom_scenario) {
        setScenario(prev => (prev && prev.id === s.custom_scenario.id) ? prev : s.custom_scenario)
      }
      if (typeof s.emergency_active === 'boolean') {
        setEmergency(s.emergency_active)
        if (s.emergency_active && !t0) setT0(Date.now())
      }
    }
  }

  const station = useMemo(() => nearestFireStation(origin.lat, origin.lng), [origin.lat, origin.lng])

  // Fetch OSRM route from station -> incident when there is an active incident
  useEffect(() => {
    if (!emergency) { setFireRoute(null); return }
    if (!station || !origin) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('http://localhost:8000/route', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin_lat: station.lat, origin_lon: station.lng,
            dest_lat: origin.lat, dest_lon: origin.lng,
            alternatives: false,
          })
        })
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        const p = j && j.primary
        if (p && Array.isArray(p.geometry)) {
          setFireRoute({
            positions: p.geometry,
            duration_min: p.duration_min ?? p.eta_minutes ?? 6,
            distance_km: p.distance_km ?? 2.5,
          })
        } else {
          setFireRoute({
            positions: [[station.lat, station.lng], [origin.lat, origin.lng]],
            duration_min: 6, distance_km: 2.5,
          })
        }
      } catch {
        if (!cancelled) {
          setFireRoute({
            positions: [[station.lat, station.lng], [origin.lat, origin.lng]],
            duration_min: 6, distance_km: 2.5,
          })
        }
      }
    })()
    return () => { cancelled = true }
  }, [emergency, station && station.name, origin.lat, origin.lng, scenario && scenario.id])

  const elapsedSec = t0 ? Math.floor((now - t0) / 1000) : 0
  const etaSec = fireRoute ? (fireRoute.duration_min || 6) * 60 : 6 * 60
  const truckFrac = t0 && fireRoute ? elapsedSec / etaSec : 0
  const truckPos = useMemo(() => fireRoute ? interpolateAlong(fireRoute.positions, truckFrac) : null, [fireRoute, truckFrac])

  return (
    <DeptLayout theme={THEME} title="Fire & Rescue Command" icon="🚒" filterDepartment="Fire" onEvent={handleEvent}>
      {({ alerts, density }) => {
        const latest = alerts[alerts.length - 1]
        const latestMsg = latest ? latest.message : ''
        const scenarioLabel = (scenario && (scenario.label || scenario.description)) || ''
        const fireActive = emergency && (
          alerts.length > 0 ||
          looksLikeFire(latestMsg) ||
          looksLikeFire(scenarioLabel) ||
          scenario && scenario.id !== defaultScenario.id
        )
        const sc = scenario
        const showStandby = !fireActive && alerts.length === 0
        return (
          <>
            {showStandby ? (
              <div style={{ background: 'rgba(234,88,12,0.1)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🟢</div>
                <div style={{ fontSize: 20, letterSpacing: 3, fontWeight: 700, color: '#fdba74' }}>STANDBY</div>
                <div style={{ fontSize: 12, color: '#fdba74', marginTop: 4 }}>No active fire or hazmat incidents.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ background: 'rgba(234,88,12,0.15)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: '#fdba74' }}>FIRE RESPONSE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 4 }}>{station.name}</div>
                  <div style={{ fontSize: 11, color: '#fdba74', marginTop: 4 }}>1 engine dispatched</div>
                  <div style={{ fontSize: 11, color: '#fdba74', marginTop: 2 }}>
                    {fireRoute ? `${(fireRoute.distance_km || 0).toFixed(1)} km · ETA ${Math.round(fireRoute.duration_min || 0)} min` : 'Route pending…'}
                  </div>
                </div>
                <div style={{ background: 'rgba(234,88,12,0.15)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: '#fdba74', marginBottom: 6 }}>ACCESS ROUTES</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
                    <li>Primary: nearest arterial → incident zone</li>
                    <li>Alt 1: ring road bypass (avoids cross-traffic)</li>
                    <li>Alt 2: inner road (narrow, +4 min)</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(234,88,12,0.15)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: '#fdba74', marginBottom: 6 }}>LATEST DISPATCH</div>
                  <div style={{ fontSize: 12, color: '#fff' }}>{latestMsg || 'Awaiting dispatch…'}</div>
                </div>
              </div>
            )}
            <div style={{ height: 300, borderRadius: 8, overflow: 'hidden', border: `1px solid ${THEME}` }}>
              <MapContainer
                key={`fire-map-${(sc && sc.id) || 'default'}`}
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
                {fireRoute && Array.isArray(fireRoute.positions) && fireRoute.positions.length > 1 && (
                  <>
                    <Polyline positions={fireRoute.positions} pathOptions={{ color: THEME, weight: 5, opacity: 0.9 }} />
                    <FitToBounds positions={fireRoute.positions} />
                  </>
                )}
                <Marker position={[station.lat, station.lng]} icon={stationIcon}>
                  <Popup><b>{station.name}</b></Popup>
                </Marker>
                {emergency && <Marker position={[origin.lat, origin.lng]} icon={incidentIcon} />}
                {emergency && truckPos && <Marker position={truckPos} icon={truckIcon}><Popup>Fire Engine</Popup></Marker>}
              </MapContainer>
            </div>
          </>
        )
      }}
    </DeptLayout>
  )
}
