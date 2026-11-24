'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { ReelezyLogo } from '@/components/ReelezyLogo'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { FONT, pageTitle } from '@/lib/ui'
import CreatorAccountsPanel from '@/components/admin/CreatorAccountsPanel'
import CreatorsPanel from '@/components/admin/CreatorsPanel'
import CodesPanel from '@/components/admin/CodesPanel'
import GivenPlansPanel from '@/components/admin/GivenPlansPanel'

const TABS = [
  { id: 'accounts', label: 'Creator accounts' },
  { id: 'creators', label: 'Creators and payouts' },
  { id: 'codes', label: 'Discount codes' },
  { id: 'plans', label: 'Given plans' },
] as const
type Tab = typeof TABS[number]['id']

// Everything for running Reelezy in one place. Only the emails in ADMIN_EMAILS (Vercel) can open it.
export default function AdminPage() {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'denied' | 'ready'>('loading')
  const [tab, setTab] = useState<Tab>('accounts')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (TABS.some(x => x.id === t)) setTab(t as Tab)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      try {
        const r = await authFetch('/api/admin/me')
        const d = await r.json()
        setState(d.admin ? 'ready' : 'denied')
      } catch { setState('denied') }
    })
  }, [router])

  const pick = (t: Tab) => {
    setTab(t)
    window.history.replaceState(null, '', `/admin?tab=${t}`)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: FONT, color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav className="admin-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <Link href="/"><ReelezyLogo size={44} /></Link>
        </nav>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 20px 80px' }}>
          <h1 style={{ ...pageTitle, marginBottom: 20 }}>Admin</h1>
          {state === 'loading' && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading…</p>}
          {state === 'denied' && (
            <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 520 }}>This page is for the Reelezy team. If that is you, add your email to ADMIN_EMAILS in Vercel and redeploy.</p>
          )}
          {state === 'ready' && (
            <>
              <div role="tablist" aria-label="Admin sections" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 28, overflowX: 'auto' }}>
                {TABS.map(t => (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => pick(t.id)}
                    style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--coral)' : 'transparent'}`, padding: '10px 14px', marginBottom: -1, fontSize: 14, fontWeight: tab === t.id ? 600 : 500, color: tab === t.id ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT }}>
                    {t.label}
                  </button>
                ))}
              </div>
              {tab === 'accounts' && <CreatorAccountsPanel />}
              {tab === 'creators' && <CreatorsPanel />}
              {tab === 'codes' && <CodesPanel />}
              {tab === 'plans' && <GivenPlansPanel />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
