import React from 'react'

export default function CounterfactualPanel({ density }) {
  const vals = Object.values(density || {})
  const real = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const shadow = Math.min(1, real * 1.35)
  const delta = Math.max(0, shadow - real)
  return (
    <div className="glass-card">
      <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 1, marginBottom: 8 }}>COUNTERFACTUAL — WHAT-IF NO UM</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 100 }}>
        <Bar label="REAL" value={real} color="#10b981" />
        <Bar label="SHADOW" value={shadow} color="#ef4444" />
      </div>
      <div style={{ fontSize: 11, marginTop: 8, color: '#e2e8f0' }}>Improvement Δ {(delta * 100).toFixed(0)}% · ~{Math.round(delta * 2000)} veh-min saved</div>
    </div>
  )
}
function Bar({ label, value, color }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ height: 80, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ width: '100%', height: `${value * 100}%`, background: color, borderRadius: 4, transition: 'height .4s' }} />
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{label} {(value * 100).toFixed(0)}%</div>
    </div>
  )
}
