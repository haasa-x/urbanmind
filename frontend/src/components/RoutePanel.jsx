import React from 'react'

function fmt(r) {
  if (!r) return '—'
  const d = r.duration_min != null ? `${r.duration_min.toFixed(1)} min` : '—'
  const km = r.distance_km != null ? `${r.distance_km.toFixed(1)} km` : '—'
  return `${d} · ${km}`
}

export default function RoutePanel({ routeVisible, hospitalName, primaryRoute, altRoute1, altRoute2, hospital }) {
  const name = hospitalName || (hospital && hospital.name)
  return (
    <div className="glass-card">
      <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 1, marginBottom: 8 }}>EMERGENCY ROUTE</div>
      {!routeVisible && <div style={{ fontSize: 11, color: '#64748b' }}>No active corridor.</div>}
      {routeVisible && (
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          {name && <div>Destination: <b style={{ color: '#ec4899' }}>{name}</b></div>}
          <div>
            <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>● Primary corridor</span>{' '}
            {primaryRoute ? fmt(primaryRoute) : 'computing route…'}
          </div>
          <div>
            <span style={{ color: '#64748b' }}>· Alternate 1</span> {fmt(altRoute1)}
            {altRoute1 && altRoute1.delta_min != null && <span style={{ color: '#ef4444' }}> (+{altRoute1.delta_min.toFixed(1)} min)</span>}
          </div>
          <div>
            <span style={{ color: '#475569' }}>· Alternate 2</span> {fmt(altRoute2)}
            {altRoute2 && altRoute2.delta_min != null && <span style={{ color: '#ef4444' }}> (+{altRoute2.delta_min.toFixed(1)} min)</span>}
          </div>
        </div>
      )}
    </div>
  )
}
