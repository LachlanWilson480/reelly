'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Tooltip from './Tooltip'
import { usePathname, useSearchParams } from 'next/navigation'
import Icon from '@/components/Icon'
// Share the app's one Supabase client. A second client refreshes the same login token on its own and can sign people out.
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'

const DASHBOARD_TABS = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'ideas', label: 'Content Ideas', icon: '◈' },
  { id: 'myideas', label: 'My Ideas', icon: <Icon n="star" /> },
  { id: 'filming', label: 'Filming', icon: '◉' },
  { id: 'uploads', label: 'AI Editor For Any Video', icon: <Icon n="up" /> },
  { id: 'aiuploads', label: 'AI Editor For Generated Idea', icon: '◆' },
  { id: 'library', label: 'Clip Library', icon: '▤' },
]

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileShowFullMenu, setMobileShowFullMenu] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  // The Admin link only shows for the Reelezy team (the server decides, from ADMIN_EMAILS)
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (!isLoggedIn) return
    let cancelled = false
    try { if (sessionStorage.getItem('reelezy-admin') === '1') { setIsAdmin(true); return } } catch {}
    authFetch('/api/admin/me').then(r => r.json()).then(d => {
      if (cancelled || !d?.admin) return
      setIsAdmin(true)
      try { sessionStorage.setItem('reelezy-admin', '1') } catch {}
    }).catch(() => {})
    return () => { cancelled = true }
  }, [isLoggedIn])
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
        setIsAdmin(false)
        try { sessionStorage.removeItem('reelezy-admin') } catch {}
      } else {
        setIsLoggedIn(!!session)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!isLoggedIn) return null

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: <Icon n="home" /> },
    { href: "/plans", label: "Plans", icon: <Icon n="dollar" /> },
    { href: "/refer", label: "Refer a friend", icon: <Icon n="megaphone" /> },
    { href: "/history", label: "History", icon: <Icon n="clock" /> },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: <Icon n="key" /> }] : []),
  ]

  const bottomNavItems = [
    { href: "/privacy", label: "Privacy Policy", icon: <Icon n="privacy" /> },
    { href: "/terms", label: "Terms of Service", icon: <Icon n="terms" /> },
    { href: "/settings", label: "Settings", icon: <Icon n="cog" /> },
  ]
  const isOnDashboard = pathname === '/dashboard'
  const currentTab = searchParams.get('tab') || 'overview'

  const railContent = (isMobileDrawer: boolean) => {
    const showDashboardTabs = isMobileDrawer && isOnDashboard && !mobileShowFullMenu

    return (
      <>
        <button
          aria-label={isMobileDrawer ? 'Close the menu' : expanded ? 'Collapse the menu' : 'Expand the menu'}
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
          <span style={{ width: 20, textAlign: 'center' }}>{isMobileDrawer ? <Icon n="close" /> : expanded ? <Icon n="back" /> : <Icon n="menu" />}</span>
          {(expanded || isMobileDrawer) && <span style={{ fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontWeight: 500 }}>{isMobileDrawer ? 'Close' : 'Collapse'}</span>}
        </button>

        {showDashboardTabs && (
          <button
            onClick={() => setMobileShowFullMenu(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 4px',
              borderRadius: 4,
              background: 'var(--sand)',
              border: 'none',
              textAlign: 'left',
              color: 'var(--ink)',
              fontSize: 13,
              fontFamily: "var(--font-geist-sans), 'Inter', sans-serif",
              cursor: 'pointer',
              marginBottom: 8,
            }}
          >
            <span style={{ width: 20, textAlign: 'center', fontSize: 16, flexShrink: 0 }}><Icon n="home" /></span>
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
                  borderRadius: 4,
                  textDecoration: 'none',
                  color: currentTab === item.id ? 'var(--coral)' : 'var(--ink)',
                  fontWeight: currentTab === item.id ? 600 : 400,
                  fontSize: 13,
                  fontFamily: "var(--font-geist-sans), 'Inter', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 20, textAlign: 'center', fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))
          : navItems.map((item) => (
              <Tooltip key={item.href} text={item.label}>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  onClick={() => isMobileDrawer && setMobileOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 4px',
                    borderRadius: 4,
                    textDecoration: 'none',
                    color: 'var(--ink)',
                    fontSize: 13,
                    fontFamily: "var(--font-geist-sans), 'Inter', sans-serif",
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                >
                  <span style={{ width: 20, textAlign: 'center', fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  {(expanded || isMobileDrawer) && <span>{item.label}</span>}
                </Link>
              </Tooltip>
            ))}

        <div style={{ flex: 1 }} />

        {!showDashboardTabs && bottomNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            onClick={() => isMobileDrawer && setMobileOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 4px",
              borderRadius: 4,
              textDecoration: "none",
              color: "var(--ink)",
              fontSize: 13,
              fontFamily: "var(--font-geist-sans), 'Inter', sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 20, textAlign: "center", fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
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
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 12px',
          gap: 16,
          transition: 'width 0.2s ease',
          zIndex: 100,
        }}
      >
        {railContent(false)}
      </div>

      <button
        className="sidebar-mobile-trigger"
        aria-label="Open the menu"
        onClick={() => setMobileOpen(true)}
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 100,
          width: 40,
          height: 40,
          borderRadius: 4,
          border: '1px solid var(--line)',
          background: 'var(--card-bg)',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: 'var(--ink)',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="16" height="2" rx="1" fill="currentColor"/>
          <rect y="5" width="16" height="2" rx="1" fill="currentColor"/>
          <rect y="10" width="16" height="2" rx="1" fill="currentColor"/>
        </svg>
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
              borderRight: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 12px',
              gap: 16,
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
