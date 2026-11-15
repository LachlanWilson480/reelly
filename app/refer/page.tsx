'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { ReelezyLogo } from '@/components/ReelezyLogo'
import ReferralCard from '@/components/ReferralCard'
import { supabase } from '@/lib/supabase'

export default function ReferPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)).catch(() => setSignedIn(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <Link href="/"><ReelezyLogo size={44} /></Link>
        </nav>
        <div style={{ padding: '16px 24px 64px', maxWidth: 640, margin: '0 auto' }}>
          {signedIn === false ? (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: '28px 24px', textAlign: 'center' }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Refer a friend, you both get 30% off</h1>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
                Share your link with another business owner. When they join and subscribe, they get 30% off their first month and you get 30% off your next month. Make a free account to get your own link.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/signup" style={{ display: 'inline-block', background: 'var(--coral)', color: '#fff', padding: '12px 22px', borderRadius: 4, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Sign up free</Link>
                <Link href="/login" style={{ display: 'inline-block', background: 'var(--card-bg)', color: 'var(--ink)', border: '1px solid var(--line)', padding: '11px 22px', borderRadius: 4, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Log in</Link>
              </div>
            </div>
          ) : signedIn ? <ReferralCard /> : null}
        </div>
      </div>
    </div>
  )
}
