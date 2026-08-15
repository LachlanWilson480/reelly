'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

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

  const toggle = () => {
    const newValue = !isDark
    applyTheme(newValue)
    localStorage.setItem('reelly-theme', newValue ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      style={{
        background: 'none',
        border: '1px solid var(--ink)',
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 13,
        color: 'var(--ink)',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  )
}
