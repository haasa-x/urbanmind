import React, { useEffect, useRef, useState } from 'react'
import { severityMeta } from '../data/severity'

const METRICS = [
  { key: 'vehicle_minutes_saved', label: 'VEHICLE-MIN SAVED', unit: '', mult: 'vehicle_minutes_multiplier' },
  { key: 'co2_avoided_kg', label: 'CO₂ AVOIDED', unit: 'kg', mult: 'co2_multiplier' },
  { key: 'corridors_cleared', label: 'CORRIDORS CLEARED', unit: '', mult: null },
  { key: 'incidents_prevented', label: 'INCIDENTS PREVENTED', unit: '', mult: null },
]

function MetricItem({ label, value, unit }) {
  const [flash, setFlash] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) {
      setFlash(true)
      const id = setTimeout(() => setFlash(false), 1500)
      prev.current = value
      return () => clearTimeout(id)
    }
  }, [value])
  return (
    <div style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{
        fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.22em',
        textTransform: 'uppercase', fontWeight: 600,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
        <span className={flash ? 'increment-flash' : ''} style={{
          fontSize: 32, fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: 'var(--text-primary)', lineHeight: 1,
        }}>{value.toLocaleString()}</span>
        {unit && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

export default function MetricsStrip({ metrics, severity, scenarioActive }) {
  const meta = severity ? severityMeta(severity) : null
  return (
    <div style={{
      height: 64, background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'stretch',
    }}>
      {METRICS.map((m, i) => {
        const raw = metrics?.[m.key] ?? 0
        const scaled = (scenarioActive && meta && m.mult) ? Math.round(raw * meta[m.mult]) : raw
        return (
          <React.Fragment key={m.key}>
            {i > 0 && <div style={{ width: 1, background: 'var(--border-subtle)' }} />}
            <MetricItem label={m.label} value={scaled} unit={m.unit} />
          </React.Fragment>
        )
      })}
    </div>
  )
}
