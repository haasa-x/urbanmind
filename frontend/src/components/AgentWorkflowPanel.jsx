import React, { useState } from 'react'
import { severityMeta } from '../data/severity'

const AGENTS = [
  { id: 'incident', name: 'Incident', full: 'IncidentAgent' },
  { id: 'prediction', name: 'Prediction', full: 'PredictionAgent' },
  { id: 'constraint', name: 'Constraint', full: 'ConstraintAgent' },
  { id: 'emission', name: 'Emission', full: 'EmissionAgent' },
  { id: 'safety', name: 'Safety', full: 'SafetyAgent' },
  { id: 'intervention', name: 'Intervention', full: 'InterventionAgent' },
  { id: 'protocol', name: 'Protocol', full: 'ProtocolDispatchAgent' },
  { id: 'police', name: 'Police', full: 'PoliceAgent' },
  { id: 'ems', name: 'EMS', full: 'EMSAgent' },
  { id: 'hospital', name: 'Hospital', full: 'HospitalRoutingAgent' },
  { id: 'comms', name: 'Comms', full: 'CommsAgent' },
  { id: 'corridor', name: 'Corridor', full: 'EmergencyCorridorAgent' },
]

const PARALLEL = new Set(['police', 'ems', 'hospital'])

function statusFor(a, activeAgents, firing, sequence, completedAgents) {
  const inSequence = sequence ? sequence.has(a.full) : true
  if (sequence && !inSequence) return 'NOT_TRIGGERED'
  if (!firing.has(a.name)) return 'NOT_TRIGGERED'
  const activeNow = activeAgents.has(a.name) || activeAgents.has(a.id)
  if (activeNow) return 'FIRING'
  if (completedAgents && (completedAgents.has(a.name) || completedAgents.has(a.id))) return 'COMPLETE'
  return 'IDLE'
}

function Row({ agent, idx, status, decision, sources, onHover }) {
  const circleBg = status === 'FIRING' ? 'var(--accent-cyan)'
    : status === 'COMPLETE' ? 'var(--status-green)'
    : status === 'IDLE' ? 'var(--bg-elevated)'
    : 'var(--bg-surface)'
  const circleFg = status === 'FIRING' || status === 'COMPLETE' ? '#0a0e14' : 'var(--text-muted)'
  const nameColor = status === 'NOT_TRIGGERED' ? 'var(--text-dim)' : 'var(--text-primary)'
  const tag = status === 'IDLE' ? { c: 'var(--text-muted)', t: 'IDLE' }
    : status === 'FIRING' ? { c: 'var(--accent-cyan)', t: '● FIRING', pulse: true }
    : status === 'COMPLETE' ? { c: 'var(--status-green)', t: 'COMPLETE' }
    : { c: 'var(--text-dim)', t: 'NOT TRIGGERED', italic: true }

  const [hover, setHover] = useState(false)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', height: 48, display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border-subtle)', padding: '0 16px',
        background: hover ? 'var(--bg-elevated)' : 'transparent', transition: 'background .15s',
      }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: circleBg, color: circleFg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        animation: status === 'FIRING' ? 'livePulse 1.2s ease-in-out infinite' : 'none',
      }}>{status === 'COMPLETE' ? '✓' : idx}</div>
      <div style={{ width: 100, fontSize: 13, fontFamily: 'var(--font-sans)', color: nameColor }}>{agent.name}</div>
      <div style={{
        fontSize: 10, fontFamily: 'var(--font-mono)', color: tag.c,
        fontStyle: tag.italic ? 'italic' : 'normal',
        width: 96, letterSpacing: '0.1em',
      }}>
        <span className={tag.pulse ? 'blink' : ''}>{tag.t}</span>
      </div>
      <div style={{
        flex: 1, fontSize: 12, color: 'var(--text-secondary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontFamily: 'var(--font-mono)',
      }}>{decision || '—'}</div>
      <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>›</div>
      {hover && decision && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 40, width: 280, zIndex: 20,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          padding: 10, fontSize: 11, color: 'var(--text-secondary)', borderRadius: 2,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{ marginBottom: 6, color: 'var(--text-primary)' }}>{decision}</div>
          {sources && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sources: {sources}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AgentWorkflowPanel({ activeAgents = new Set(), completedAgents = new Set(), severity = 3, supervisorPlan = null }) {
  const meta = severityMeta(severity)
  const firing = new Set(meta.agents_firing)
  const sequence = supervisorPlan && Array.isArray(supervisorPlan.sequence)
    ? new Set(supervisorPlan.sequence) : null

  const sequential = AGENTS.filter(a => !PARALLEL.has(a.id))
  const parallel = AGENTS.filter(a => PARALLEL.has(a.id))

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.22em', fontWeight: 600 }}>
          AGENT WORKFLOW
        </div>
        <div style={{
          fontSize: 9, letterSpacing: '0.15em', color: meta.color, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
          SEV {severity} · {meta.label}
        </div>
      </div>
      {sequential.map((a, i) => (
        <Row key={a.id} agent={a} idx={i + 1}
          status={statusFor(a, activeAgents, firing, sequence, completedAgents)}
          decision={supervisorPlan && supervisorPlan.reasoning ? '' : ''}
          sources={a.full}
        />
      ))}
      <div style={{
        padding: '10px 16px 4px', fontSize: 8, letterSpacing: '0.22em',
        color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600,
      }}>PARALLEL ACTIVATION</div>
      {parallel.map((a, i) => (
        <Row key={a.id} agent={a} idx={sequential.length + i + 1}
          status={statusFor(a, activeAgents, firing, sequence, completedAgents)}
          decision=""
          sources={a.full}
        />
      ))}
    </div>
  )
}
