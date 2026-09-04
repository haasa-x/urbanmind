import React, { useEffect, useState, useRef } from 'react'

export default function DeptLayout({ theme, title, icon, filterDepartment, children, extraState = {}, onEvent }) {
  const [alerts, setAlerts] = useState([])
  const [connected, setConnected] = useState(false)
  const [clock, setClock] = useState(new Date())
  const [narrator, setNarrator] = useState({ operator: '', public: '', audit: '' })
  const [emergency, setEmergency] = useState(false)
  const [hospital, setHospital] = useState(null)
  const [density, setDensity] = useState({})
  const [messages, setMessages] = useState([])
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let es
    try {
      es = new EventSource('http://localhost:8000/stream')
      es.onopen = () => setConnected(true)
      es.onerror = () => setConnected(false)
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data)
          if (!evt || !evt.type) return
          if (evt.type === 'SNAPSHOT') {
            const s = evt.data || {}
            if (Array.isArray(s.department_alerts)) {
              const match = s.department_alerts.filter(a => (a.department || '').toLowerCase().includes(filterDepartment.toLowerCase()))
              setAlerts(match)
            }
            if (s.narrator_outputs) setNarrator(s.narrator_outputs)
            if (typeof s.emergency_active === 'boolean') setEmergency(s.emergency_active)
            if (s.selected_hospital) setHospital(s.selected_hospital)
            if (s.density) setDensity(s.density)
          } else if (evt.type === 'ADD_ALERT') {
            const dept = (evt.data.department || '').toLowerCase()
            if (dept.includes(filterDepartment.toLowerCase())) {
              setAlerts(a => [...a, { ...evt.data, timestamp: new Date().toISOString() }])
            }
          } else if (evt.type === 'SET_NARRATOR') {
            setNarrator(n => ({ ...n, ...evt.data }))
          } else if (evt.type === 'SET_EMERGENCY') {
            setEmergency(!!evt.data.value)
          } else if (evt.type === 'SET_HOSPITAL') {
            setHospital(evt.data)
          } else if (evt.type === 'SET_DENSITY') {
            setDensity(d => ({ ...d, ...evt.data }))
          } else if (evt.type === 'ADD_MESSAGE') {
            setMessages(m => [...m.slice(-50), { ...evt.data, timestamp: new Date().toISOString() }])
          }
          onEventRef.current && onEventRef.current(evt)
        } catch {}
      }
    } catch {}
    return () => es && es.close()
  }, [filterDepartment])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e14', color: '#e2e8f0', fontFamily: 'inherit' }}>
      <div style={{ padding: '14px 24px', background: theme, display: 'flex', alignItems: 'center', gap: 12, borderBottom: `2px solid ${theme}` }}>
        <div style={{ fontSize: 28 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>{title}</div>
          <div style={{ fontSize: 10, letterSpacing: 3, opacity: 0.8 }}>URBANMIND ALERT SYSTEM</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, letterSpacing: 2 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: connected ? '#10b981' : '#ef4444', boxShadow: connected ? '0 0 10px #10b981' : 'none', animation: connected ? 'pulse-ring 1.5s ease-out infinite' : 'none' }} />
          {connected ? 'CONNECTED' : 'OFFLINE'}
        </div>
        <div style={{ fontSize: 12, fontFamily: 'monospace', opacity: 0.9 }}>{clock.toLocaleTimeString()}</div>
      </div>
      <div style={{ padding: 20, display: 'grid', gap: 16 }}>
        {typeof children === 'function' ? children({ alerts, narrator, emergency, hospital, density, messages, theme }) : children}
        <div style={{ borderTop: `1px solid ${theme}66`, paddingTop: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: theme, marginBottom: 8 }}>▸ LIVE ALERT FEED · {filterDepartment.toUpperCase()}</div>
          {alerts.length === 0 && <div style={{ fontSize: 12, color: '#64748b' }}>No active alerts for this department.</div>}
          {alerts.slice().reverse().map((a, i) => (
            <div key={i} className="slide-in" style={{
              display: 'flex', gap: 10, padding: '8px 10px', marginBottom: 6, borderRadius: 6,
              background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${theme}`
            }}>
              <div style={{ fontSize: 20 }}>{a.icon}</div>
              <div>
                <div style={{ fontSize: 10, color: theme, letterSpacing: 1, fontWeight: 700 }}>{a.department}</div>
                <div style={{ fontSize: 12 }}>{a.message}</div>
                {a.timestamp && <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{new Date(a.timestamp).toLocaleTimeString()}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
