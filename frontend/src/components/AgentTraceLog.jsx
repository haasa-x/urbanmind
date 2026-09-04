import React, { useEffect, useRef } from 'react'

export default function AgentTraceLog({ messages }) {
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])
  return (
    <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
        fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.22em', fontWeight: 600,
      }}>AGENT TRACE LOG</div>
      <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'var(--font-mono)' }}>
        {messages.length === 0 && (
          <div style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            Awaiting agent events…
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className="slide-in" style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'transparent',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: m.color, opacity: 0.7 }}>{m.agent}</span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour12: false }) : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 2 }}>
              {m.displayed}
              {m.typing && <span className="cursor" style={{ color: m.color }}>▌</span>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
