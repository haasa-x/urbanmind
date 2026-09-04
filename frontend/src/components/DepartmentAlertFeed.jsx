import React from 'react'

export default function DepartmentAlertFeed({ alerts }) {
  return (
    <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
        fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.22em', fontWeight: 600,
      }}>DEPARTMENT ALERTS</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {alerts.length === 0 && (
          <div style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No dispatches.
          </div>
        )}
        {alerts.map((a, i) => (
          <div key={i} className="slide-in" style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'transparent',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.1em' }}>
                  {a.department}
                </span>
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                {a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour12: false }) : ''}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {a.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
