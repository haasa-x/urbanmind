import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { SCENARIOS, HOSPITALS, nearestHospital } from '../../data/scenarios'

/* Scoped color tokens - do not pollute global palette */
const T = {
  bg: '#0a0f1a',
  surface: '#111827',
  border: '#1f2937',
  accent: '#e11d48',
  warn: '#fb923c',
  success: '#10b981',
  textPrimary: '#f9fafb',
  textMuted: '#6b7280',
}

const font = { fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }

const sevColor = (n) => n >= 5 ? T.accent : n >= 4 ? '#f43f5e' : n >= 3 ? T.warn : n >= 2 ? '#eab308' : T.success

const incidentIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:${T.accent};box-shadow:0 0 12px ${T.accent};border:2px solid #fff;animation:pulseRed 1.4s ease-in-out infinite"></div>`,
  className: 'amb-incident', iconSize: [18, 18], iconAnchor: [9, 9],
})
const hospitalIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;background:${T.success};box-shadow:0 0 10px ${T.success};border:2px solid #fff"></div>`,
  className: 'amb-hosp', iconSize: [16, 16], iconAnchor: [8, 8],
})
const youIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2px solid #fff;box-shadow:0 0 10px #3b82f6"></div>`,
  className: 'amb-you', iconSize: [14, 14], iconAnchor: [7, 7],
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

function hhmmss(sec) {
  if (sec < 0) sec = 0
  const h = String(Math.floor(sec / 3600)).padStart(2, '0')
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const s = String(Math.floor(sec % 60)).padStart(2, '0')
  return `${h}:${m}:${s}`
}

/* Deterministic mock turn-by-turn instructions built from route length. */
function synthTurns(distanceKm, hospitalName) {
  const km = Math.max(0.4, distanceKm || 2)
  const legs = Math.max(3, Math.min(6, Math.round(km * 1.2)))
  const roads = ['Hosur Rd', 'Silk Board Jn', 'Bannerghatta Rd', 'BTM Ring Rd', 'Koramangala 4th Blk', 'Inner Ring Rd', 'HAL Old Airport Rd']
  const arrows = ['↑', '→', '←', '↑', '→', '↑']
  const perLegKm = km / legs
  return Array.from({ length: legs }).map((_, i) => ({
    arrow: arrows[i % arrows.length],
    road: roads[i % roads.length],
    distance_m: Math.round(perLegKm * 1000 * (i === legs - 1 ? 0.6 : 1)),
    instruction: i === legs - 1 ? `Arrive at ${hospitalName || 'destination'}` : `Continue on ${roads[i % roads.length]}`,
  }))
}

export default function AmbulanceDashboard() {
  const defaultScenario = SCENARIOS.SC01
  const [scenario, setScenario] = useState(defaultScenario)
  const origin = (scenario && scenario.junctions && scenario.junctions[0]) || defaultScenario.junctions[0]

  const [emergency, setEmergency] = useState(false)
  const [hospital, setHospital] = useState(nearestHospital(origin.lat, origin.lng, true))
  const [alerts, setAlerts] = useState([])
  const [medical, setMedical] = useState([])
  const [t0, setT0] = useState(null) // ms epoch of emergency start
  const [now, setNow] = useState(Date.now())
  const [route, setRoute] = useState(null) // { positions, duration_min, distance_km }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Vitals / mechanism / etc.
  const [hr, setHr] = useState('')
  const [bp, setBp] = useState('')
  const [spo2, setSpo2] = useState('')
  const [gcs, setGcs] = useState('')
  const [mechanism, setMechanism] = useState(new Set())
  const [consciousness, setConsciousness] = useState('Alert')
  const [injuries, setInjuries] = useState('')
  const [meds, setMeds] = useState('')
  const [sending, setSending] = useState(false)
  const [briefResult, setBriefResult] = useState(null)
  const [briefError, setBriefError] = useState(null)
  const [showRaw, setShowRaw] = useState(false)

  const toggleMech = (m) => {
    setMechanism(prev => {
      const s = new Set(prev)
      if (s.has(m)) s.delete(m); else s.add(m)
      return s
    })
  }

  // SSE — own connection
  useEffect(() => {
    let es
    try {
      es = new EventSource('http://localhost:8000/stream')
      es.onmessage = (e) => {
        let evt
        try { evt = JSON.parse(e.data) } catch { return }
        if (!evt || !evt.type) return
        if (evt.type === 'SCENARIO_LOADED' && evt.data) {
          setScenario(evt.data)
          // Re-pick nearest trauma-capable hospital for the new origin so the
          // mini-map is not stuck on the SC01 default. Backend may override
          // via SET_HOSPITAL a moment later.
          const j0 = (evt.data.junctions && evt.data.junctions[0]) || null
          if (j0) setHospital(nearestHospital(j0.lat, j0.lng, true))
        } else if (evt.type === 'SET_EMERGENCY') {
          const v = !!evt.data.value
          setEmergency(v)
          if (v && !t0) setT0(Date.now())
          if (!v) setT0(null)
        } else if (evt.type === 'SET_HOSPITAL' && evt.data) {
          const d = evt.data
          if (d.lat && (d.lng || d.lon)) setHospital({ ...d, lng: d.lng ?? d.lon })
        } else if (evt.type === 'ADD_ALERT') {
          setAlerts(a => [...a, { ...evt.data, timestamp: new Date().toISOString() }])
        } else if (evt.type === 'MEDICAL_ASSESSMENT') {
          setMedical(m => [...m, { ...evt.data, timestamp: new Date().toISOString() }])
        } else if (evt.type === 'SNAPSHOT') {
          const s = evt.data || {}
          // Idempotent: SSE auto-reconnects re-send SNAPSHOT. Only apply
          // material changes so the dashboard does not flicker every reconnect.
          if (s.custom_scenario) {
            setScenario(prev => (prev && prev.id === s.custom_scenario.id) ? prev : s.custom_scenario)
            const j0 = (s.custom_scenario.junctions && s.custom_scenario.junctions[0]) || null
            if (j0 && !s.selected_hospital) {
              setHospital(prev => prev ? prev : nearestHospital(j0.lat, j0.lng, true))
            }
          }
          if (typeof s.emergency_active === 'boolean') {
            setEmergency(prev => prev === s.emergency_active ? prev : s.emergency_active)
            if (s.emergency_active && !t0) setT0(Date.now())
          }
          if (s.selected_hospital && s.selected_hospital.lat) {
            const d = s.selected_hospital
            setHospital(prev => (prev && prev.name === d.name) ? prev : { ...d, lng: d.lng ?? d.lon })
          }
          if (Array.isArray(s.department_alerts)) {
            setAlerts(prev => prev.length === s.department_alerts.length ? prev : s.department_alerts)
          }
        }
      }
    } catch {}
    return () => { es && es.close() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch route once we have emergency + hospital
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
          // fallback synthetic straight line
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
  }, [hospital && hospital.lat, hospital && hospital.lng, origin.lat, origin.lng])

  const elapsedSec = t0 ? Math.floor((now - t0) / 1000) : 0
  const etaMin = route ? route.duration_min : 8
  const etaSec = etaMin * 60
  const progressPct = t0 ? Math.min(100, Math.round((elapsedSec / etaSec) * 100)) : 0
  const remainingMin = Math.max(0, Math.ceil(etaMin - elapsedSec / 60))

  // Position along the route based on progress
  const youPos = useMemo(() => {
    if (!route || !Array.isArray(route.positions) || route.positions.length < 2) return null
    const idxF = (route.positions.length - 1) * (progressPct / 100)
    const i = Math.max(0, Math.min(route.positions.length - 1, Math.floor(idxF)))
    const f = idxF - i
    const a = route.positions[i]
    const b = route.positions[Math.min(i + 1, route.positions.length - 1)]
    if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return null
    const lat = a[0] + (b[0] - a[0]) * f
    const lng = a[1] + (b[1] - a[1]) * f
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return [lat, lng]
  }, [route, progressPct])

  // Turn instructions
  const turns = useMemo(() => {
    if (!route) return []
    return synthTurns(route.distance_km, hospital && hospital.name)
  }, [route, hospital && hospital.name])

  const totalTurnDist = turns.reduce((s, t) => s + t.distance_m, 0) || 1
  const activeTurnIdx = useMemo(() => {
    let progressed = totalTurnDist * (progressPct / 100)
    for (let i = 0; i < turns.length; i++) {
      if (progressed < turns[i].distance_m) return i
      progressed -= turns[i].distance_m
    }
    return Math.max(0, turns.length - 1)
  }, [turns, progressPct, totalTurnDist])
  const activeTurn = turns[activeTurnIdx]
  const activeTurnRemaining = activeTurn ? Math.max(0, activeTurn.distance_m - Math.round((totalTurnDist * (progressPct / 100)) - turns.slice(0, activeTurnIdx).reduce((s, t) => s + t.distance_m, 0))) : 0

  // Corridor: use scenario junctions (5)
  const junctions = scenario.junctions
  const activeJunctions = Math.min(junctions.length, Math.max(1, Math.round((progressPct / 100) * junctions.length)))
  const nextJunctionIdx = Math.min(activeJunctions, junctions.length - 1)
  const allSignalsActive = activeJunctions >= junctions.length

  const capabilities = hospital ? [
    hospital.trauma && 'TRAUMA', hospital.cardiac && 'CARDIAC',
    hospital.icu && 'ICU', hospital.burn_unit && 'BURN',
  ].filter(Boolean) : []
  if (!capabilities.length && hospital && hospital.trauma !== false) capabilities.push('TRAUMA')

  // Incident info from latest alert (rough parse)
  const latestAlert = [...alerts].reverse().find(a => (a.message || '').toLowerCase().includes('incident') || (a.message || '').toLowerCase().includes('sev'))
  const sevMatch = latestAlert && /sev(?:erity)?\s*(\d)/i.exec(latestAlert.message || '')
  const parsedSev = sevMatch ? parseInt(sevMatch[1], 10) : (scenario.severity || 4)

  const citizenAlertCount = alerts.filter(a => (a.department || '').toLowerCase().includes('public')).length
  const lastCitizen = [...alerts].reverse().find(a => (a.department || '').toLowerCase().includes('public'))

  const sendBrief = async () => {
    setSending(true); setBriefError(null); setBriefResult(null)
    const raw = [
      `Vitals: HR ${hr || '—'} bpm | BP ${bp || '—'} mmHg | SpO2 ${spo2 || '—'}% | GCS ${gcs || '—'}`,
      `Mechanism of injury: ${[...mechanism].join(', ') || 'unspecified'}`,
      `Consciousness: ${consciousness}`,
      `Observed injuries: ${injuries || 'none noted'}`,
      `Medications given: ${meds || 'none'}`,
    ].join('\n')
    try {
      const r = await fetch('http://localhost:8000/medical-assessment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: 'custom', raw_assessment_text: raw }),
      })
      const j = await r.json().catch(() => ({}))
      if (j && j.error) setBriefError(j.error)
      else setBriefResult({ raw, summary: j.summary, hospital: j.hospital })
    } catch (e) {
      setBriefError(String(e && e.message || e))
    }
    setSending(false)
  }

  const label = (txt, extra = {}) => (
    <div style={{ fontSize: 9, letterSpacing: '0.22em', color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, ...extra }}>{txt}</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.textPrimary, ...font, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        height: 52, background: T.surface, borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="live-dot" style={{ width: 10, height: 10, borderRadius: '50%', background: T.accent, boxShadow: `0 0 10px ${T.accent}` }} />
          <span style={{ fontSize: 12, letterSpacing: '0.2em', fontWeight: 700 }}>AMBULANCE CREW — ACTIVE RESPONSE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.textMuted }}>ELAPSED</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: t0 ? T.textPrimary : T.textMuted, letterSpacing: '0.08em' }}>
            {hhmmss(elapsedSec)}
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* LEFT */}
        <div style={{ width: 340, background: T.surface, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

          {/* Mission Status */}
          <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
            {label('Mission Status')}
            <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 11 }}>
              <div><span style={{ color: T.textMuted }}>INCIDENT:</span> <span>{latestAlert ? 'Multi-vehicle collision' : 'Standby'} at {scenario.name}</span></div>
              <div><span style={{ color: T.textMuted }}>SEVERITY:</span> <span style={{ color: sevColor(parsedSev), fontWeight: 700 }}>{parsedSev}/5</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: T.textMuted }}>STATUS:</span>
                <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: T.success, boxShadow: `0 0 6px ${T.success}` }} />
                <span style={{ color: T.success, fontWeight: 700 }}>EN ROUTE TO HOSPITAL</span>
              </div>
            </div>
          </div>

          {/* Destination */}
          <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
            {label('Destination')}
            <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700 }}>{hospital ? hospital.name : '—'}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>HAL Area · Bengaluru</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: T.accent, lineHeight: 1 }}>{remainingMin}</div>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', color: T.textMuted }}>MIN ETA</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
              {capabilities.map(c => (
                <span key={c} style={{
                  fontSize: 9, padding: '3px 7px', borderRadius: 2,
                  border: `1px solid ${T.accent}`, color: T.accent, letterSpacing: '0.15em', fontWeight: 700,
                }}>{c}</span>
              ))}
            </div>
          </div>

          {/* Corridor Status */}
          <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
            {label('Corridor Status')}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
              {junctions.map((j, i) => {
                const active = i < activeJunctions
                const next = !active && i === nextJunctionIdx
                return (
                  <React.Fragment key={j.id}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: active ? T.success : 'transparent',
                      border: `2px solid ${active ? T.success : T.textMuted}`,
                      boxShadow: active ? `0 0 8px ${T.success}` : 'none',
                      animation: next ? 'livePulse 1.2s ease-in-out infinite' : 'none',
                    }} />
                    {i < junctions.length - 1 && <div style={{ flex: 1, height: 2, background: active ? T.success : T.border }} />}
                  </React.Fragment>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: T.textMuted }}>
              <span>{junctions[0]?.name}</span><span>{junctions[junctions.length - 1]?.name}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 10, letterSpacing: '0.15em', color: allSignalsActive ? T.success : T.warn, fontWeight: 700 }}>
              {allSignalsActive ? '● ALL SIGNALS PREEMPTED' : `▸ CURRENT: ${junctions[nextJunctionIdx]?.name || '—'}`}
            </div>
          </div>

          {/* Navigation */}
          <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
            {label('Navigation Panel')}
            {activeTurn ? (
              <>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: '0.2em' }}>NEXT TURN</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <div style={{ fontSize: 28, color: T.accent, lineHeight: 1 }}>{activeTurn.arrow}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{activeTurn.road}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: T.accent, lineHeight: 1 }}>{activeTurnRemaining}</div>
                  <div style={{ fontSize: 14, color: T.textMuted }}>m</div>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, ...font, display: 'grid', gap: 4 }}>
                  {turns.map((t, i) => (
                    <div key={i} style={{
                      color: i < activeTurnIdx ? T.textMuted : (i === activeTurnIdx ? T.textPrimary : T.textMuted),
                      textDecoration: i < activeTurnIdx ? 'line-through' : 'none',
                      opacity: i < activeTurnIdx ? 0.5 : (i === activeTurnIdx ? 1 : 0.7),
                    }}>
                      {i + 1}. {t.arrow} {t.instruction}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPct}%`, background: T.accent, transition: 'width 1s linear' }} />
                </div>
                <div style={{ marginTop: 4, fontSize: 9, color: T.textMuted, letterSpacing: '0.15em' }}>PROGRESS {progressPct}%</div>
              </>
            ) : (
              <div style={{ marginTop: 10, fontSize: 11, color: T.textMuted, fontStyle: 'italic' }}>Awaiting route…</div>
            )}
          </div>

          {/* Citizen Alerts */}
          <div style={{ padding: 16 }}>
            {label('Citizen Alerts')}
            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, color: T.textPrimary }}>{citizenAlertCount}</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
              LAST: {lastCitizen ? new Date(lastCitizen.timestamp || Date.now()).toLocaleTimeString() : '—'}
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: T.textMuted, fontStyle: 'italic' }}>
              Citizens within 200m of corridor notified
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Map */}
          <div style={{ height: 280, borderBottom: `1px solid ${T.border}`, position: 'relative' }}>
            <MapContainer
              key={`amb-map-${(scenario && scenario.id) || 'default'}`}
              center={[origin.lat, origin.lng]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png" />
              <InvalidateOnMount />
              {route && Array.isArray(route.positions) && route.positions.length > 1 && (
                <>
                  <Polyline positions={route.positions} pathOptions={{ color: T.accent, weight: 4, opacity: 0.95 }} />
                  <FitToBounds positions={route.positions} />
                </>
              )}
              {Number.isFinite(origin.lat) && Number.isFinite(origin.lng) && (
                <Marker position={[origin.lat, origin.lng]} icon={incidentIcon} />
              )}
              {hospital && Number.isFinite(hospital.lat) && Number.isFinite(hospital.lng ?? hospital.lon) && (
                <Marker position={[hospital.lat, hospital.lng ?? hospital.lon]} icon={hospitalIcon} />
              )}
              {youPos && Array.isArray(youPos) && Number.isFinite(youPos[0]) && Number.isFinite(youPos[1]) && (
                <Marker position={youPos} icon={youIcon} />
              )}
            </MapContainer>
            <div style={{
              position: 'absolute', top: 10, right: 10, zIndex: 500,
              background: 'rgba(10,15,26,0.92)', border: `1px solid ${T.border}`,
              padding: '4px 8px', fontSize: 9, color: T.textMuted, letterSpacing: '0.15em',
            }}>YOU ARE HERE — {progressPct}%</div>
          </div>

          {/* Field Assessment */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {label('Field Assessment')}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { l: 'HR (bpm)', v: hr, s: setHr },
                { l: 'BP (mmHg)', v: bp, s: setBp },
                { l: 'SpO₂ (%)', v: spo2, s: setSpo2 },
                { l: 'GCS 3-15', v: gcs, s: setGcs },
              ].map(f => (
                <label key={f.l} style={{ display: 'block' }}>
                  <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: '0.15em', marginBottom: 4 }}>{f.l}</div>
                  <input value={f.v} onChange={e => f.s(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '6px 8px', ...font,
                      background: T.bg, color: T.textPrimary, border: `1px solid ${T.border}`, borderRadius: 2,
                      fontSize: 12,
                    }} />
                </label>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: '0.15em', marginBottom: 6 }}>MECHANISM OF INJURY</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Road Traffic Accident', 'Fall', 'Assault', 'Medical', 'Burns', 'Other'].map(m => {
                  const on = mechanism.has(m)
                  return (
                    <button key={m} onClick={() => toggleMech(m)} style={{
                      padding: '5px 10px', ...font, fontSize: 10, cursor: 'pointer',
                      background: on ? T.accent : 'transparent', color: on ? '#fff' : T.textPrimary,
                      border: `1px solid ${on ? T.accent : T.border}`, borderRadius: 2, letterSpacing: '0.05em',
                    }}>{m}</button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: '0.15em', marginBottom: 6 }}>CONSCIOUSNESS</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Alert', 'Voice', 'Pain', 'Unresponsive'].map(c => {
                  const on = consciousness === c
                  return (
                    <button key={c} onClick={() => setConsciousness(c)} style={{
                      padding: '5px 12px', ...font, fontSize: 10, cursor: 'pointer',
                      background: on ? T.accent : 'transparent', color: on ? '#fff' : T.textPrimary,
                      border: `1px solid ${on ? T.accent : T.border}`, borderRadius: 2, letterSpacing: '0.05em',
                    }}>{c}</button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: '0.15em', marginBottom: 6 }}>OBSERVED INJURIES</div>
              <textarea value={injuries} onChange={e => setInjuries(e.target.value)} rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 10px', ...font, fontSize: 12,
                  background: T.bg, color: T.textPrimary, border: `1px solid ${T.border}`, borderRadius: 2, resize: 'vertical',
                }} />
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: '0.15em', marginBottom: 6 }}>MEDICATIONS GIVEN</div>
              <input value={meds} onChange={e => setMeds(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '6px 10px', ...font, fontSize: 12,
                  background: T.bg, color: T.textPrimary, border: `1px solid ${T.border}`, borderRadius: 2,
                }} />
            </div>

            <button onClick={sendBrief} disabled={sending}
              style={{
                marginTop: 16, width: '100%', padding: '12px', ...font, fontSize: 12, letterSpacing: '0.2em', fontWeight: 700,
                background: sending ? '#4b1523' : T.accent, color: '#fff', border: 'none', borderRadius: 2,
                cursor: sending ? 'wait' : 'pointer',
              }}>
              {sending ? 'SENDING…' : 'SEND PRE-ARRIVAL BRIEF'}
            </button>

            {briefError && (
              <div style={{ marginTop: 10, padding: 10, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 11 }}>
                {briefError}
              </div>
            )}
            {briefResult && (
              <div style={{ marginTop: 10, padding: 10, border: `1px solid ${T.success}`, background: 'rgba(16,185,129,0.08)' }}>
                <div style={{ color: T.success, fontSize: 11, letterSpacing: '0.15em', fontWeight: 700 }}>
                  ✓ HOSPITAL NOTIFIED — PRE-ARRIVAL BRIEF SENT
                </div>
                {briefResult.summary && (
                  <div style={{ marginTop: 8, fontSize: 11, display: 'grid', gap: 4 }}>
                    <div><b>Condition:</b> {briefResult.summary.condition_summary}</div>
                    <div><b>Consciousness:</b> {briefResult.summary.consciousness_level}</div>
                    <div><b>Injury:</b> {briefResult.summary.injury_summary}</div>
                    <div><b>Prepare:</b> {briefResult.summary.recommended_preparations}</div>
                  </div>
                )}
                <button onClick={() => setShowRaw(v => !v)} style={{
                  marginTop: 8, background: 'transparent', border: `1px solid ${T.border}`, color: T.textMuted,
                  padding: '4px 8px', ...font, fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em',
                }}>{showRaw ? 'HIDE' : 'VIEW'} RAW OBSERVATIONS</button>
                {showRaw && (
                  <pre style={{ marginTop: 6, fontSize: 10, color: T.textMuted, whiteSpace: 'pre-wrap' }}>{briefResult.raw}</pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
