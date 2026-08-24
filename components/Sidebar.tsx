'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

  const navItems = [
    { href: '/?stay=1', label: 'Home', icon: '⌂' },
    { href: '/dashboard', label: 'Dashboard', icon: '▦' },
    { href: '/editor', label: 'Editor', icon: '✂' },
    { href: '/history', label: 'History', icon: '◷' },
    { href: '/plans', label: 'Plans', icon: '◆' },
    { href: '/settings', label: 'Settings', icon: '⚙' },
    { href: '/customise', label: 'Customise Generation', icon: '✎' },
    { href: '/terms', label: 'Terms of Service', icon: '§' },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: expanded ? 200 : 56,
        backgroundColor: 'var(--card-bg)',
        borderRight: '1px solid rgba(128,128,128,0.15)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 12px',
        gap: 4,
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
          padding: '8px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          width: '100%',
        }}
      >
        <span style={{ width: 20, textAlign: 'center' }}>{expanded ? '←' : '☰'}</span>
        {expanded && <span style={{ fontSize: 13, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>Collapse</span>}
      </button>

      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 4px',
            borderRadius: 8,
            textDecoration: 'none',
            color: 'var(--ink)',
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ width: 20, textAlign: 'center', fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
          {expanded && <span>{item.label}</span>}
        </Link>
      ))}

      <div style={{ flex: 1 }} />

      <button
        onClick={toggleTheme}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 15,
          cursor: 'pointer',
          color: 'var(--ink)',
          padding: '10px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ width: 20, textAlign: 'center' }}>{isDark ? '☀️' : '🌙'}</span>
        {expanded && <span style={{ fontSize: 13, fontFamily: "'Inter', sans-serif" }}>{isDark ? 'Light mode' : 'Dark mode'}</span>}
      </button>
    </div>
  )
}
