}'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('reelly-theme')

    if (savedTheme === 'dark') {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    } else if (savedTheme === 'light') {
      setIsDark(false)
      document.documentElement.classList.remove('dark')
    } else {
      const hour = new Date().getHours()
      const shouldBeDark = hour >= 18 || hour < 6

      setIsDark(shouldBeDark)
      document.documentElement.classList.toggle('dark', shouldBeDark)
    }
  }, [])

  const toggle = () => {
    const newTheme = !isDark

    setIsDark(newTheme)
    document.documentElement.classList.toggle('dark', newTheme)

    localStorage.setItem(
      'reelly-theme',
      newTheme ? 'dark' : 'light'
    )
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
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  )
}
