import React from 'react'
import { SCENARIOS } from '../data/scenarios'
import { severityMeta } from '../data/severity'

const DEPT_PORTALS = [
  { path: '/dept/police', label: 'Traffic Police', match: 'traffic police', icon: '🚔' },
  { path: '/dept/hospital', label: 'Hospital', match: 'hospital', icon: '🏥' },
  { path: '/dept/ambulance', label: '🚑 Ambulance Crew', match: 'ambulance', icon: '🚑' },
  { path: '/dept/fire', label: 'Fire', match: 'fire', icon: '🚒' },
  { path: '/dept/public', label: 'Public', match: 'public', icon: '📱' },
  { path: '/dept/bbmp', label: 'BBMP', match: 'bbmp', icon: '🏛' },
]

const MODES = ['flow', 'emergency', 'protocol']

export default function CockpitSidebar({ activeScenario, onRun, mode, onMode, running, alerts = [] }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)',
      overflowY: 'auto', fontFamily: 'var(--font-mono)',
    }}>
      {/* Scenarios */}
      <div style={{ fontSize: 8, letterSpacing: '0.22em', color: 'var(--text-muted)', padding: '16px 16px 8px', textTransform: 'uppercase' }}>
        SCENARIOS
      </div>
      {Object.values(SCENARIOS).map(s => {
        const active = activeScenario === s.id
        const meta = severityMeta(s.severity || 3)
        const isRunning = active && running
        return (
          <button key={s.id} onClick={() => onRun(s.id)} disabled={running}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', height: 36, padding: '0 12px 0 0',
              background: active ? 'var(--bg-elevated)' : 'transparent',
              border: 'none', borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)', fontFamily: 'inherit',
              cursor: running ? 'progress' : 'pointer', textAlign: 'left',
              position: 'relative',
            }}
            onMouseEnter={e => { if (!running) { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
            onMouseLeave={e => { if (!running) { e.currentTarget.style.background = active ? 'var(--bg-elevated)' : 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
          >
            <span style={{
              width: 4, height: 16, background: meta.color, marginRight: 8,
              animation: isRunning ? 'livePulse 1.2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ flex: 1, fontSize: 11 }}>{s.label}</span>
            <span style={{ color: isRunning ? 'var(--status-green)' : 'var(--text-muted)', fontSize: 11 }}>
              {isRunning ? '■' : '▶'}
            </span>
            {isRunning && (
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, height: 2,
                background: 'var(--accent-cyan)', animation: 'livePulse 1.2s ease-in-out infinite',
              }} />
            )}
          </button>
        )
      })}

      {/* Mode */}
      <div style={{ fontSize: 8, letterSpacing: '0.22em', color: 'var(--text-muted)', padding: '16px 16px 8px', textTransform: 'uppercase' }}>
        ACTIVE MODE
      </div>
      <div style={{ padding: '0 12px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MODES.map(m => (
          <button key={m} onClick={() => onMode(m)} style={{
            padding: '5px 10px', fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.1em',
            background: 'transparent', color: mode === m ? 'var(--accent-cyan)' : 'var(--text-muted)',
            border: `1px solid ${mode === m ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
            borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase',
          }}>{m}</button>
        ))}
      </div>

      {/* System status */}
      <div style={{ fontSize: 8, letterSpacing: '0.22em', color: 'var(--text-muted)', padding: '16px 16px 8px', textTransform: 'uppercase' }}>
        SYSTEM STATUS
      </div>
      <div style={{ padding: '0 16px 12px', display: 'grid', gap: 6, fontSize: 10 }}>
        {[
          { label: 'SSE STREAM', color: 'var(--status-green)', status: 'ONLINE', pulse: true },
          { label: 'AGENT MESH', color: 'var(--status-green)', status: 'ONLINE', pulse: true },
          { label: 'MOBILEVIT', color: 'var(--accent-cyan)', status: 'READY', pulse: false },
          { label: 'CORRIDOR CTRL', color: 'var(--status-amber)', status: 'STANDBY', pulse: false },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={r.pulse ? 'live-dot' : ''} style={{
              width: 6, height: 6, borderRadius: '50%', background: r.color, boxShadow: `0 0 6px ${r.color}`,
            }} />
            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{r.label}</span>
            <span style={{ color: r.color }}>{r.status}</span>
          </div>
        ))}
      </div>

      {/* Portals */}
      <div style={{ fontSize: 8, letterSpacing: '0.22em', color: 'var(--text-muted)', padding: '16px 16px 8px', textTransform: 'uppercase' }}>
        DEPARTMENT PORTALS
      </div>
      <div style={{ padding: '0 12px 16px', display: 'grid', gap: 4 }}>
        {DEPT_PORTALS.map(d => {
          const has = alerts.some(a => (a.department || '').toLowerCase().includes(d.match))
          return (
            <a key={d.path} href={d.path} target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', textDecoration: 'none',
              color: 'var(--text-secondary)', background: 'transparent',
              border: '1px solid var(--border-subtle)', borderRadius: 2,
              fontSize: 11,
            }}>
              <span>{d.label}</span>
              {has && <span className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-red)' }} />}
            </a>
          )
        })}
      </div>
    </div>
  )
}
