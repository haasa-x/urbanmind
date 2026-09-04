import React from 'react'
import DeptLayout from './DeptLayout'
import { SCENARIOS } from '../../data/scenarios'
import { densityColor } from '../../utils/densityColor'

const THEME = '#16a34a'

export default function PublicDashboard() {
  const sc = SCENARIOS.SC01
  return (
    <DeptLayout theme={THEME} title="Public Advisory Kiosk" icon="📱" filterDepartment="Public">
      {({ narrator, density, alerts }) => {
        return (
          <>
            <div style={{ background: 'rgba(22,163,74,0.12)', border: `2px solid ${THEME}`, borderRadius: 10, padding: 32 }}>
              <div style={{ fontSize: 12, letterSpacing: 4, color: '#86efac', marginBottom: 12 }}>▶ NOW SHOWING</div>
              <div style={{ fontSize: 28, lineHeight: 1.4, fontWeight: 600 }}>
                {narrator.public || 'All routes normal. Have a safe commute.'}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 16, border: `1px solid ${THEME}44` }}>
              <div style={{ fontSize: 12, letterSpacing: 2, color: '#86efac', marginBottom: 10 }}>JUNCTION STATUS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sc.junctions.map(j => {
                  const d = density[j.id] ?? 0.4
                  const c = densityColor(d)
                  return (
                    <div key={j.id} style={{
                      padding: '8px 14px', borderRadius: 20, background: `${c}22`, border: `1px solid ${c}`,
                      fontSize: 14, fontWeight: 700, color: c
                    }}>{j.name} · {(d*100).toFixed(0)}%</div>
                  )
                })}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 16, border: `1px solid ${THEME}44` }}>
              <div style={{ fontSize: 12, letterSpacing: 2, color: '#86efac', marginBottom: 10 }}>RECOMMENDED ALTERNATE ROUTES</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 16, lineHeight: 1.7 }}>
                <li>ORR service road (adds ~5 min)</li>
                <li>BTM Layout ring bypass</li>
                <li>Namma Metro Green Line (fastest during peak)</li>
              </ul>
            </div>
          </>
        )
      }}
    </DeptLayout>
  )
}
