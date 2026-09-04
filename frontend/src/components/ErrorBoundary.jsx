import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { err: null }
  }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', err, info && info.componentStack)
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0a0f1a', color: '#f9fafb',
          padding: 40, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
        }}>
          <div style={{ color: '#f87171', fontSize: 14, marginBottom: 16, letterSpacing: '0.1em' }}>
            ⚠ COMPONENT ERROR
          </div>
          <div style={{ color: '#94a3b8', marginBottom: 12 }}>
            {String(this.state.err && (this.state.err.message || this.state.err))}
          </div>
          <button
            onClick={() => this.setState({ err: null })}
            style={{
              marginTop: 12, padding: '8px 14px', background: 'var(--accent-primary, #90B4BE)', color: '#0a0e14',
              border: 'none', borderRadius: 4, fontFamily: 'inherit', fontSize: 12,
              cursor: 'pointer', fontWeight: 600,
            }}
          >Retry</button>
          <div style={{ marginTop: 20, color: '#4a5568', fontSize: 10 }}>
            Check the browser console for the full stack trace.
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
