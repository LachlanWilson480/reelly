'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/authFetch'

type Info = { code: string; joined: number; subscribed: number; monthsEarned: number; limit: number }

export default function ReferralCard() {
  const [info, setInfo] = useState<Info | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

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
  // What a friend receives: the offer, the code and the sign up link
  const shareText = `I use Reelezy to plan, film and edit my social videos. Use my referral code ${info?.code} to get 30% off your first payment.`
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Reelezy', text: shareText, url: link })
      else {
        await navigator.clipboard.writeText(`${shareText} ${link}`)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2500)
      }
    } catch {}
  }

  const stat = (n: number, label: string) => (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
      <p style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>{n}</p>
      <p style={{ fontSize: 11, margin: '2px 0 0', color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  )

  return (
    <div id="refer" style={{ background: 'var(--sand)', border: '1px solid var(--line)', borderRadius: 4, padding: '28px 28px 24px', color: 'var(--ink)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 6px' }}>Refer a friend, get a month free</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.5 }}>
        Your friend gets 30% off their first payment when they join with your code, and you get 1 month free of the plan they buy. If you already pay, it comes off your next bill. If you are on the Free plan, you get that plan free for a month.
      </p>
      {failed ? (
        <p style={{ fontSize: 13, color: '#d92d20', margin: 0 }}>Your referral link could not load. Refresh the page to try again.</p>
      ) : !info ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Loading your link…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0, padding: '10px 14px', borderRadius: 4, border: '1px dashed var(--text-muted)', background: 'var(--sand)', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>Your referral code</p>
              <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: 4, margin: 0, color: 'var(--ink)', userSelect: 'all' }}>{info.code}</p>
            </div>
            <button type="button" onClick={copy} style={{ padding: '11px 18px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? 'Copied' : 'Copy code'}</button>
            <button type="button" onClick={share} style={{ padding: '11px 18px', borderRadius: 4, border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{shareCopied ? 'Message copied' : 'Share'}</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '10px 0 0', lineHeight: 1.5 }}>Your friend types this code in when they sign up or choose a plan.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, padding: '14px 8px', borderRadius: 4, background: 'var(--sand)' }}>
            {stat(info.joined, 'Friends joined')}
            {stat(info.subscribed, 'Subscribed')}
            {stat(info.monthsEarned, 'Months earned')}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '14px 0 0', lineHeight: 1.5 }}>
            Your friend needs to be on the Free plan and make their first paid payment. Up to {info.limit} free months per person.
          </p>
        </>
      )}
    </div>
  )
}
