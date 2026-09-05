import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useNavigate } from 'react-router-dom'
import { SCENARIOS } from '../data/scenarios'
import { densityColor } from '../utils/densityColor'
import { severityMeta } from '../data/severity'

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions && positions.length > 1) {
      try { map.fitBounds(positions, { padding: [40, 40] }) } catch {}
    }
  }, [positions])
  return null
}

const pinIcon = (color) => L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #0a0e14"></div>`,
  className: 'route-pin', iconSize: [14, 14], iconAnchor: [7, 7],
})

const incidentIcon = () => L.divIcon({
  html: `<div class="incident-marker">!</div>`,
  className: 'route-pin', iconSize: [36, 36], iconAnchor: [18, 18],
})

async function geocode(q) {
  const r = await fetch('http://localhost:8000/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  if (!r.ok) throw new Error('geocode failed')
  const j = await r.json()
  if (j.error) return { error: j.error }
  if (!j.lat || !j.lng) return null
  return { lat: j.lat, lng: j.lng, display: j.display }
}

async function fetchOSRM(a, b) {
  const r = await fetch('http://localhost:8000/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin_lat: a.lat, origin_lon: a.lng,
      dest_lat: b.lat, dest_lon: b.lng,
      alternatives: true,
    }),
  })
  if (!r.ok) throw new Error('route failed')
  const j = await r.json()
  const rt = j.primary
  if (!rt) return null
  return {
    positions: rt.geometry || [],
    duration_min: rt.duration_min ?? rt.eta_minutes ?? 0,
    distance_km: rt.distance_km ?? 0,
  }
}

export default function CitizenView() {
  const navigate = useNavigate()
  const [state, setState] = useState({ density: {}, narrator_outputs: {}, department_alerts: [] })

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [result, setResult] = useState(null)

  // Incident report form state
  const [desc, setDesc] = useState('')
  const [sev, setSev] = useState(3)
  const [loc, setLoc] = useState('')
  const [coords, setCoords] = useState(null)
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [reportedIncident, setReportedIncident] = useState(null)
  const [makeWay, setMakeWay] = useState(null)

  useEffect(() => {
    let es
    try {
      es = new EventSource('http://localhost:8000/stream')
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data)
          if (evt.type === 'SNAPSHOT') setState(s => ({ ...s, ...evt.data }))
          if (evt.type === 'SET_DENSITY') setState(s => ({ ...s, density: { ...s.density, ...evt.data } }))
          if (evt.type === 'SET_NARRATOR') setState(s => ({ ...s, narrator_outputs: { ...s.narrator_outputs, ...evt.data } }))
          if (evt.type === 'ADD_ALERT') setState(s => ({ ...s, department_alerts: [...(s.department_alerts || []), { ...evt.data, timestamp: new Date().toISOString() }] }))
          if (evt.type === 'CITIZEN_MAKE_WAY') {
            setMakeWay({ ...evt.data, shownAt: Date.now() })
          }
        } catch {}
      }
    } catch {}
    return () => es && es.close()
  }, [])

  // Auto-dismiss the make-way banner 20s after it appears.
  useEffect(() => {
    if (!makeWay) return
    const id = setTimeout(() => setMakeWay(null), 20000)
    return () => clearTimeout(id)
  }, [makeWay && makeWay.shownAt])

  const submitRoute = async (e) => {
    e && e.preventDefault && e.preventDefault()
    if (!from.trim() || !to.trim()) return
    setErr(null); setResult(null); setLoading(true)
    try {
      const a = await geocode(from.trim())
      const b = await geocode(to.trim())
      if (!a || a.error || !b || b.error) {
        setErr((a && a.error) || (b && b.error) || 'Location not found — try being more specific.')
        setLoading(false); return
      }
      const route = await fetchOSRM(a, b)
      if (!route) { setErr('Route not available.'); setLoading(false); return }
      setResult({ fromCoord: a, toCoord: b, route })
    } catch (ex) {
      setErr('Error contacting geocoder/router: ' + (ex.message || ex))
    } finally { setLoading(false) }
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) { setToast('Geolocation not supported'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })
        setLoc(`current location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`)
      },
      (err) => setToast('Location denied: ' + err.message),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const pickImage = (e) => {
    const f = e.target.files && e.target.files[0]
    if (!f) { setImage(null); setPreview(null); return }
    setImage(f)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(f)
  }
  const clearImage = () => { setImage(null); setPreview(null) }

  const submitReport = async () => {
    if (!desc.trim() || submitting) return
    setSubmitting(true); setToast(null)
    try {
      let pinCoord = coords
      if (!pinCoord && loc.trim()) {
        try {
          const g = await geocode(loc.trim())
          if (g && !g.error && g.lat != null) pinCoord = { lat: g.lat, lng: g.lng }
        } catch {}
      }
      if (image) {
        const fd = new FormData()
        fd.append('description', desc.trim())
        fd.append('severity', String(sev))
        fd.append('location', loc.trim())
        fd.append('image', image)
        await fetch('http://localhost:8000/report', { method: 'POST', body: fd })
      } else {
        await fetch('http://localhost:8000/custom-incident', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: desc.trim(), severity: sev, location: loc.trim() }),
        })
      }
      if (pinCoord) {
        setReportedIncident({ ...pinCoord, severity: sev, label: desc.trim().slice(0, 60) })
        if (!result && from.trim()) {
          try {
            const orig = await geocode(from.trim())
            if (orig && !orig.error) {
              const route = await fetchOSRM(orig, pinCoord)
              if (route) setResult({ fromCoord: orig, toCoord: pinCoord, route })
            }
          } catch {}
        }
      }
      setToast('Report submitted ✓')
      setDesc(''); setImage(null); setPreview(null); setCoords(null)
      setTimeout(() => setToast(null), 3500)
    } catch (ex) {
      setToast('Submit failed: ' + (ex.message || ex))
    } finally {
      setSubmitting(false)
    }
  }

  const sc = SCENARIOS.SC01
  const publicAlerts = (state.department_alerts || []).filter(a => a.department === 'Public')
  const congested = Object.values(state.density || {}).some(v => v > 0.7)
  const delayMin = result && result.route && congested ? Math.round(result.route.duration_min * 0.2) : 0
  const mapCenter = reportedIncident
    ? [reportedIncident.lat, reportedIncident.lng]
    : (result ? [(result.fromCoord.lat + result.toCoord.lat) / 2, (result.fromCoord.lng + result.toCoord.lng) / 2] : sc.mapCenter)
  const incidentSevMeta = reportedIncident ? severityMeta(reportedIncident.severity) : null

  return (
    <div style={{ padding: 20, color: 'var(--text)', minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16, position: 'relative' }}>
      {makeWay && (
        <div
          onClick={() => setMakeWay(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 5000,
            padding: '14px 24px',
            background: 'rgba(239,68,68,0.15)',
            borderLeft: '4px solid #ef4444',
            borderBottom: '1px solid rgba(239,68,68,0.6)',
            color: '#fff', cursor: 'pointer',
            animation: 'slideDown 0.35s ease-out',
            boxShadow: '0 6px 20px rgba(239,68,68,0.25)',
          }}
        >
          <style>{`@keyframes slideDown { from { transform: translateY(-100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.08em', color: '#fecaca' }}>
            🚨 AMBULANCE APPROACHING — PLEASE MAKE WAY
          </div>
          <div style={{ fontSize: 13, marginTop: 4, color: '#fff' }}>{makeWay.message}</div>
          <div style={{ fontSize: 11, marginTop: 4, color: '#fecaca', opacity: 0.9 }}>
            Destination: <b>{makeWay.hospital}</b>
            {makeWay.eta_min ? <> · ETA <b>{makeWay.eta_min} min</b></> : null}
            <span style={{ float: 'right', opacity: 0.7 }}>tap to dismiss</span>
          </div>
        </div>
      )}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', minHeight: '80vh' }}>
        <MapContainer center={mapCenter} zoom={sc.mapZoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png" attribution='&copy; Stadia Maps &copy; OpenMapTiles &copy; OSM' maxZoom={20} />
          {sc.junctions.map(j => {
            const d = state.density[j.id] ?? 0.4
            const c = densityColor(d)
            return <CircleMarker key={j.id} center={[j.lat, j.lng]} radius={8 + d * 10} pathOptions={{ color: c, fillColor: c, fillOpacity: 0.5 }} />
          })}
          {result && result.route && (
            <>
              <Polyline positions={result.route.positions} pathOptions={{ color: '#38bdf8', weight: 14, opacity: 0.15 }} />
              <Polyline positions={result.route.positions} pathOptions={{ color: '#38bdf8', weight: 6, opacity: 1, className: 'animate-dash' }} />
              <Marker position={[result.fromCoord.lat, result.fromCoord.lng]} icon={pinIcon('#10b981')} />
              <Marker position={[result.toCoord.lat, result.toCoord.lng]} icon={pinIcon('#38bdf8')} />
              <FitBounds positions={result.route.positions} />
            </>
          )}
          {reportedIncident && (
            <Marker position={[reportedIncident.lat, reportedIncident.lng]} icon={incidentIcon()} />
          )}
        </MapContainer>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)', borderRadius: 8,
            color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12,
            cursor: 'pointer', letterSpacing: '0.05em',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>◈</span> Open Operator Dashboard
          </span>
          <span style={{ color: 'var(--accent-cyan)', fontSize: 14 }}>→</span>
        </button>

        <div className="glass-card">
          <div className="section-title" style={{ color: 'var(--danger)' }}>Report an Incident</div>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={3}
            placeholder="Describe what you saw (e.g. 'Bike accident, one person injured, blocking left lane')..."
            className="input-field"
            style={{ resize: 'vertical', marginBottom: 10 }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Severity</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[1,2,3,4,5].map(n => {
              const m = severityMeta(n)
              const selected = sev === n
              return (
                <button key={n} onClick={() => setSev(n)} title={m.label}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 6,
                    border: `1px solid ${selected ? m.color : 'var(--border)'}`,
                    background: selected ? `${m.color}22` : 'var(--surface-elev)',
                    color: selected ? m.color : 'var(--text)', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 700
                  }}>{n}</button>
              )
            })}
          </div>
          <input
            value={loc}
            onChange={e => { setLoc(e.target.value); setCoords(null) }}
            placeholder="Location (e.g. Silk Board, Hebbal)"
            className="input-field"
            style={{ marginBottom: 6 }}
          />
          <button type="button" onClick={useMyLocation} style={{
            background: 'transparent', border: 'none', color: 'var(--accent)',
            fontSize: 12, cursor: 'pointer', padding: '2px 0', marginBottom: 10, textAlign: 'left'
          }}>
            Use my current location
          </button>

          <label style={{
            display: 'block', border: '1px dashed var(--border-strong)', borderRadius: 6,
            padding: preview ? 6 : 14, marginBottom: 12, cursor: 'pointer',
            background: 'var(--surface-elev)', color: 'var(--text-secondary)',
            fontSize: 12, textAlign: 'center'
          }}>
            {preview ? (
              <div style={{ position: 'relative' }}>
                <img src={preview} alt="incident" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                <button type="button" onClick={(e) => { e.preventDefault(); clearImage() }} style={{
                  position: 'absolute', top: 6, right: 6, background: 'rgba(239,68,68,0.9)',
                  color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px',
                  fontSize: 11, cursor: 'pointer'
                }}>Remove</button>
                <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 6 }}>
                  Image attached · MobileViT will verify
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>Attach a photo (optional)</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Adds MobileViT visual verification</div>
              </>
            )}
            <input type="file" accept="image/*" onChange={pickImage} style={{ display: 'none' }} />
          </label>

          <button
            onClick={submitReport}
            disabled={submitting || !desc.trim()}
            className="btn-primary"
            style={{ width: '100%', padding: '12px 0', fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
          {toast && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6,
              background: 'var(--surface-elev)', border: '1px solid var(--border-strong)',
              color: 'var(--success)', fontSize: 12 }}>{toast}</div>
          )}
          {reportedIncident && incidentSevMeta && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
              Reported at <b style={{ color: incidentSevMeta.color }}>SEV {reportedIncident.severity} · {incidentSevMeta.label}</b> — pinned on map.
            </div>
          )}
        </div>

        <div className="glass-card">
          <div className="section-title">Citizen Advisory</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>{state.narrator_outputs?.public || 'All routes normal. Have a safe commute.'}</div>
        </div>

        <div className="glass-card">
          <div className="section-title">Route Planner</div>
          <form onSubmit={submitRoute} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={from} onChange={e => setFrom(e.target.value)} placeholder="From (e.g. Koramangala, Bangalore)" className="input-field" />
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="To (e.g. Whitefield, Bangalore)" className="input-field" />
            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '10px 0' }}>
              {loading ? 'Routing…' : 'Get Route'}
            </button>
          </form>
          {err && <div style={{ marginTop: 10, color: 'var(--danger)', fontSize: 12 }}>{err}</div>}
          {result && (
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              <div>Route: <b style={{ color: 'var(--text)' }}>{from}</b> → <b style={{ color: 'var(--text)' }}>{to}</b></div>
              <div>Distance: <b style={{ color: 'var(--text)' }}>{result.route.distance_km.toFixed(2)} km</b></div>
              <div>ETA: <b style={{ color: 'var(--text)' }}>{result.route.duration_min.toFixed(1)} min</b></div>
              <div>UrbanMind delay factor: <b style={{ color: delayMin > 0 ? 'var(--danger)' : 'var(--success)' }}>+{delayMin} min</b></div>
            </div>
          )}
        </div>

        <div className="glass-card">
          <div className="section-title">Public Updates</div>
          {publicAlerts.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No active advisories.</div>}
          {publicAlerts.map((a, i) => (
            <div key={i} style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
              {a.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
