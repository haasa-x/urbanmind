import React from 'react'

const ROWS = [
  { key: 'operator', label: 'OPERATOR', dot: 'var(--accent-cyan)', color: 'var(--text-primary)' },
  { key: 'public', label: 'PUBLIC', dot: 'var(--status-green)', color: 'var(--status-green)' },
  { key: 'audit', label: 'AUDIT', dot: 'var(--status-amber)', color: 'var(--status-amber)' },
]

export default function NarratorPanel({ narrator }) {
  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
        fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.22em', fontWeight: 600,
      }}>COMMS · MULTI-AUDIENCE BRIEFS</div>
      {ROWS.map(r => {
        const val = narrator && narrator[r.key]
        return (
          <div key={r.key} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.dot }} />
              <span style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--text-muted)', fontWeight: 600 }}>
                {r.label}
              </span>
            </div>
            <div style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: val ? r.color : 'var(--text-dim)',
              opacity: val ? (r.key === 'operator' ? 1 : 0.9) : 1,
              lineHeight: 1.55, fontStyle: val ? 'normal' : 'italic',
            }}>
              {val || 'Awaiting incident…'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
