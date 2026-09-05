import React, { useEffect, useRef, useState } from 'react'
import { Routes, Route, useSearchParams } from 'react-router-dom'
import Header from './components/Header'
import CityMap from './components/CityMap'
import AgentWorkflowPanel from './components/AgentWorkflowPanel'
import AgentTraceLog from './components/AgentTraceLog'
import NarratorPanel from './components/NarratorPanel'
import DepartmentAlertFeed from './components/DepartmentAlertFeed'
import CockpitSidebar from './components/CockpitSidebar'
import CitizenView from './components/CitizenView'
import CounterfactualPanel from './components/CounterfactualPanel'
import TemporalMind from './components/TemporalMind'
import CausalGraphSVG from './components/CausalGraphSVG'
import RoutePanel from './components/RoutePanel'
import PoliceDashboard from './components/departments/PoliceDashboard'
import HospitalDashboard from './components/departments/HospitalDashboard'
import FireDashboard from './components/departments/FireDashboard'
import PublicDashboard from './components/departments/PublicDashboard'
import BbmpDashboard from './components/departments/BbmpDashboard'
import AmbulanceDashboard from './components/departments/AmbulanceDashboard'
import ErrorBoundary from './components/ErrorBoundary'
import { SCENARIOS, HOSPITALS, nearestHospital } from './data/scenarios'
import { severityMeta } from './data/severity'
import { useTypewriter } from './hooks/useTypewriter'

function Dashboard() {
  const [searchParams] = useSearchParams()
  const initialLoc = searchParams.get('custom_location') || ''

  const [activeScenario, setActiveScenario] = useState(null)
  const [scenarioData, setScenarioData] = useState(null)
  const [density, setDensity] = useState({})
  const [emergency, setEmergency] = useState(false)
  const [routeVisible, setRouteVisible] = useState(false)
  const [hospital, setHospital] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [narrator, setNarrator] = useState({ operator: '', public: '', audit: '' })
  const [banner, setBanner] = useState(null)
  const [customBanner, setCustomBanner] = useState(null)
  const [mode, setMode] = useState('flow')
  const [sseConnected, setSse] = useState(false)
  const [activeAgents, setActiveAgents] = useState(new Set())
  const [completedAgents, setCompletedAgents] = useState(new Set())
  const [running, setRunning] = useState(false)
  const [severity, setSeverity] = useState(3)
  const [analyzing, setAnalyzing] = useState(false)
  const [routeInfo, setRouteInfo] = useState({ primary: null, alt1: null, alt2: null })
  const [supervisorPlan, setSupervisorPlan] = useState(null)
  const [medicalAssessments, setMedicalAssessments] = useState([])
  const [hospitalRoster, setHospitalRoster] = useState(HOSPITALS)
  const [sseCounter, setSseCounter] = useState({ total: 0, addMsg: 0, addAlert: 0, lastAgent: '' })

  useEffect(() => {
    fetch('http://localhost:8000/hospitals')
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d) || !d.length) return
        const mapped = d.map(h => ({
          name: h.name,
          lat: h.lat,
          lng: h.lon ?? h.lng,
          trauma: !!h.trauma,
          cardiac: !!h.cardiac,
          icu: !!h.icu,
          burn_unit: !!h.burn_unit,
          emergency: !!h.emergency,
        }))
        setHospitalRoster(mapped)
      })
      .catch(() => setHospitalRoster(HOSPITALS))
  }, [])

  const { displayedMessages, addMessage, clear: clearTypewriter } = useTypewriter(6)
  const timeoutsRef = useRef([])
  const scenarioRef = useRef(null)
  const applyEventRef = useRef(null)

  const pickNearest = (lat, lng, requireTrauma = true) => {
    const pool = (hospitalRoster && hospitalRoster.length) ? hospitalRoster : HOSPITALS
    const filt = requireTrauma ? pool.filter(h => h.trauma) : pool
    const list = filt.length ? filt : pool
    let best = list[0]; let bestD = Infinity
    for (const h of list) {
      const dx = h.lat - lat, dy = h.lng - lng
      const d = dx * dx + dy * dy
      if (d < bestD) { bestD = d; best = h }
    }
    return best
  }

  const incidentOriginFor = (sc) => {
    if (!sc) return null
    const preferred = { SC01: 'J1', SC02: 'H1', SC03: 'O1' }[sc.id]
    const j = sc.junctions.find(x => x.id === preferred)
    return j || sc.junctions[0]
  }

  useEffect(() => {
    let es
    let closed = false
    let reconnectTimer = null

    const connect = () => {
      if (closed) return
      try { es && es.close() } catch {}
      try {
        es = new EventSource('http://localhost:8000/stream')
      } catch {
        setSse(false)
        reconnectTimer = setTimeout(connect, 2000)
        return
      }
      es.onopen = () => setSse(true)
      es.onerror = () => {
        setSse(false)
        // Native EventSource retries on its own with a 3s default; force a faster,
        // deterministic reconnect so a backend restart is picked up within ~2s.
        try { es && es.close() } catch {}
        if (!closed && !reconnectTimer) {
          reconnectTimer = setTimeout(() => { reconnectTimer = null; connect() }, 2000)
        }
      }
      es.onmessage = (e) => {
        let evt
        try { evt = JSON.parse(e.data) } catch { return }
        if (!evt || !evt.type) return
        if (evt.type !== 'HEARTBEAT') {
          try {
            console.debug('[SSE]', evt.type, (evt.data && (evt.data.agent || evt.data.department || evt.data.name || '')) || '')
          } catch {}
          setSseCounter(c => ({
            total: c.total + 1,
            addMsg: c.addMsg + (evt.type === 'ADD_MESSAGE' ? 1 : 0),
            addAlert: c.addAlert + (evt.type === 'ADD_ALERT' ? 1 : 0),
            lastAgent: evt.type === 'ADD_MESSAGE' && evt.data ? (evt.data.agent || '') : c.lastAgent,
          }))
        }
        if (evt.type === 'HEARTBEAT') return
        if (evt.type === 'SNAPSHOT' && evt.data) {
          // Late-join: pick up an in-progress custom incident.
          if (evt.data.custom_scenario) {
            const sc = evt.data.custom_scenario
            setScenarioData(sc); scenarioRef.current = sc; setActiveScenario(sc.id || 'CUSTOM')
            if (evt.data.severity) setSeverity(evt.data.severity)
            if (evt.data.emergency_active) setEmergency(true)
            if (evt.data.selected_hospital) {
              const h = evt.data.selected_hospital
              setHospital({ name: h.name, lat: h.lat, lng: h.lng ?? h.lon, trauma: !!h.trauma })
              setRouteVisible(true)
            }
          }
          return
        }
        if (evt.type === 'INCREMENT_METRICS') return
        const apply = applyEventRef.current
        if (!apply) return
        if (evt.type === 'ADD_MESSAGE' && evt.data) {
          apply({ ...evt, data: { ...evt.data, agent: `🌐 ${evt.data.agent || 'System'}` } })
          return
        }
        apply(evt)
      }
    }

    connect()
    return () => {
      closed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      try { es && es.close() } catch {}
    }
  }, [])

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(id => clearTimeout(id))
    timeoutsRef.current = []
  }

  const resetState = () => {
    setDensity({})
    setEmergency(false)
    setRouteVisible(false)
    setHospital(null)
    setAlerts([])
    setNarrator({ operator: '', public: '', audit: '' })
    setBanner(null)
    setActiveAgents(new Set())
    setCompletedAgents(new Set())
    setRouteInfo({ primary: null, alt1: null, alt2: null })
    setSupervisorPlan(null)
    setMedicalAssessments([])
    clearTypewriter()
  }

  const applyEvent = (evt) => {
    const { type, data } = evt
    if (type === 'SET_DENSITY') setDensity(d => ({ ...d, ...data }))
    else if (type === 'ADD_MESSAGE') {
      const agentName = data.agent || 'System'
      addMessage({ agent: agentName, text: data.text, color: data.color || '#8b5cf6' })
      const shortName = agentName.replace('Agent', '').replace('🌐 ', '').trim()
      setActiveAgents(prev => {
        const s = new Set(prev); s.add(shortName)
        return s
      })
      setCompletedAgents(prev => {
        const s = new Set(prev); s.add(shortName)
        return s
      })
      setTimeout(() => setActiveAgents(prev => {
        const s = new Set(prev); s.delete(shortName)
        return s
      }), 2500)
    }
    else if (type === 'SET_EMERGENCY') {
      setEmergency(!!data.value)
      if (data.value) {
        const origin = incidentOriginFor(scenarioRef.current)
        if (origin) setHospital(pickNearest(origin.lat, origin.lng, true))
      }
    }
    else if (type === 'SET_ROUTE') setRouteVisible(!!data.value)
    else if (type === 'SCENARIO_LOADED') {
      if (!data) return
      // Reset stale state from a prior scripted scenario so the new custom
      // pipeline renders fresh (supervisor plan, agent messages, alerts).
      clearTypewriter()
      setSupervisorPlan(null)
      setAlerts([])
      setNarrator({ operator: '', public: '', audit: '' })
      setActiveAgents(new Set())
      setCompletedAgents(new Set())
      setHospital(null)
      setRouteInfo({ primary: null, alt1: null, alt2: null })
      setScenarioData(data)
      scenarioRef.current = data
      setActiveScenario(data.id || 'CUSTOM')
      setSeverity(data.severity || 3)
    }
    else if (type === 'SET_HOSPITAL') {
      if (scenarioRef.current && scenarioRef.current.id === 'CUSTOM' && data && data.lat) {
        // Trust backend's capability-matched pick for custom incidents.
        setHospital({
          name: data.name, lat: data.lat, lng: data.lng ?? data.lon,
          trauma: !!data.trauma, eta_from_J1: data.eta_from_J1 ?? data.eta,
        })
      } else {
        const origin = incidentOriginFor(scenarioRef.current)
        if (origin) setHospital(pickNearest(origin.lat, origin.lng, true))
        else if (data) setHospital(data)
      }
    }
    else if (type === 'ADD_ALERT') setAlerts(a => [...a, { ...data, timestamp: new Date().toISOString() }])
    else if (type === 'SET_NARRATOR') setNarrator(n => ({ ...n, ...data }))
    else if (type === 'SET_COMPLETION') {
      setBanner(data.text)
      if (data.text) setTimeout(() => setBanner(null), 5000)
    }
    else if (type === 'SET_CUSTOM_BANNER') {
      setCustomBanner(data.text)
    }
    else if (type === 'SET_SEVERITY') {
      const v = parseInt(data.value, 10)
      if (!isNaN(v)) setSeverity(v)
    }
    else if (type === 'SUPERVISOR_PLAN') {
      setSupervisorPlan(data)
    }
    else if (type === 'MEDICAL_ASSESSMENT') {
      setMedicalAssessments(a => [...a, { ...data, timestamp: new Date().toISOString() }])
    }
    else if (type === 'AGENT_STATE') {
      const agentName = (data.agent || '').replace('Agent', '').replace('🌐 ', '').trim()
      if (data.status === 'active' || data.status === 'started') {
        setActiveAgents(prev => { const s = new Set(prev); s.add(agentName); return s })
      } else if (data.status === 'completed') {
        setActiveAgents(prev => { const s = new Set(prev); s.add(agentName); return s })
        setCompletedAgents(prev => { const s = new Set(prev); s.add(agentName); return s })
        setTimeout(() => setActiveAgents(prev => { const s = new Set(prev); s.delete(agentName); return s }), 2500)
      }
    }
  }

  applyEventRef.current = applyEvent

  const runScenario = (scenarioId) => {
    clearTimeouts()
    resetState()
    const sc = SCENARIOS[scenarioId]
    if (!sc) return
    setActiveScenario(scenarioId)
    setScenarioData(sc)
    setSeverity(sc.severity || 3)
    scenarioRef.current = sc
    setRunning(true)
    fetch(`http://localhost:8000/invoke_scenario/${scenarioId}`, { method: 'POST' }).catch(() => {})
    const speed = 3.0
    sc.events.forEach(evt => {
      const delay = (evt.t * 1000) / speed
      const id = setTimeout(() => applyEvent(evt), delay)
      timeoutsRef.current.push(id)
    })
    const totalMs = ((sc.totalDuration + 5) * 1000) / speed
    const doneId = setTimeout(() => setRunning(false), totalMs)
    timeoutsRef.current.push(doneId)
  }

  const triggerCustomIncident = async ({ description, severity, location, image }) => {
    setAnalyzing(true)
    setSeverity(severity)

    // 1) Geocode the location so the map jumps to a real place, not SC01 defaults.
    let geocoded = null
    if (location && location.trim()) {
      try {
        const gr = await fetch('http://localhost:8000/geocode', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: location.trim() }),
        })
        const gj = await gr.json().catch(() => ({}))
        // Backend returns {lat, lng, display} — normalize both shapes.
        const glat = gj && (gj.lat)
        const glng = gj && (gj.lng ?? gj.lon)
        const gname = gj && (gj.display ?? gj.display_name)
        if (gj && !gj.error && glat != null && glng != null) {
          geocoded = { lat: glat, lon: glng, display_name: gname }
        } else {
          console.warn('geocode failed for', location, gj)
        }
      } catch (e) {
        console.warn('geocode error', e)
      }
    }

    if (geocoded) {
      const { lat, lon, display_name } = geocoded
      const customSc = {
        id: 'CUSTOM', code: 'CUSTOM',
        name: display_name || location, label: display_name || location,
        description, severity,
        junctions: [{ id: 'X1', name: location || display_name, lat, lng: lon }],
        mapCenter: [lat, lon], mapZoom: 14, totalDuration: 60, events: [],
      }
      setScenarioData(customSc)
      scenarioRef.current = customSc
      setActiveScenario('CUSTOM')
      // Always pin the incident on the map so the user sees the location fire.
      setEmergency(true)
      // Route + hospital only for higher severity (emergency-level).
      if (severity >= 3) {
        setRouteVisible(true)
        setHospital(pickNearest(lat, lon, severity >= 4))
      }
    } else if (!scenarioRef.current) {
      const sc = SCENARIOS.SC01
      setScenarioData(sc)
      scenarioRef.current = sc
    }

    try {
      if (image) {
        const fd = new FormData()
        fd.append('description', description)
        fd.append('severity', String(severity))
        fd.append('location', location)
        fd.append('image', image)
        const r = await fetch('http://localhost:8000/report', { method: 'POST', body: fd })
        const j = await r.json().catch(() => ({}))
        if (j && j.image_analysis) {
          const ia = j.image_analysis
          const badge = ia.verification_status === 'supported' ? '#10b981'
                      : ia.verification_status === 'needs_verification' ? '#f97316' : '#ef4444'
          addMessage({
            agent: '📷 VisionAgent',
            color: badge,
            text: `MobileViT verification: ${(ia.verification_status || 'unknown').toUpperCase()} (${Math.round((ia.confidence||0)*100)}% confidence)\nObjects: ${(ia.objects_detected || []).slice(0,6).join(', ')}\nVehicles: ${ia.vehicle_count} · Persons detected: ${ia.injury_indicators ? 'yes' : 'no'}\n${ia.note || ''}`,
          })
        }
      } else {
        await fetch('http://localhost:8000/custom-incident', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, severity, location }),
        })
      }
    } catch (e) {
      addMessage({ agent: 'System', color: '#ef4444', text: `Custom incident failed: ${e.message || e}` })
    }
    setAnalyzing(false)
  }

  const setModeApi = (m) => {
    setMode(m)
    fetch(`http://localhost:8000/mode/${m}`, { method: 'POST' }).catch(() => {})
  }

  const scenarioActive = !!activeScenario
  const meta = severityMeta(severity)

  return (
    <div className="app-shell">
      <Header activeScenario={activeScenario} sseConnected={sseConnected} severity={severity} scenarioActive={scenarioActive || !!customBanner} />
      {banner && (
        <div style={{
          background: 'var(--bg-surface)', color: 'var(--status-green)',
          textAlign: 'center', padding: 10, fontWeight: 600, fontSize: 11,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.15em',
          borderBottom: '1px solid var(--status-green)',
        }}>
          {banner}
        </div>
      )}
      {customBanner && (
        <div style={{ background: meta.color, color: '#0a0e14', textAlign: 'center', padding: 10, fontWeight: 600, borderRadius: 8 }}>
          {customBanner}
        </div>
      )}
      <div className="map-row">
        <CockpitSidebar
          activeScenario={activeScenario}
          onRun={runScenario}
          mode={mode}
          onMode={setModeApi}
          running={running}
          alerts={alerts}
        />
        <div className="center-map" style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 501,
            background: 'rgba(10,14,20,0.92)', border: '1px solid var(--border-strong)',
            padding: '6px 10px', borderRadius: 4, fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)',
            letterSpacing: '0.08em', pointerEvents: 'none',
          }}>
            <span style={{ color: sseConnected ? 'var(--status-green)' : 'var(--danger)' }}>●</span>{' '}
            SSE {sseConnected ? 'LIVE' : 'DOWN'} · {sseCounter.total} evts · {sseCounter.addMsg} msg · {sseCounter.addAlert} alert
            {sseCounter.lastAgent && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>last: {sseCounter.lastAgent}</div>}
          </div>
          {scenarioRef.current && scenarioRef.current.id === 'CUSTOM' && (
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              zIndex: 500, background: 'rgba(10,14,20,0.92)', color: '#f9fafb',
              padding: '8px 14px', borderRadius: 6, borderLeft: '3px solid #f59e0b',
              boxShadow: '0 4px 12px rgba(0,0,0,0.35)', fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace", maxWidth: '70%', pointerEvents: 'none',
            }}>
              <div style={{ letterSpacing: '0.15em', fontWeight: 700, color: '#f59e0b' }}>
                🚨 CITIZEN REPORT · {scenarioRef.current.description || scenarioRef.current.label || ''}
              </div>
              <div style={{ marginTop: 3, color: '#94a3b8', fontSize: 10 }}>
                Location: {(scenarioRef.current.junctions && scenarioRef.current.junctions[0] && scenarioRef.current.junctions[0].name) || '—'}
              </div>
            </div>
          )}
          <CityMap scenario={scenarioData} density={density} routeVisible={routeVisible} hospital={hospital} emergency={emergency} allHospitals={hospitalRoster} onRoutesLoaded={setRouteInfo} />
          <RoutePanel routeVisible={routeVisible} hospital={hospital} hospitalName={hospital && hospital.name} primaryRoute={routeInfo && routeInfo.primary} altRoute1={routeInfo && routeInfo.alt1} altRoute2={routeInfo && routeInfo.alt2} />
        </div>
      </div>
      {supervisorPlan && (
        <div className="glass-card">
          <div className="section-title">Supervisor Plan</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{
              padding: '6px 12px', borderRadius: 6, background: 'var(--accent-soft)',
              border: '1px solid var(--accent)', color: 'var(--accent)',
              fontWeight: 600, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase'
            }}>{String(supervisorPlan.sequence_key || '').replace(/_/g, ' ')} Protocol</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Priority: <b style={{ color: 'var(--text)' }}>{supervisorPlan.priority_level || '—'}</b>
            </div>
          </div>
          {supervisorPlan.reasoning && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {supervisorPlan.reasoning}
            </div>
          )}
          {Array.isArray(supervisorPlan.sequence) && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {supervisorPlan.sequence.join(' → ')}
            </div>
          )}
        </div>
      )}
      <div className="agents-row">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AgentWorkflowPanel activeAgents={activeAgents} completedAgents={completedAgents} severity={severity} supervisorPlan={supervisorPlan} />
          <AgentTraceLog messages={displayedMessages} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <NarratorPanel narrator={narrator} />
          <DepartmentAlertFeed alerts={alerts} severityColor={meta.color} />
        </div>
      </div>
      <div className="bottom-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CausalGraphSVG density={density} emergency={emergency} />
          <TemporalMind messages={displayedMessages} density={density} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CounterfactualPanel density={density} />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/citizen" element={<CitizenView />} />
      <Route path="/dept/police" element={<PoliceDashboard />} />
      <Route path="/dept/hospital" element={<HospitalDashboard />} />
      <Route path="/dept/fire" element={<FireDashboard />} />
      <Route path="/dept/public" element={<PublicDashboard />} />
      <Route path="/dept/bbmp" element={<BbmpDashboard />} />
      <Route path="/dept/ambulance" element={<ErrorBoundary><AmbulanceDashboard /></ErrorBoundary>} />
    </Routes>
  )
}
