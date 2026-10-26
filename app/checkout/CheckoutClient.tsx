'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe, type Appearance } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { ReelezyLogo } from '@/components/ReelezyLogo'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { CURRENCY_PRICES, PLAN_COPY, currencyForCountry } from '@/lib/pricing'
import { useCurrency } from '@/lib/useCurrency'
import { trackEvent } from '@/lib/track'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Phase = 'loading' | 'ready' | 'login' | 'already' | 'error' | 'returning' | 'failed' | 'success'

const check = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
    <circle cx="8" cy="8" r="8" fill="rgba(255,255,255,0.16)" />
    <path d="M4.6 8.2l2.3 2.3 4.5-4.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function PayForm({ dueLabel, returnUrl, onSuccess }: { dueLabel: string; returnUrl: string; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || submitting) return
    setSubmitting(true)
    setError('')
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: 'if_required' })
    if (result.error) {
      setError(result.error.message || 'The payment did not go through. Please check your details and try again.')
      setSubmitting(false)
      return
    }
    const status = result.paymentIntent?.status
    if (status && status !== 'succeeded' && status !== 'processing') {
      setError('The payment did not go through. Please try again.')
      setSubmitting(false)
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={submit}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p role="alert" style={{ fontSize: 13, color: 'var(--coral)', margin: '14px 0 0', lineHeight: 1.4 }}>{error}</p>}
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        style={{ width: '100%', marginTop: 20, padding: '15px 20px', borderRadius: 12, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: !stripe || submitting ? 'not-allowed' : 'pointer', opacity: !stripe || submitting ? 0.7 : 1 }}
      >
        {submitting ? 'Processing…' : `Subscribe · ${dueLabel}`}
      </button>
    </form>
  )
}

export default function CheckoutClient() {
  const router = useRouter()
  const params = useSearchParams()
  const rawPlan = params.get('plan')
  const plan: 'mid' | 'top' | null = rawPlan === 'top' ? 'top' : rawPlan === 'mid' || rawPlan === 'basic' ? 'mid' : null
  const interval: 'monthly' | 'yearly' = params.get('interval') === 'monthly' ? 'monthly' : 'yearly'
  const code = params.get('code') || ''
  const redirectStatus = params.get('redirect_status')

  const detectedCurrency = useCurrency()
  const [country, setCountry] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [percentOff, setPercentOff] = useState<number | null>(null)
  const [referred, setReferred] = useState(false)
  const [refInput, setRefInput] = useState('')
  const [refMsg, setRefMsg] = useState('')
  const [refBusy, setRefBusy] = useState(false)
  const started = useRef(false)

  const currency = currencyForCountry(country) ?? detectedCurrency
  const copy = plan === 'top' ? PLAN_COPY.pro : PLAN_COPY.basic
  const planName = plan === 'top' ? 'Pro' : 'Basic'

  const finish = () => {
    setPhase('success')
    trackEvent('checkout_completed', { plan: plan || 'unknown', interval })
    // Ask Stripe for the final status so the plan is on straight away
    authFetch('/api/sync-subscription', { method: 'POST' }).catch(() => {}).finally(() => setTimeout(() => router.push('/dashboard'), 2200))
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    const run = async () => {
      if (!plan) { router.replace('/plans'); return }
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) { setPhase('login'); return }
      setEmail(user.email || '')

      // Back from a bank or card check that opened another page
      if (redirectStatus) {
        if (redirectStatus === 'failed') { setPhase('failed'); return }
        setPhase('returning')
        finish()
        return
      }

      const [{ data: profile }, { data: sub }] = await Promise.all([
        supabase.from('business_profiles').select('country').eq('user_id', user.id).maybeSingle(),
        supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
      ])
      setCountry(profile?.country || null)
      if (sub?.status === 'active') { setPhase('already'); return }

      try {
        const { data: ref } = await supabase.from('referrals').select('status').eq('referred_id', user.id).maybeSingle()
        if (ref && ref.status === 'signed_up') setReferred(true)
      } catch {}

      if (code) {
        try {
          const r = await fetch('/api/validate-discount', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
          const d = await r.json()
          if (r.ok && typeof d.percentOff === 'number') setPercentOff(d.percentOff)
        } catch {}
      }

      const res = await authFetch('/api/create-subscription', {
        method: 'POST',
        body: JSON.stringify({ email: user.email, plan, billingInterval: interval, discountCode: code || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.clientSecret) {
        setMessage(data.error || 'We could not start checkout. Please try again.')
        setPhase('error')
        return
      }
      setClientSecret(data.clientSecret)
      setPhase('ready')
    }
    run().catch(() => { setMessage('We could not start checkout. Please try again.'); setPhase('error') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyReferral = async () => {
    const c = refInput.trim().toUpperCase()
    if (!c || refBusy) return
    setRefBusy(true)
    setRefMsg('')
    try {
      const res = await authFetch('/api/referral/claim', { method: 'POST', body: JSON.stringify({ code: c }) })
      const d = await res.json().catch(() => ({}))
      if (d.claimed) setReferred(true)
      else {
        const reasons: Record<string, string> = {
          unknown_code: 'That code is not right. Check it and try again.',
          own_code: 'You cannot use your own code.',
          already_referred: 'A referral code is already on your account.',
          not_new: 'Referral codes are for new accounts only.',
          has_subscription: 'Referral codes are for new accounts only.',
        }
        setRefMsg(reasons[d.reason] || 'That code could not be used.')
      }
    } catch {
      setRefMsg('That code could not be checked. Try again.')
    }
    setRefBusy(false)
  }

  const cp = currency ? CURRENCY_PRICES[currency] : null
  const base = cp ? (interval === 'yearly' ? (plan === 'top' ? cp.proYearly : cp.basicYearly) : (plan === 'top' ? cp.pro : cp.basic)) : 0
  const discount = percentOff ? base * (percentOff / 100) : 0
  const due = Math.max(0, base - discount)
  const money = (n: number) => (cp ? `${cp.symbol}${n.toFixed(2)}` : '')
  const dueLabel = cp ? `${money(due)} ${currency}` : ''
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  const appearance: Appearance = {
    theme: isDark ? 'night' : 'stripe',
    variables: {
      colorPrimary: '#FF6A4D',
      fontFamily: 'Poppins, system-ui, sans-serif',
      borderRadius: '10px',
      colorBackground: isDark ? '#232129' : '#ffffff',
      colorText: isDark ? '#F1EFE8' : '#2C2C2A',
    },
  }

  const backLink = (
    <Link href="/plans" style={{ color: 'var(--coral)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Back to plans</Link>
  )

  const panel = (title: string, text: string, extra?: React.ReactNode) => (
    <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>{title}</h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>{text}</p>
      {extra}
    </div>
  )

  let right: React.ReactNode
  if (phase === 'loading') {
    right = <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>Getting your checkout ready…</p>
  } else if (phase === 'login') {
    right = panel('Log in to continue', 'You need an account to subscribe.', <Link href="/login" style={{ display: 'inline-block', background: 'var(--coral)', color: '#fff', padding: '12px 22px', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Log in</Link>)
  } else if (phase === 'already') {
    right = panel('You already have a plan', 'To change or cancel it, open Manage billing on the plans page.', backLink)
  } else if (phase === 'failed') {
    right = panel('That payment did not go through', 'Nothing was charged. You can go back and try again.', backLink)
  } else if (phase === 'error') {
    right = panel('Checkout could not start', message, backLink)
  } else if (phase === 'returning' || phase === 'success') {
    right = (
      <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--coral)', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="30" height="30" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.6 8.4l2.9 2.9 6-6.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 8px' }}>You&apos;re on {planName}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>Payment received. Taking you to your dashboard…</p>
      </div>
    )
  } else {
    right = (
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Payment details</h2>
        {email && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 22px' }}>Your receipt will go to {email}</p>}
        {referred && (
          <p style={{ fontSize: 13, color: 'var(--ink)', background: 'rgba(255,106,77,0.1)', border: '1px solid rgba(255,106,77,0.35)', borderRadius: 10, padding: '10px 12px', margin: '0 0 20px', lineHeight: 1.45 }}>
            A friend referred you. They get a month free when you subscribe.
          </p>
        )}
        {!referred && (
          <div style={{ margin: '0 0 20px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={refInput}
                onChange={(e) => setRefInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyReferral() } }}
                placeholder="Referral code (optional)"
                autoComplete="off"
                aria-label="Referral code"
                style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(128,128,128,0.3)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 16, fontFamily: 'inherit' }}
              />
              <button type="button" onClick={applyReferral} disabled={refBusy || !refInput.trim()} style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid var(--coral)', background: 'transparent', color: 'var(--coral)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: refBusy || !refInput.trim() ? 'not-allowed' : 'pointer', opacity: refBusy || !refInput.trim() ? 0.6 : 1 }}>{refBusy ? 'Checking…' : 'Apply'}</button>
            </div>
            {refMsg && <p role="alert" style={{ fontSize: 12, color: 'var(--coral)', margin: '6px 0 0' }}>{refMsg}</p>}
          </div>
        )}
        <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret, appearance, fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap' }] }}>
          <PayForm dueLabel={dueLabel || 'Pay now'} returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/checkout?plan=${plan}&interval=${interval}`} onSuccess={finish} />
        </Elements>
        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', margin: '18px 0 0' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.5" /><path d="M5.2 7V5.2a2.8 2.8 0 015.6 0V7" stroke="currentColor" strokeWidth="1.5" /></svg>
          Payments are handled securely by Stripe. We never see your card details.
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, margin: '10px 0 0' }}>
          By subscribing you agree to our <Link href="/terms" style={{ color: 'var(--text-secondary)' }}>Terms</Link> and <Link href="/privacy" style={{ color: 'var(--text-secondary)' }}>Privacy Policy</Link>. Cancel any time from Manage billing.
        </p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", color: 'var(--ink)', background: 'var(--background)' }}>
      <style>{`
        .co-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); min-height: 100vh; }
        .co-left { background: linear-gradient(150deg, #26215C 0%, #712B13 100%); color: #F1EFE8; padding: 40px clamp(24px, 5vw, 72px); display: flex; flex-direction: column; }
        .co-right { padding: 56px clamp(24px, 5vw, 72px); display: flex; flex-direction: column; justify-content: center; }
        @media (max-width: 860px) {
          .co-grid { grid-template-columns: minmax(0, 1fr); min-height: 0; }
          .co-left { padding: 28px 20px 32px; }
          .co-right { padding: 32px 20px 48px; }
        }
      `}</style>
      <div className="co-grid">
        <aside className="co-left">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
            <Link href="/"><ReelezyLogo size={40} /></Link>
            <Link href="/plans" style={{ fontSize: 13, color: '#D3D1C7', textDecoration: 'none' }}>Back to plans</Link>
          </div>
          <p style={{ fontSize: 13, color: '#D3D1C7', margin: '0 0 6px' }}>You&apos;re subscribing to</p>
          <h1 style={{ fontSize: 'clamp(34px, 5vw, 48px)', fontWeight: 600, lineHeight: 1.1, margin: '0 0 6px' }}>{plan ? planName : ''}</h1>
          <p style={{ fontSize: 14, color: '#D3D1C7', margin: '0 0 28px' }}>{copy.desc}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {copy.features.map((f) => (
              <li key={f} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.4 }}>{check}<span>{f}</span></li>
            ))}
          </ul>
          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 20 }}>
            {cp ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                  <span>{planName}, billed {interval === 'yearly' ? 'yearly' : 'monthly'}</span>
                  <span>{money(base)}</span>
                </div>
                {interval === 'yearly' && <p style={{ fontSize: 12, color: '#D3D1C7', margin: '0 0 8px' }}>That&apos;s {money(base / 12)} a month, with two months free.</p>}
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8, color: '#FFB4A5' }}>
                    <span>Discount {code} ({percentOff}% off)</span>
                    <span>-{money(discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 16, fontWeight: 600, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
                  <span>Due today</span>
                  <span style={{ fontSize: 24 }}>{money(due)} <span style={{ fontSize: 12, fontWeight: 400, color: '#D3D1C7' }}>{currency}</span></span>
                </div>
                <p style={{ fontSize: 12, color: '#D3D1C7', margin: '10px 0 0' }}>
                  {interval === 'yearly' ? `Renews each year at ${money(base)}.` : `Renews each month at ${money(base)}.`} Cancel any time.
                </p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#D3D1C7', margin: 0 }}>Working out your price…</p>
            )}
          </div>
        </aside>
        <main className="co-right">{right}</main>
      </div>
    </div>
  )
}
