import React, { useEffect, useState } from 'react'
import DeptLayout from './DeptLayout'
import { SCENARIOS, nearestHospital } from '../../data/scenarios'

const THEME = '#dc2626'

function extractSeverity(msg) {
  const m = /\[(MINOR|LOW|MODERATE|HIGH|CRITICAL)\]/.exec(msg || '')
  return m ? m[1] : '—'
}
function extractIncidentType(msg) {
  const m = /:\s*([a-z ]+?)(?:\s+sev|\.|,)/i.exec(msg || '')
  return m ? m[1].trim() : 'trauma'
}
function extractEta(msg) {
  const m = /ETA\s+(\d+)\s*min/i.exec(msg || '')
  return m ? m[1] : '—'
}

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function CapabilityCell({ ok }) {
  return (
    <td style={{ textAlign: 'center', color: ok ? '#10b981' : '#475569', fontWeight: 700 }}>
      {ok ? '✓' : '✗'}
    </td>
  )
}

function HospitalRoster({ hospitals, selected }) {
  if (!hospitals || !hospitals.length) return null
  return (
    <div style={{ background: 'rgba(220,38,38,0.08)', border: `1px solid ${THEME}55`, borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: '#fca5a5', marginBottom: 8 }}>
        HOSPITAL NETWORK · CAPABILITY MATRIX
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#e2e8f0' }}>
          <thead>
            <tr style={{ color: '#fca5a5', textAlign: 'left' }}>
              <th style={{ padding: '4px 6px' }}>Name</th>
              <th style={{ padding: '4px 6px', textAlign: 'center' }}>Trauma</th>
              <th style={{ padding: '4px 6px', textAlign: 'center' }}>Cardiac</th>
              <th style={{ padding: '4px 6px', textAlign: 'center' }}>ICU</th>
              <th style={{ padding: '4px 6px', textAlign: 'center' }}>Burn</th>
              <th style={{ padding: '4px 6px', textAlign: 'center' }}>ER</th>
            </tr>
          </thead>
          <tbody>
            {hospitals.map((h) => {
              const isSel = selected && selected.name === h.name
              return (
                <tr key={h.name} style={{
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  borderLeft: isSel ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  background: isSel ? 'rgba(144,180,190,0.10)' : 'transparent',
                }}>
                  <td style={{ padding: '4px 6px' }}>{h.name}</td>
                  <CapabilityCell ok={!!h.trauma} />
                  <CapabilityCell ok={!!h.cardiac} />
                  <CapabilityCell ok={!!h.icu} />
                  <CapabilityCell ok={!!h.burn_unit} />
                  <CapabilityCell ok={!!h.emergency} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function HospitalDashboard() {
  const sc = SCENARIOS.SC01
  const [assessments, setAssessments] = useState([])
  const [roster, setRoster] = useState([])
  useEffect(() => {
    fetch('http://localhost:8000/hospitals')
      .then(r => r.json())
      .then(d => Array.isArray(d) && setRoster(d))
      .catch(() => setRoster([]))
  }, [])
  const onEvent = (evt) => {
    if (evt && evt.type === 'MEDICAL_ASSESSMENT') {
      setAssessments(a => [...a, { ...evt.data, timestamp: new Date().toISOString() }])
    } else if (evt && evt.type === 'SNAPSHOT') {
      const arr = (evt.data && evt.data.medical_assessments) || []
      if (arr.length) setAssessments(arr)
    }
  }
  return (
    <DeptLayout theme={THEME} title="Hospital Emergency Coordination" icon="🏥" filterDepartment="Hospital" onEvent={onEvent}>
      {({ alerts, emergency, hospital }) => {
        const bayAlert = emergency || assessments.length > 0
        const latest = alerts[alerts.length - 1]
        const eta = latest ? extractEta(latest.message) : '—'
        const type = latest ? extractIncidentType(latest.message) : 'trauma'
        const sev = latest ? extractSeverity(latest.message) : '—'
        const hosp = hospital || nearestHospital(sc.junctions[0].lat, sc.junctions[0].lng, true)
        const origin = sc.junctions[0]
        const distKm = haversineKm(
          { lat: origin.lat, lng: origin.lng },
          { lat: hosp.lat, lng: hosp.lng },
        )
        const routeEta = eta !== '—' ? eta : (hosp.eta_from_J1 || Math.max(3, Math.round(distKm * 1.6)))
        return (
          <>
            <HospitalRoster hospitals={roster} selected={hospital} />
            {bayAlert && (
              <div style={{
                background: THEME, color: 'white', textAlign: 'center', padding: 12, fontSize: 18,
                fontWeight: 700, letterSpacing: 3, borderRadius: 6, animation: 'pulse-ring 1.5s infinite'
              }}>
                🚨 PREPARE EMERGENCY BAY — INCOMING PATIENT
              </div>
            )}
            <div style={{ background: 'rgba(220,38,38,0.12)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#fca5a5', marginBottom: 6 }}>INCOMING PATIENT</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                <div><div style={{ fontSize: 10, color: '#fca5a5' }}>ETA</div><div style={{ fontSize: 22, fontWeight: 700 }}>{eta} min</div></div>
                <div><div style={{ fontSize: 10, color: '#fca5a5' }}>INJURY TYPE</div><div style={{ fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>{type}</div></div>
                <div><div style={{ fontSize: 10, color: '#fca5a5' }}>SEVERITY</div><div style={{ fontSize: 16, fontWeight: 700 }}>{sev}</div></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#e2e8f0' }}>Destination: <b>{hosp.name}</b></div>
            </div>

            {/* Ambulance route summary (no map) */}
            <div style={{
              border: `1px solid ${THEME}55`, borderRadius: 6, padding: 14,
              background: 'rgba(220,38,38,0.05)',
            }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#fca5a5', fontWeight: 700, marginBottom: 10 }}>
                AMBULANCE ROUTE SUMMARY
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', rowGap: 8, columnGap: 12, fontSize: 12, color: '#e2e8f0' }}>
                <div><span style={{ color: '#94a3b8' }}>Origin:</span> <b>{origin.name || 'Incident location'}</b></div>
                <div><span style={{ color: '#94a3b8' }}>Destination:</span> <b>{hosp.name}</b></div>
                <div><span style={{ color: '#94a3b8' }}>Distance:</span> <b>{distKm.toFixed(1)} km</b></div>
                <div><span style={{ color: '#94a3b8' }}>ETA:</span> <b>{routeEta} min</b></div>
              </div>
            </div>

            {/* Field assessment status card (read-only) */}
            <div style={{
              border: `1px solid ${THEME}44`, borderRadius: 4, padding: 12, background: 'rgba(220,38,38,0.05)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: '#fca5a5', fontWeight: 700 }}>
                  FIELD ASSESSMENT
                </div>
                <div style={{
                  fontSize: 9, letterSpacing: 2, fontWeight: 700,
                  color: assessments.length > 0 ? '#10b981' : '#64748b',
                }}>
                  STATUS: {assessments.length > 0 ? 'SUBMITTED' : 'PENDING'}
                </div>
              </div>
              {assessments.length > 0 ? (
                <>
                  {assessments.slice().reverse().slice(0, 3).map((a, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#e2e8f0', marginBottom: 6, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingTop: i > 0 ? 6 : 0 }}>
                      {a.summary && (
                        <div style={{ display: 'grid', gap: 3 }}>
                          <div><span style={{ color: '#94a3b8' }}>Condition:</span> {a.summary.condition_summary}</div>
                          <div><span style={{ color: '#94a3b8' }}>Consciousness:</span> {a.summary.consciousness_level}</div>
                          <div><span style={{ color: '#94a3b8' }}>Injury:</span> {a.summary.injury_summary}</div>
                          <div><span style={{ color: '#94a3b8' }}>Prepare:</span> {a.summary.recommended_preparations}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                  Awaiting field assessment from ambulance crew…
                </div>
              )}
              <a href="/dept/ambulance" target="_blank" rel="noreferrer" style={{
                display: 'inline-block', marginTop: 10, fontSize: 10, color: 'var(--accent-primary)',
                letterSpacing: 1, textDecoration: 'none',
              }}>▸ View full assessment at /dept/ambulance</a>
            </div>
          </>
        )
      }}
    </DeptLayout>
  )
}
