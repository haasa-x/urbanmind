import React from 'react'
import { densityColor } from '../utils/densityColor'

const HORIZONS = [
  { key: 'T+05', delta: 0.05, opacity: 1 },
  { key: 'T+15', delta: 0.15, opacity: 1 },
  { key: 'T+30', delta: 0.22, opacity: 0.6 },
]

export default function TemporalMind({ density = {} }) {
  const base = Object.values(density).length
    ? Object.values(density).reduce((a, b) => a + b, 0) / Object.values(density).length
    : 0.4

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
        fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.22em', fontWeight: 600,
      }}>TEMPORAL MIND — FORECAST</div>
      <div style={{ padding: '12px 16px' }}>
        {HORIZONS.map((h, i) => {
          const pred = Math.min(1, base + h.delta)
          const color = densityColor(pred)
          return (
            <div key={h.key} style={{
              padding: '10px 0', borderBottom: i < HORIZONS.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              opacity: h.opacity,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, fontSize: 10, color: 'var(--text-muted)',
                  letterSpacing: '0.15em', fontFamily: 'var(--font-mono)',
                }}>{h.key}</div>
                <div style={{
                  flex: 1, height: 6, background: 'var(--bg-overlay)', borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${Math.round(pred * 100)}%`, background: color,
                    transition: 'width .35s ease',
                  }} />
                </div>
                <div style={{
                  width: 40, textAlign: 'right', fontSize: 10, color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}>{Math.round(pred * 100)}%</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
