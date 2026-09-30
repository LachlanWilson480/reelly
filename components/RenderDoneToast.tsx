'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RenderDoneToast() {
  const [show, setShow] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const check = () => {
      if (localStorage.getItem('reelezy-render-done') === '1') {
        setShow(true)
      }
    }
    check()
    // Poll every 5 seconds in case render completes while on another page
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
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
