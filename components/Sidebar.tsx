'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Tooltip from './Tooltip'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DASHBOARD_TABS = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'ideas', label: 'Content Ideas', icon: '✎' },
  { id: 'myideas', label: 'My Ideas', icon: '★' },
  { id: 'filming', label: 'Filming', icon: '✂' },
  { id: 'uploads', label: 'Uploads', icon: '⬆' },
  { id: 'aiuploads', label: 'AI Editor Uploads', icon: '⚡' },
]

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileShowFullMenu, setMobileShowFullMenu] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setMobileShowFullMenu(false)
  }, [pathname])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setIsLoggedIn(false)
      } else {
        setIsLoggedIn(!!session)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!isLoggedIn) return null

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "⌂" },
    { href: "/history", label: "History", icon: "◷" },
    { href: "/plans", label: "Plans", icon: "$" },
  ]

  const bottomNavItems = [
    { href: "/privacy", label: "Privacy Policy", icon: "§" },
    { href: "/settings", label: "Settings", icon: "⚙" },
    { href: "/terms", label: "Terms of Service", icon: "§" },
  ]
  const isOnDashboard = pathname === '/dashboard'
  const currentTab = searchParams.get('tab') || 'overview'

  const railContent = (isMobileDrawer: boolean) => {
    const showDashboardTabs = isMobileDrawer && isOnDashboard && !mobileShowFullMenu

    return (
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

        {showDashboardTabs && (
          <button
            onClick={() => setMobileShowFullMenu(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 4px',
              borderRadius: 8,
              background: 'var(--sand)',
              border: 'none',
              textAlign: 'left',
              color: 'var(--ink)',
              fontSize: 13,
              fontFamily: "'Inter', sans-serif",
              cursor: 'pointer',
              marginBottom: 8,
            }}
          >
            <span style={{ width: 20, textAlign: 'center', fontSize: 15, flexShrink: 0 }}>⌂</span>
            <span>Full menu</span>
          </button>
        )}

        {showDashboardTabs
          ? DASHBOARD_TABS.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard?tab=${item.id}`}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 4px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: currentTab === item.id ? 'var(--coral)' : 'var(--ink)',
                  fontWeight: currentTab === item.id ? 600 : 400,
                  fontSize: 13,
                  fontFamily: "'Inter', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 20, textAlign: 'center', fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))
          : navItems.map((item) => (
              <Tooltip key={item.href} text={item.label}>
                <Link
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
                    width: '100%',
                  }}
                >
                  <span style={{ width: 20, textAlign: 'center', fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                  {(expanded || isMobileDrawer) && <span>{item.label}</span>}
                </Link>
              </Tooltip>
            ))}

        <div style={{ flex: 1 }} />

        {!showDashboardTabs && bottomNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => isMobileDrawer && setMobileOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 4px",
              borderRadius: 8,
              textDecoration: "none",
              color: "var(--ink)",
              fontSize: 13,
              fontFamily: "'Inter', sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 20, textAlign: "center", fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
            {(expanded || isMobileDrawer) && <span>{item.label}</span>}
          </Link>
        ))}
      </>
    )
  }

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
