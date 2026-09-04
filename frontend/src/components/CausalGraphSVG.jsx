import React from 'react'
import { densityColor } from '../utils/densityColor'

const NODES = [
  { id: 'J1', x: 60, y: 100, label: 'Silk Board' },
  { id: 'J2', x: 180, y: 40, label: 'BTM' },
  { id: 'J5', x: 180, y: 160, label: 'Agara' },
  { id: 'J4', x: 300, y: 40, label: 'Koramangala' },
  { id: 'J3', x: 300, y: 160, label: 'Hosur' },
]
const EDGES = [
  { from: 'J1', to: 'J2', w: 7 },
  { from: 'J1', to: 'J5', w: 11 },
  { from: 'J2', to: 'J4', w: 9 },
  { from: 'J5', to: 'J3', w: 6 },
]

export default function CausalGraphSVG({ density = {}, emergency = false }) {
  const nodeById = Object.fromEntries(NODES.map(n => [n.id, n]))
  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
        fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.22em', fontWeight: 600,
      }}>CAUSAL GRAPH — SPILLOVER</div>
      <svg viewBox="0 0 360 200" style={{ width: '100%', height: 200, padding: 8 }}>
        {EDGES.map((e, i) => {
          const a = nodeById[e.from], b = nodeById[e.to]
          const active = emergency && (e.from === 'J1' || e.to === 'J1')
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={active ? 'var(--accent-cyan)' : 'var(--border-strong)'}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={active ? '6 4' : '0'}
                style={active ? { animation: 'dashmove 1.6s linear infinite' } : {}} />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4}
                fill="var(--text-muted)" fontSize="7" textAnchor="middle"
                fontFamily="var(--font-mono)">T+{e.w}m</text>
            </g>
          )
        })}
        {NODES.map(n => {
          const d = density?.[n.id] ?? 0.4
          const fill = densityColor ? densityColor(d) : (d > 0.75 ? '#ef4444' : d > 0.5 ? '#f97316' : d > 0.3 ? '#eab308' : '#10b981')
          return (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={12} fill={fill} fillOpacity="0.6" stroke={fill} strokeWidth="1" />
              <text x={n.x} y={n.y + 3} fill="#0a0e14" fontSize="9" textAnchor="middle" fontWeight="700"
                fontFamily="var(--font-mono)">{n.id}</text>
              <text x={n.x} y={n.y + 26} fill="var(--text-muted)" fontSize="7" textAnchor="middle"
                fontFamily="var(--font-mono)">{n.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
