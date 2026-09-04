import React, { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { densityColor } from '../utils/densityColor'

function FlyTo({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 14, { duration: 1.2 })
  }, [center, zoom])
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

function FitToRoute({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions && positions.length > 1) {
      try { map.fitBounds(positions, { padding: [60, 60] }) } catch {}
    }
  }, [positions])
  return null
}

function junctionIcon(d, isInCorridor) {
  const c = densityColor(d)
  const pulse = d > 0.75 ? 'pulse' : ''
  const corridor = isInCorridor ? `box-shadow: 0 0 0 3px rgba(255,255,255,0.9), 0 0 18px ${c};` : ''
  const html = `
    <div class="junction-marker ${pulse}">
      <div class="ring-outer" style="background:${c}"></div>
      <div class="ring-mid" style="background:${c}"></div>
      <div class="core" style="background:${c}; box-shadow: 0 0 14px ${c}; ${corridor}"></div>
    </div>`
  return L.divIcon({ html, className: 'junction-divicon', iconSize: [40, 40], iconAnchor: [20, 20] })
}

function labelIcon(text, d) {
  const c = densityColor(d)
  const html = `<div class="jlabel" style="border-left:2px solid ${c}">${text} · ${(d*100).toFixed(0)}%</div>`
  return L.divIcon({ html, className: 'jlabel-divicon', iconSize: [80, 16], iconAnchor: [40, -14] })
}

const incidentIcon = L.divIcon({
  html: `<div class="incident-marker">!</div>`,
  className: 'incident-divicon',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const hospitalIcon = L.divIcon({
  html: `<div class="hospital-marker"><span>🏥</span></div>`,
  className: 'hospital-divicon',
  iconSize: [40, 50],
  iconAnchor: [20, 50],
})

const hospitalDimIcon = L.divIcon({
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#64748b;display:flex;align-items:center;justify-content:center;font-size:9px;opacity:0.5;">🏥</div>`,
  className: 'hospital-dim-divicon',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

async function fetchOSRM(lat1, lng1, lat2, lng2, cacheKey) {
  const body = {
    origin_lat: lat1, origin_lon: lng1,
    dest_lat: lat2, dest_lon: lng2,
    alternatives: true,
  }
  if (cacheKey) body.cache_key = cacheKey
  const r = await fetch('http://localhost:8000/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error('route error')
  const j = await r.json()
  const list = []
  if (j.primary) list.push(j.primary)
  if (Array.isArray(j.alternatives)) list.push(...j.alternatives)
  if (!list.length) throw new Error('no routes')
  return list.map(rt => ({
    positions: rt.geometry || [],
    duration_min: rt.duration_min ?? rt.eta_minutes ?? 0,
    distance_km: rt.distance_km ?? 0,
  }))
}

// Heuristic: does the destination look like Manipal HAL, and origin like Silk Board (J1)?
function pickCacheKey(origin, dest) {
  const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps
  // Silk Board ~ 12.917, 77.622 ; Manipal HAL ~ 12.960, 77.649
  if (near(origin.lat, 12.917, 0.02) && near(origin.lng, 77.622, 0.02)
      && near(dest.lat, 12.960, 0.02) && near(dest.lng, 77.649, 0.02)) {
    return 'J1_to_manipal'
  }
  return null
}

export default function CityMap({
  scenario, density, routeVisible, hospital, emergency, allHospitals = [],
  onRoutesLoaded,
}) {
  const [routes, setRoutes] = useState(null)
  const [routesKey, setRoutesKey] = useState('')

  useEffect(() => {
    if (!emergency || !hospital || !hospital.lat || !scenario) {
      setRoutes(null); setRoutesKey('')
      if (onRoutesLoaded) onRoutesLoaded(null)
      return
    }
    const origin = scenario.junctions[0]
    if (!origin) return
    const key = `${origin.lat},${origin.lng}->${hospital.lat},${hospital.lng}`
    if (key === routesKey) return
    let cancelled = false
    ;(async () => {
      try {
        const cacheKey = pickCacheKey({lat: origin.lat, lng: origin.lng}, {lat: hospital.lat, lng: hospital.lng})
        const rs = await fetchOSRM(origin.lat, origin.lng, hospital.lat, hospital.lng, cacheKey)
        if (cancelled) return
        setRoutes(rs); setRoutesKey(key)
        if (onRoutesLoaded) {
          const [p, a1, a2] = rs
          onRoutesLoaded({
            primary: p ? { duration_min: p.duration_min, distance_km: p.distance_km } : null,
            alt1: a1 ? { duration_min: a1.duration_min, distance_km: a1.distance_km, delta_min: a1.duration_min - p.duration_min } : null,
            alt2: a2 ? { duration_min: a2.duration_min, distance_km: a2.distance_km, delta_min: a2.duration_min - p.duration_min } : null,
          })
        }
      } catch (e) {
        if (!cancelled) { setRoutes(null); if (onRoutesLoaded) onRoutesLoaded(null) }
      }
    })()
    return () => { cancelled = true }
  }, [emergency, hospital && hospital.lat, hospital && hospital.lng, scenario && scenario.id])

  const first = scenario ? scenario.junctions[0] : null
  const corridorSet = useMemo(() => new Set([first ? first.id : null]), [first && first.id])

  if (!scenario) {
    return (
      <div style={{ padding: 20, color: '#94a3b8', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 32, opacity: 0.5 }}>◈</div>
        <div>Select a scenario from the sidebar to load the city map.</div>
      </div>
    )
  }

  const primary = routes && routes[0] ? routes[0].positions : null
  const alt1 = routes && routes[1] ? routes[1].positions : null
  const alt2 = routes && routes[2] ? routes[2].positions : null

  return (
    <MapContainer
      center={scenario.mapCenter}
      zoom={scenario.mapZoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
      zoomControl={true}
    >
      <TileLayer
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; OpenStreetMap contributors'
        maxZoom={20}
      />
      <FlyTo center={scenario.mapCenter} zoom={scenario.mapZoom} />
      <InvalidateOnMount />

      {routeVisible && alt2 && (
        <Polyline positions={alt2} pathOptions={{ color: '#334155', weight: 3, opacity: 0.35, dashArray: '8 6' }} />
      )}
      {routeVisible && alt1 && (
        <Polyline positions={alt1} pathOptions={{ color: '#64748b', weight: 4, opacity: 0.5, dashArray: '8 6' }} />
      )}
      {routeVisible && primary && (
        <>
          <Polyline positions={primary} pathOptions={{ color: '#38bdf8', weight: 14, opacity: 0.15 }} />
          <Polyline positions={primary} pathOptions={{ color: '#38bdf8', weight: 6, opacity: 1, className: 'animate-dash' }} />
          <FitToRoute positions={primary} />
        </>
      )}

      {scenario.junctions.map((jn) => {
        const d = density[jn.id] ?? 0.4
        const inCorridor = routeVisible && corridorSet.has(jn.id)
        return (
          <React.Fragment key={jn.id}>
            <Marker position={[jn.lat, jn.lng]} icon={junctionIcon(d, inCorridor)}>
              <Popup>
                <div style={{ color: '#0a0e14', fontFamily: 'monospace' }}>
                  <b>{jn.id} — {jn.name}</b><br />
                  Density: <b>{(d * 100).toFixed(0)}%</b><br />
                  {inCorridor && <span style={{ color: '#38bdf8' }}>● Emergency corridor</span>}
                </div>
              </Popup>
            </Marker>
            <Marker position={[jn.lat, jn.lng]} icon={labelIcon(jn.name, d)} interactive={false} />
          </React.Fragment>
        )
      })}

      {emergency && first && (
        <Circle
          center={[first.lat, first.lng]}
          radius={500}
          pathOptions={{ color: '#ff3366', fillColor: '#ff3366', fillOpacity: 0.12, weight: 2, dashArray: '6 6' }}
        />
      )}

      {allHospitals.map((h) => {
        const isSelected = hospital && hospital.name === h.name
        if (isSelected) return null
        return (
          <Marker key={h.name} position={[h.lat, h.lng]} icon={hospitalDimIcon}>
            <Popup>
              <div style={{ color: '#0a0e14', fontFamily: 'monospace' }}>
                <b>{h.name}</b><br />
                Trauma: {h.trauma ? 'Yes' : 'No'}
              </div>
            </Popup>
          </Marker>
        )
      })}

      {emergency && first && (
        <Marker position={[first.lat, first.lng]} icon={incidentIcon}>
          <Popup>
            <div style={{ color: '#0a0e14', fontFamily: 'monospace' }}>
              <b>INCIDENT ORIGIN</b><br />{first.name}
            </div>
          </Popup>
        </Marker>
      )}

      {hospital && hospital.lat && hospital.lng && (
        <Marker position={[hospital.lat, hospital.lng]} icon={hospitalIcon}>
          <Popup>
            <div style={{ color: '#0a0e14', fontFamily: 'monospace' }}>
              <b>{hospital.name}</b><br />
              Trauma: {hospital.trauma ? 'Yes' : 'No'}<br />
              ETA from J1: {hospital.eta_from_J1 ?? hospital.eta} min
            </div>
          </Popup>
        </Marker>
      )}

      <div style={{ position: 'absolute', top: 12, left: 60, zIndex: 999, display: 'flex', gap: 10, pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(13,17,23,0.92)', border: '1px solid var(--border-subtle)', padding: '6px 12px', fontSize: 10, letterSpacing: '0.2em', color: 'var(--status-green)', fontFamily: 'var(--font-mono)' }}>
          ● LIVE FEED · {scenario.junctions.length} JUNCTIONS
        </div>
        {emergency && (
          <div style={{ background: 'rgba(13,17,23,0.92)', border: '1px solid var(--status-red)', padding: '6px 12px', fontSize: 10, letterSpacing: '0.2em', color: 'var(--status-red)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            EMERGENCY CORRIDOR ACTIVE
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 24, left: 12, zIndex: 999, background: 'rgba(13,17,23,0.92)', border: '1px solid var(--border-subtle)', padding: '8px 12px', fontSize: 10, color: 'var(--text-secondary)', pointerEvents: 'none', fontFamily: 'var(--font-mono)' }}>
        <div style={{ letterSpacing: 1, color: '#94a3b8', marginBottom: 4 }}>DENSITY</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ width: 10, height: 10, background: '#10b981', display: 'inline-block', borderRadius: '50%' }} /> &lt;30%
          <span style={{ width: 10, height: 10, background: '#eab308', display: 'inline-block', borderRadius: '50%', marginLeft: 8 }} /> 30-50%
          <span style={{ width: 10, height: 10, background: '#f97316', display: 'inline-block', borderRadius: '50%', marginLeft: 8 }} /> 50-75%
          <span style={{ width: 10, height: 10, background: '#ff3366', display: 'inline-block', borderRadius: '50%', marginLeft: 8 }} /> &gt;75%
        </div>
      </div>
    </MapContainer>
  )
}
