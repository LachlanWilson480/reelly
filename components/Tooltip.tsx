'use client'

import { useState, useRef } from 'react'

export default function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    timer.current = setTimeout(() => setVisible(true), 800)
  }

  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    setVisible(false)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <span style={{
          position: 'absolute',
          left: 'calc(100% + 10px)',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'var(--card-bg)',
          color: 'var(--ink)',
          fontSize: 12,
          fontWeight: 600,
          padding: '7px 12px',
          borderRadius: 8,
          whiteSpace: 'nowrap',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          border: '1px solid rgba(128,128,128,0.15)',
          fontFamily: "'Inter', sans-serif",
        }}>
          {text}
        </span>
      )}
    </span>
  )
}
