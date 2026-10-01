'use client'

import { useEffect, useState, useRef } from 'react'
import { authFetch } from '@/lib/authFetch'
import { useRouter } from 'next/navigation'

export default function RenderDoneToast() {
  const [show, setShow] = useState(false)
  const router = useRouter()
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkOnce = async () => {
      if (localStorage.getItem('reelezy-render-done') === '1') {
        setShow(true)
        return
      }
      const saved = localStorage.getItem('reelezy-render')
      if (!saved) return
      try {
        const { id, ts } = JSON.parse(saved)
        if (Date.now() - ts > 30 * 60 * 1000) { localStorage.removeItem('reelezy-render'); return }
        const res = await authFetch('/api/render-status', { method: 'POST', body: JSON.stringify({ renderId: id }) })
        const data = await res.json()
        if (data.status === 'done') { localStorage.removeItem('reelezy-render'); localStorage.setItem('reelezy-render-done', '1'); setShow(true) }
        else if (data.status === 'failed') { localStorage.removeItem('reelezy-render') }
      } catch {}
    }
    checkOnce()

    const startPolling = () => {
      if (pollingRef.current) clearInterval(pollingRef.current)

      pollingRef.current = setInterval(async () => {
        // Check if there's a render done flag already
        if (localStorage.getItem('reelezy-render-done') === '1') {
          setShow(true)
          if (pollingRef.current) clearInterval(pollingRef.current)
          return
        }

        // Check if there's an in-progress render to poll
        const saved = localStorage.getItem('reelezy-render')
        if (!saved) return

        try {
          const { id, ts } = JSON.parse(saved)
          if (Date.now() - ts > 30 * 60 * 1000) {
            localStorage.removeItem('reelezy-render')
            return
          }

          const res = await authFetch('/api/render-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ renderId: id }),
          })
          const data = await res.json()

          if (data.status === 'done') {
            localStorage.removeItem('reelezy-render')
            localStorage.setItem('reelezy-render-done', '1')
            setShow(true)
            if (pollingRef.current) clearInterval(pollingRef.current)
          } else if (data.status === 'failed') {
            localStorage.removeItem('reelezy-render')
            if (pollingRef.current) clearInterval(pollingRef.current)
          }
        } catch {}
      }, 5000)
    }

    startPolling()
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.removeItem('reelezy-render-done')
  }

  const view = () => {
    dismiss()
    router.push('/dashboard/scheduler')
  }

  if (!show) return null

  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#1a1a1a', border: '1px solid rgba(216,90,48,0.4)', borderRadius: 14, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 320 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 8px #22c55e' }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#F1EFE8', marginBottom: 2 }}>Your video is ready!</p>
        <p style={{ fontSize: 12, color: 'rgba(241,239,232,0.6)' }}>Head to the Scheduler to download and post it.</p>
      </div>
      <button onClick={view} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
        View
      </button>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'rgba(241,239,232,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: 0 }}>×</button>
    </div>
  )
}
