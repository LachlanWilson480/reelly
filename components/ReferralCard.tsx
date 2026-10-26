'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/authFetch'

type Info = { code: string; joined: number; subscribed: number; monthsEarned: number; limit: number }

export default function ReferralCard() {
  const [info, setInfo] = useState<Info | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    authFetch('/api/referral')
      .then(async (r) => { const d = await r.json(); if (!cancelled) { if (r.ok && d.code) setInfo(d); else setFailed(true) } })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  const link = info ? `${process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://www.reelezy.com')}/signup?ref=${info.code}` : ''

  const copy = async () => {
    try { await navigator.clipboard.writeText(info?.code || ''); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Reelezy', text: `I use Reelezy to plan, film and edit my social videos. Use my referral code ${info?.code} to get 30% off your first payment:`, url: link })
      else await copy()
    } catch {}
  }

  const stat = (n: number, label: string) => (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
      <p style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#F1EFE8' }}>{n}</p>
      <p style={{ fontSize: 11, margin: '2px 0 0', color: '#D3D1C7' }}>{label}</p>
    </div>
  )

  return (
    <div id="refer" style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 20, padding: '28px 28px 24px', color: '#F1EFE8', fontFamily: "'Poppins', sans-serif" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 6px' }}>Refer a friend, get a month free</h2>
      <p style={{ fontSize: 13, color: '#D3D1C7', margin: '0 0 18px', lineHeight: 1.5 }}>
        When a friend signs up with your link and subscribes, you get a month of the plan they bought, free. If you already pay, it comes off your next bill. If you are on the Free plan, you get that plan free for a month.
      </p>
      {failed ? (
        <p style={{ fontSize: 13, color: '#FFB4A5', margin: 0 }}>Your referral link could not load. Refresh the page to try again.</p>
      ) : !info ? (
        <p style={{ fontSize: 13, color: '#D3D1C7', margin: 0 }}>Loading your link…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0, padding: '10px 14px', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#D3D1C7', margin: 0 }}>Your referral code</p>
              <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: 4, margin: 0, color: '#fff', userSelect: 'all' }}>{info.code}</p>
            </div>
            <button type="button" onClick={copy} style={{ padding: '11px 18px', borderRadius: 10, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? 'Copied' : 'Copy code'}</button>
            <button type="button" onClick={share} style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Share</button>
          </div>
          <p style={{ fontSize: 12, color: '#D3D1C7', margin: '10px 0 0', lineHeight: 1.5 }}>Your friend types this code in when they sign up or choose a plan.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, padding: '14px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.07)' }}>
            {stat(info.joined, 'Friends joined')}
            {stat(info.subscribed, 'Subscribed')}
            {stat(info.monthsEarned, 'Months earned')}
          </div>
          <p style={{ fontSize: 11, color: '#D3D1C7', margin: '14px 0 0', lineHeight: 1.5 }}>
            Your friend needs to be new to Reelezy and make a paid first payment. Up to {info.limit} free months per person.
          </p>
        </>
      )}
    </div>
  )
}
