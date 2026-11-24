'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/authFetch'
import { REFERRAL_PERCENT_OFF } from '@/lib/pricing'

type Info = { code: string; joined: number; subscribed: number; monthsEarned: number; limit: number }

const FONT = "var(--font-geist-sans), 'Inter', sans-serif"

// Your referral code as a ticket, with quick ways to send it and how many friends have joined
export default function ReferralCard() {
  const [info, setInfo] = useState<Info | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState<'' | 'code' | 'link' | 'message'>('')

  useEffect(() => {
    let cancelled = false
    authFetch('/api/referral')
      .then(async (r) => { const d = await r.json(); if (!cancelled) { if (r.ok && d.code) setInfo(d); else setFailed(true) } })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  const site = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://www.reelezy.com')
  const link = info ? `${site}/signup?ref=${info.code}` : ''
  // What a friend receives: the offer, the code and the sign up link
  const shareText = info ? `I use Reelezy to plan, film and edit my social videos. Use my code ${info.code} and get ${REFERRAL_PERCENT_OFF}% off your first month:` : ''

  const copy = async (what: 'code' | 'link' | 'message', text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 2000) } catch {}
  }
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Reelezy', text: shareText, url: link })
      else await copy('message', `${shareText} ${link}`)
    } catch {}
  }

  const message = encodeURIComponent(`${shareText} ${link}`)
  const quick = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${message}` },
    { label: 'Text', href: `sms:?&body=${message}` },
    { label: 'Email', href: `mailto:?subject=${encodeURIComponent(`${REFERRAL_PERCENT_OFF}% off Reelezy`)}&body=${message}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
  ]

  const btn: React.CSSProperties = { padding: '12px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }
  const used = info ? Math.min(info.monthsEarned, info.limit) : 0

  return (
    <div id="refer" style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 16, padding: 'clamp(20px, 4vw, 32px)', color: 'var(--ink)', fontFamily: FONT, boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
      {failed ? (
        <p style={{ fontSize: 14, color: 'var(--coral)', margin: 0 }}>Your referral code could not load. Refresh the page to try again.</p>
      ) : !info ? (
        <div aria-busy="true" style={{ height: 180, borderRadius: 12, background: 'linear-gradient(90deg, var(--sand) 0%, var(--line) 50%, var(--sand) 100%)', backgroundSize: '200% 100%', animation: 'refer-shimmer 1.4s ease-in-out infinite' }} />
      ) : (
        <>
          {/* The ticket */}
          <div style={{ position: 'relative', borderRadius: 14, padding: 'clamp(20px, 4vw, 28px)', background: 'linear-gradient(135deg, var(--coral) 0%, #ff8f6b 100%)', color: '#fff', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
            <div aria-hidden style={{ position: 'absolute', right: 60, bottom: -60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: 0, opacity: 0.9 }}>Your code</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8, position: 'relative' }}>
              <p style={{ fontSize: 'clamp(30px, 7vw, 44px)', fontWeight: 800, letterSpacing: 6, margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', userSelect: 'all' }}>{info.code}</p>
              <button type="button" onClick={() => copy('code', info.code)} style={{ ...btn, padding: '8px 16px', fontSize: 13, background: '#fff', color: 'var(--coral)', border: 'none' }}>{copied === 'code' ? 'Copied' : 'Copy'}</button>
            </div>
            <div style={{ borderTop: '2px dashed rgba(255,255,255,0.45)', margin: '18px 0 14px' }} />
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.5, position: 'relative' }}>
              Friends get <strong>{REFERRAL_PERCENT_OFF}% off</strong> their first month. You get <strong>{REFERRAL_PERCENT_OFF}% off</strong> your next month for each one who subscribes.
            </p>
          </div>

          {/* Ways to send it */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <button type="button" onClick={share} style={{ ...btn, flex: '1 1 160px', background: 'var(--ink)', color: 'var(--background)', border: 'none' }}>{copied === 'message' ? 'Message copied' : 'Share with a friend'}</button>
            <button type="button" onClick={() => copy('link', link)} style={{ ...btn, flex: '1 1 160px', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)' }}>{copied === 'link' ? 'Link copied' : 'Copy sign up link'}</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {quick.map(q => (
              <a key={q.label} href={q.href} target={q.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', padding: '7px 14px', borderRadius: 999, background: 'var(--sand)' }}>{q.label}</a>
            ))}
          </div>

          {/* How it is going */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 22 }}>
            {[
              [info.joined, 'Friends joined'],
              [info.subscribed, 'Subscribed'],
              [info.monthsEarned, `${REFERRAL_PERCENT_OFF}% off months`],
            ].map(([n, label]) => (
              <div key={String(label)} style={{ background: 'var(--sand)', borderRadius: 12, padding: '14px 8px', textAlign: 'center' }}>
                <p style={{ fontSize: 26, fontWeight: 800, margin: 0, color: 'var(--ink)' }}>{n}</p>
                <p style={{ fontSize: 11, margin: '2px 0 0', color: 'var(--text-secondary)' }}>{label}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>Discount months earned</span><span>{used} of {info.limit}</span>
            </div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={info.limit} aria-valuenow={used} aria-label="Discount months earned" style={{ height: 8, borderRadius: 999, background: 'var(--sand)', overflow: 'hidden' }}>
              <div style={{ width: `${info.limit ? (used / info.limit) * 100 : 0}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--coral), #ff8f6b)', transition: 'width 600ms ease' }} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '14px 0 0', lineHeight: 1.5 }}>
            Your friend types the code when they sign up or in the Code box on Plans. They need to be new to Reelezy and make their first payment. If you are on the Free plan, your discount is saved for your first month.
          </p>
        </>
      )}
      <style>{'@keyframes refer-shimmer { 0% { background-position: 100% 0 } 100% { background-position: -100% 0 } }'}</style>
    </div>
  )
}
