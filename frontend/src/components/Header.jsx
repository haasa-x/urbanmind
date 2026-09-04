import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { severityMeta } from '../data/severity'

const MODES = ['flow', 'safety', 'green', 'event']

export default function Header({ activeScenario, sseConnected, severity, scenarioActive, mode = 'flow', onMode }) {
  const [clock, setClock] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const meta = severity ? severityMeta(severity) : null

  const dateStr = clock.toLocaleDateString([], { month: 'short', day: '2-digit' }).toUpperCase()
  const timeStr = clock.toLocaleTimeString([], { hour12: false })

  return (
    <header style={{
      height: 56, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
      padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: 'var(--font-mono)',
    }}>
      {/* LEFT */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--text-primary)' }}>
          URBANMIND<span style={{ color: 'var(--accent-primary)', marginLeft: 6, fontSize: 16 }}>2.0</span>
        </div>
        <div style={{ width: 1, height: 16, background: 'var(--border-default)' }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          Autonomous Traffic Intelligence
        </div>
      </div>

      {/* CENTER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className={sseConnected ? 'live-dot' : ''} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: sseConnected ? 'var(--status-green)' : 'var(--status-red)',
        }} />
        <span style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--status-green)' }}>
          {sseConnected ? 'SYSTEM ACTIVE' : 'OFFLINE'}
        </span>
        <div style={{ width: 1, height: 16, background: 'var(--border-default)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          {dateStr} · {timeStr}
        </span>
        {scenarioActive && meta && (
          <>
            <div style={{ width: 1, height: 16, background: 'var(--border-default)' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
              <span style={{ color: meta.color, fontSize: 10, letterSpacing: '0.15em', fontWeight: 700 }}>
                SEV {severity} · {meta.label}
              </span>
            </span>
          </>
        )}
      </div>

      {/* RIGHT: mode buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {MODES.map((m, i) => (
          <React.Fragment key={m}>
            {i > 0 && <div style={{ width: 1, height: 12, background: 'var(--border-subtle)' }} />}
            <button
              onClick={() => onMode && onMode(m)}
              style={{
                background: 'transparent', border: 'none', padding: '10px 14px',
                fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer',
                color: mode === m ? 'var(--accent-cyan)' : 'var(--text-muted)',
                borderBottom: mode === m ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                textTransform: 'uppercase',
              }}>{m}</button>
          </React.Fragment>
        ))}
        <div style={{ width: 12 }} />
        <Link to="/citizen" style={{
          textDecoration: 'none', color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.15em',
          padding: '4px 10px', border: '1px solid var(--border-subtle)', borderRadius: 2,
        }}>CITIZEN</Link>
      </div>
    </header>
  )
}
