import React from 'react'
import DeptLayout from './DeptLayout'

const THEME = '#ea580c'

export default function FireDashboard() {
  return (
    <DeptLayout theme={THEME} title="Fire & Rescue Command" icon="🚒" filterDepartment="Fire">
      {({ alerts }) => {
        if (alerts.length === 0) {
          return (
            <div style={{ background: 'rgba(234,88,12,0.1)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🟢</div>
              <div style={{ fontSize: 20, letterSpacing: 3, fontWeight: 700, color: '#fdba74' }}>STANDBY</div>
              <div style={{ fontSize: 12, color: '#fdba74', marginTop: 4 }}>No active fire or hazmat incidents.</div>
            </div>
          )
        }
        return (
          <div style={{ background: 'rgba(234,88,12,0.15)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#fdba74', marginBottom: 8 }}>ACCESS ROUTES</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
              <li>Primary: Silk Board flyover ramp → incident zone</li>
              <li>Alt 1: BTM ring road (avoids congested cross-traffic)</li>
              <li>Alt 2: Koramangala inner road (narrow, 4-min longer)</li>
            </ul>
            <div style={{ marginTop: 10, fontSize: 11, color: '#fdba74' }}>Latest dispatch: {alerts[alerts.length-1].message}</div>
          </div>
        )
      }}
    </DeptLayout>
  )
}
