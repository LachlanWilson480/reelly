'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { ReelezyLogo } from '@/components/ReelezyLogo'
import ReferralCard from '@/components/ReferralCard'
import { supabase } from '@/lib/supabase'
import { REFERRAL_PERCENT_OFF } from '@/lib/pricing'

const FONT = "var(--font-geist-sans), 'Inter', sans-serif"
const P = REFERRAL_PERCENT_OFF

const STEPS = [
  { n: '1', title: 'Send your code', body: 'Share it with a business owner you know: the cafe next door, your barber, a mate with a side hustle.' },
  { n: '2', title: 'They save straight away', body: `They sign up with your code and get ${P}% off their first month of Basic or Pro.` },
  { n: '3', title: 'You save too', body: `When they make their first payment, ${P}% comes off your next month. Every friend counts.` },
]

const FAQ = [
  { q: 'Who can use my code?', a: 'Anyone new to Reelezy who has not paid for a plan before. They can type it when they sign up, or in the Code box on Plans.' },
  { q: 'When do I get my discount?', a: 'Once your friend makes their first payment. If you already pay, it comes off your next bill. If you are on the Free plan, it is saved for your first month.' },
  { q: 'Is there a limit?', a: 'You can earn up to 12 months of discounts. That is a lot of free reels.' },
]

export default function ReferPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)).catch(() => setSignedIn(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: FONT, color: 'var(--ink)', overflowX: 'hidden' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav className="plans-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <Link href="/"><ReelezyLogo size={44} /></Link>
        </nav>

        <div style={{ padding: '8px 20px 80px', maxWidth: 1040, margin: '0 auto' }}>
          {/* Hero */}
          <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'clamp(24px, 5vw, 56px)', marginBottom: 56 }}>
            <div style={{ flex: '1 1 380px', minWidth: 0 }}>
              <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--coral)', background: 'color-mix(in srgb, var(--coral) 12%, transparent)', padding: '6px 12px', borderRadius: 999 }}>Refer a friend</span>
              <h1 style={{ fontSize: 'clamp(36px, 6vw, 60px)', lineHeight: 1.02, fontWeight: 800, letterSpacing: -1.5, margin: '16px 0 16px' }}>
                Give {P}%.<br /><span style={{ color: 'var(--coral)' }}>Get {P}%.</span>
              </h1>
              <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, maxWidth: 480 }}>
                Know another business owner who needs better reels? Send them your code. They save {P}% on their first month, and you save {P}% on your next one.
              </p>
            </div>

            {/* Two tickets, one for each of you */}
            <div aria-hidden style={{ flex: '1 1 300px', minWidth: 0, position: 'relative', height: 300, maxWidth: 420, width: '100%' }}>
              <div style={{ position: 'absolute', left: 0, top: 8, width: '72%', borderRadius: 16, padding: 22, background: 'var(--ink)', color: 'var(--background)', transform: 'rotate(-6deg)', boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: 0, opacity: 0.7 }}>Your friend</p>
                <p style={{ fontSize: 40, fontWeight: 800, margin: '6px 0 0' }}>{P}% off</p>
                <p style={{ fontSize: 13, margin: '2px 0 0', opacity: 0.8 }}>their first month</p>
              </div>
              <div style={{ position: 'absolute', right: 0, bottom: 8, width: '72%', borderRadius: 16, padding: 22, background: 'linear-gradient(135deg, var(--coral) 0%, #ff8f6b 100%)', color: '#fff', transform: 'rotate(4deg)', boxShadow: '0 20px 50px rgba(255,106,77,0.35)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: 0, opacity: 0.9 }}>You</p>
                <p style={{ fontSize: 40, fontWeight: 800, margin: '6px 0 0' }}>{P}% off</p>
                <p style={{ fontSize: 13, margin: '2px 0 0', opacity: 0.9 }}>your next month</p>
              </div>
            </div>
          </section>

          {/* Your code, or sign up to get one */}
          <section style={{ maxWidth: 640, margin: '0 auto 64px' }}>
            {signedIn === false ? (
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 16, padding: 'clamp(24px, 4vw, 36px)', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Get your own code</h2>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 22px' }}>Make a free account and your code is ready straight away. No card needed.</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link href="/signup" style={{ background: 'var(--coral)', color: '#fff', padding: '13px 26px', borderRadius: 999, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Sign up free</Link>
                  <Link href="/login" style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', padding: '12px 26px', borderRadius: 999, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>Log in</Link>
                </div>
              </div>
            ) : signedIn ? <ReferralCard /> : <div style={{ height: 320 }} />}
          </section>

          {/* How it works */}
          <section style={{ marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 800, letterSpacing: -0.5, textAlign: 'center', margin: '0 0 28px' }}>How it works</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {STEPS.map(s => (
                <div key={s.n} style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 16, padding: 24 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>{s.n}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '16px 0 6px' }}>{s.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Questions */}
          <section style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: 800, margin: '0 0 14px' }}>Questions</h2>
            {FAQ.map(f => (
              <details key={f.q} style={{ borderTop: '1px solid var(--line)', padding: '14px 0' }}>
                <summary style={{ fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{f.q}</summary>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '8px 0 0' }}>{f.a}</p>
              </details>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
