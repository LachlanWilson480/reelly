'use client'

import { useEffect, useState } from 'react'

export default function Sidebar() {
  const [isDark, setIsDark] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('reelly-theme')

    if (saved === 'dark' || saved === 'light') {
      applyTheme(saved === 'dark')
      return
    }

    const hour = new Date().getHours()
    const shouldBeDark = hour >= 18 || hour < 6
    applyTheme(shouldBeDark)
  }, [])

  const applyTheme = (dark: boolean) => {
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }

  const toggleTheme = () => {
    const newValue = !isDark
    applyTheme(newValue)
    localStorage.setItem('reelly-theme', newValue ? 'dark' : 'light')
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: expanded ? 160 : 56,
        backgroundColor: 'var(--card-bg)',
        borderRight: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: expanded ? 'flex-start' : 'center',
        padding: '20px 12px',
        gap: 16,
        transition: 'width 0.2s ease',
        zIndex: 100,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 18,
          cursor: 'pointer',
          color: 'var(--ink)',
          padding: 4,
        }}
      >
        {expanded ? '←' : '☰'}
      </button>

      <button
        onClick={toggleTheme}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 16,
          cursor: 'pointer',
          color: 'var(--ink)',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>{isDark ? '☀️' : '🌙'}</span>
        {expanded && <span style={{ fontSize: 13, fontFamily: "'Inter', sans-serif" }}>{isDark ? 'Light' : 'Dark'}</span>}
      </button>
    </div>
  )
}
