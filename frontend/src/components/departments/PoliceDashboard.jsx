import React from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import DeptLayout from './DeptLayout'
import { SCENARIOS } from '../../data/scenarios'

const THEME = '#1d4ed8'

function extractUnits(msg) {
  const m = /(\d+)\s*units?\s*deployed/i.exec(msg || '')
  return m ? m[1] : null
}

const incidentIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#ff3366;box-shadow:0 0 12px #ff3366;border:2px solid #fff"></div>`,
  className: 'p-incident', iconSize: [20, 20], iconAnchor: [10, 10],
})

export default function PoliceDashboard() {
  const sc = SCENARIOS.SC01
  return (
    <DeptLayout theme={THEME} title="Traffic Police Control Room" icon="🚔" filterDepartment="Traffic Police">
      {({ alerts, emergency, density }) => {
        const latest = alerts[alerts.length - 1]
        const units = latest ? extractUnits(latest.message) : null
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'rgba(29,78,216,0.15)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: '#93c5fd' }}>DEPLOYMENT STATUS</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>{units || '—'} <span style={{ fontSize: 12, letterSpacing: 2 }}>UNITS</span></div>
                <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 4 }}>{emergency ? 'ACTIVE INCIDENT' : 'STANDBY'}</div>
              </div>
              <div style={{ background: 'rgba(29,78,216,0.15)', border: `1px solid ${THEME}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: '#93c5fd', marginBottom: 6 }}>DIVERSION ROUTES</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
                  <li>Inbound via BTM Ring Road</li>
                  <li>ORR service road bypass</li>
                  <li>Hosur Rd → Koramangala loop</li>
                </ul>
              </div>
            </div>
            <div style={{ height: 300, borderRadius: 8, overflow: 'hidden', border: `1px solid ${THEME}` }}>
              <MapContainer center={sc.mapCenter} zoom={sc.mapZoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png" attribution='&copy; Stadia' />
                {sc.junctions.map(j => {
                  const d = density[j.id] ?? 0.4
                  return <CircleMarker key={j.id} center={[j.lat, j.lng]} radius={8 + d*8} pathOptions={{ color: THEME, fillColor: THEME, fillOpacity: 0.4 }}>
                    <Popup><b>{j.name}</b> · {(d*100).toFixed(0)}%</Popup>
                  </CircleMarker>
                })}
                {emergency && <Marker position={[sc.junctions[0].lat, sc.junctions[0].lng]} icon={incidentIcon} />}
              </MapContainer>
            </div>
          </>
        )
      }}
    </DeptLayout>
  )
}
