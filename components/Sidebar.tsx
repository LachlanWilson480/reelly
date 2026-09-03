'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Sidebar() {
  const [isDark, setIsDark] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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

  const railContent = (isMobileDrawer: boolean) => (
    <>
      <button
        onClick={() => (isMobileDrawer ? setMobileOpen(false) : setExpanded(!expanded))}
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
        <span style={{ width: 20, textAlign: 'center' }}>{isMobileDrawer ? '✕' : expanded ? '←' : '☰'}</span>
        {(expanded || isMobileDrawer) && <span style={{ fontSize: 13, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>{isMobileDrawer ? 'Close' : 'Collapse'}</span>}
      </button>

      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => isMobileDrawer && setMobileOpen(false)}
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
          {(expanded || isMobileDrawer) && <span>{item.label}</span>}
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
        {(expanded || isMobileDrawer) && <span style={{ fontSize: 13, fontFamily: "'Inter', sans-serif" }}>{isDark ? 'Light mode' : 'Dark mode'}</span>}
      </button>
    </>
  )

  return (
    <>
      <div
        className="sidebar-rail"
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
        {railContent(false)}
      </div>

      <button
        className="sidebar-mobile-trigger"
        onClick={() => setMobileOpen(true)}
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 100,
          width: 40,
          height: 40,
          borderRadius: 10,
          border: '1px solid rgba(128,128,128,0.25)',
          background: 'var(--card-bg)',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: 'var(--ink)',
          cursor: 'pointer',
        }}
      >
        ☰
      </button>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              height: '100vh',
              width: 220,
              backgroundColor: 'var(--card-bg)',
              borderRight: '1px solid rgba(128,128,128,0.15)',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 12px',
              gap: 4,
              zIndex: 200,
            }}
          >
            {railContent(true)}
          </div>
        </div>
      )}
    </>
  )
}
