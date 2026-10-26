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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Poppins', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <Link href="/"><ReelezyLogo size={44} /></Link>
        </nav>
        <div style={{ padding: '16px 24px 64px', maxWidth: 640, margin: '0 auto' }}>
          {signedIn === false ? (
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              <Link href="/login" style={{ color: 'var(--coral)', fontWeight: 600 }}>Log in</Link> to get your referral link.
            </p>
          ) : signedIn ? <ReferralCard /> : null}
        </div>
      </div>
    </div>
  )
}
