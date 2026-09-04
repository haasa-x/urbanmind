import { useEffect, useRef, useState } from 'react'

export function useTypewriter(speed = 6) {
  const [displayedMessages, setDisplayed] = useState([])
  const queueRef = useRef([])
  const typingRef = useRef(false)
  // Monotonic token — bumped by clear() to invalidate any in-flight step()
  // chains from a prior scenario. Without this, a stale step from a
  // pre-cleared message eventually calls processNext() and yanks queued
  // messages while a newer message is mid-typing, causing dropped/garbled
  // trace lines on custom incidents that come in after a scripted run.
  const runRef = useRef(0)

  const processNext = (runId) => {
    if (runId !== runRef.current) return
    if (typingRef.current) return
    const next = queueRef.current.shift()
    if (!next) return
    typingRef.current = true
    const id = next.id ?? Math.random().toString(36).slice(2)
    const text = next.text || ''
    let i = 0
    setDisplayed((prev) => [...prev, { ...next, id, displayed: '', typing: true }])
    const step = () => {
      if (runId !== runRef.current) return
      i += 1
      setDisplayed((prev) =>
        prev.map((m) => (m.id === id ? { ...m, displayed: text.slice(0, i), typing: i < text.length } : m))
      )
      if (i < text.length) {
        setTimeout(step, speed)
      } else {
        typingRef.current = false
        setTimeout(() => processNext(runId), 30)
      }
    }
    step()
  }

  const addMessage = (msg) => {
    queueRef.current.push(msg)
    processNext(runRef.current)
  }

  const clear = () => {
    // Bump the run token so any pending step()/processNext() from the prior
    // scenario short-circuits instead of clobbering typingRef.
    runRef.current += 1
    queueRef.current = []
    typingRef.current = false
    setDisplayed([])
  }

  return { displayedMessages, addMessage, clear }
}
