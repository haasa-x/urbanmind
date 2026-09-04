import React, { useState } from 'react'
import DeptLayout from './DeptLayout'

const THEME = '#475569'

function AuditEntry({ entry }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ padding: 10, marginBottom: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: `1px solid ${THEME}66` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 12, flex: 1 }}>{open ? entry.text : (entry.text.length > 120 ? entry.text.slice(0, 120) + '…' : entry.text)}</div>
        <button onClick={() => setOpen(o => !o)} style={{
          background: 'transparent', border: `1px solid ${THEME}`, color: '#cbd5e1', padding: '2px 8px',
          borderRadius: 4, fontSize: 10, cursor: 'pointer', letterSpacing: 1, fontFamily: 'inherit', whiteSpace: 'nowrap'
        }}>{open ? 'HIDE' : 'VIEW FULL REPORT'}</button>
      </div>
      {entry.timestamp && <div style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>{new Date(entry.timestamp).toLocaleString()}</div>}
    </div>
  )
}

export default function BbmpDashboard() {
  const [audits, setAudits] = useState([])
  const onEvent = (evt) => {
    if (evt.type === 'SET_NARRATOR' && evt.data && evt.data.audit) {
      setAudits(a => [...a, { text: evt.data.audit, timestamp: new Date().toISOString() }])
    }
  }
  return (
    <DeptLayout theme={THEME} title="BBMP Audit & Compliance" icon="🏛" filterDepartment="BBMP" onEvent={onEvent}>
      {({ narrator }) => {
        const list = audits.length ? audits : (narrator.audit ? [{ text: narrator.audit, timestamp: new Date().toISOString() }] : [])
        return (
          <div style={{ background: 'rgba(71,85,105,0.12)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#cbd5e1', marginBottom: 10 }}>NARRATOR AUDIT TRAIL</div>
            {list.length === 0 && <div style={{ fontSize: 12, color: '#64748b' }}>No audit entries yet.</div>}
            {list.slice().reverse().map((e, i) => <AuditEntry key={i} entry={e} />)}
          </div>
        )
      }}
    </DeptLayout>
  )
}
