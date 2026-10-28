'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ReelezyLogo } from '@/components/ReelezyLogo'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ReferralCard from '@/components/ReferralCard'
import { supabase } from '@/lib/supabase'
import { formatBytes, libraryLimitBytes } from '@/lib/clipLibrary'
import { authFetch } from '@/lib/authFetch'
import { getMonthStartISO } from '@/lib/billingMonth'
import { CURRENCY_PRICES, PLAN_COPY, REFERRAL_PERCENT_OFF, currencyForCountry } from '@/lib/pricing'
import { useCurrency } from '@/lib/useCurrency'
import { trackEvent } from '@/lib/track'
import { cleanReferralInput } from '@/lib/referralInput'

export default function PlansPage() {
  const router = useRouter()

  const detectedCurrency = useCurrency()
  const [libraryUsed, setLibraryUsed] = useState(0)
  const [profileCountry, setProfileCountry] = useState<string | null>(null)
  const accountCurrency = currencyForCountry(profileCountry) ?? detectedCurrency
  const currency = accountCurrency ?? 'AUD'
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<string | null>(null)
  const [accountLoaded, setAccountLoaded] = useState(false)
  const [referralPercent, setReferralPercent] = useState(0)
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
        try {
          const { data: ref } = await supabase.from('referrals').select('status').eq('referred_id', user.id).maybeSingle()
          if (ref && ref.status === 'signed_up') setReferralPercent(REFERRAL_PERCENT_OFF)
        } catch {}
        const { data: profile } = await supabase.from('business_profiles').select('business_name, country').eq('user_id', user.id).maybeSingle()
        setProfileCountry(profile?.country || null)
        setBusinessName(profile?.business_name || user.email || null)
        const { data: sub } = await supabase.from('subscriptions').select('plan, status, billing_interval, stripe_subscription_id').eq('user_id', user.id).maybeSingle()
        const activePlan = sub?.status === 'active' ? sub.plan : 'free'
        setUserPlan(activePlan)
        if (activePlan !== 'free' && sub) {
          setSubDetails({ plan: sub.plan, billing_interval: sub.billing_interval, stripe_subscription_id: sub.stripe_subscription_id || null })
          const { data: bp } = await supabase.from('business_profiles').select('ideas_generated_this_week, scripts_generated_this_week, filming_generated_this_week').eq('user_id', user.id).maybeSingle()
          const monthStart = getMonthStartISO()
          const { data: monthRenders } = await supabase.from('renders').select('duration_seconds').eq('user_id', user.id).gte('created_at', monthStart)
          const usedSeconds = (monthRenders || []).reduce((sum: number, r: { duration_seconds: number | null }) => sum + (r.duration_seconds || 0), 0)
          const { data: libRows } = await supabase.from('clip_library').select('size_bytes').eq('user_id', user.id)
          setLibraryUsed((libRows || []).reduce((sum: number, r: { size_bytes: number | null }) => sum + (r.size_bytes || 0), 0))
          setUsage({ ideas: bp?.ideas_generated_this_week || 0, scripts: bp?.scripts_generated_this_week || 0, filming: bp?.filming_generated_this_week || 0, renderMinutes: usedSeconds })
        }
      }
    }
    // Show the page only once the account has loaded, so subscribers never see the plan cards flash first
    loadUser().catch(() => {}).finally(() => setAccountLoaded(true))
  }, [])

  const p = CURRENCY_PRICES[currency]

  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly')
  const [discountCode, setDiscountCode] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [discountError, setDiscountError] = useState('')
  const [discountLoading, setDiscountLoading] = useState(false)
  const [discountPercent, setDiscountPercent] = useState<number | null>(null)
  const effectivePercent = Math.max(discountPercent ?? 0, referralPercent) || null
  const [refInput, setRefInput] = useState('')
  const [refMsg, setRefMsg] = useState('')
  const [refBusy, setRefBusy] = useState(false)
  const [subDetails, setSubDetails] = useState<{ plan: string; billing_interval: string; stripe_subscription_id: string | null } | null>(null)
  const [usage, setUsage] = useState<{ ideas: number; scripts: number; filming: number; renderMinutes: number } | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const pricing = [
    {
      id: 'free',
      name: 'Free',
      monthlyPrice: `${p.symbol}0`,
      yearlyPrice: `${p.symbol}0`,
      yearlyPerMonth: `${p.symbol}0`,
      desc: PLAN_COPY.free.desc,
      features: [...PLAN_COPY.free.features],
    },
    {
      id: 'mid',
      name: 'Basic',
      monthlyPrice: `${p.symbol}${p.basic}`,
      yearlyPrice: `${p.symbol}${p.basicYearly}`,
      yearlyPerMonth: `${p.symbol}${p.basicPerMonth}`,
      desc: PLAN_COPY.basic.desc,
      features: [...PLAN_COPY.basic.features],
    },
    {
      id: 'top',
      name: 'Pro',
      monthlyPrice: `${p.symbol}${p.pro}`,
      yearlyPrice: `${p.symbol}${p.proYearly}`,
      yearlyPerMonth: `${p.symbol}${p.proPerMonth}`,
      desc: PLAN_COPY.pro.desc,
      features: [...PLAN_COPY.pro.features],
      highlight: true,
    },
  ]
  const applyDiscount = async () => {
    if (!discountInput.trim()) return
    setDiscountLoading(true)
    setDiscountError('')
    setDiscountPercent(null)
    setDiscountCode('')
    const res = await fetch('/api/validate-discount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: discountInput.trim() }),
    })
    const data = await res.json()
    setDiscountLoading(false)
    if (!res.ok) {
      setDiscountError(data.error || 'Invalid code')
    } else {
      setDiscountCode(data.code)
      setDiscountPercent(data.percentOff)
    }
  }

  const applyReferral = async () => {
    const c = refInput.trim().toUpperCase()
    if (!c || refBusy) return
    setRefBusy(true)
    setRefMsg('')
    try {
      const res = await authFetch('/api/referral/claim', { method: 'POST', body: JSON.stringify({ code: c }) })
      const d = await res.json().catch(() => ({}))
      if (d.claimed) { setReferralPercent(REFERRAL_PERCENT_OFF); setRefInput('') }
      else {
        const reasons: Record<string, string> = {
          unknown_code: 'That code is not right. Check it and try again.',
          own_code: 'You cannot use your own code.',
          already_referred: 'A referral code is already on your account.',
          has_subscription: 'Referral codes are for accounts that have not subscribed before.',
        }
        setRefMsg(reasons[d.reason] || 'That code could not be used.')
      }
    } catch {
      setRefMsg('That code could not be checked. Try again.')
    }
    setRefBusy(false)
  }

  const discountedPrice = (price: string) => {
    if (!effectivePercent) return null
    const num = parseFloat(price.replace(/[^0-9.]/g, ''))
    return `${p.symbol}${(num * (1 - effectivePercent / 100)).toFixed(2)}`
  }

  const openPortal = async () => {
    setPortalLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/stripe-portal', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` } })
    const data = await res.json()
    setPortalLoading(false)
    if (data.url) window.location.href = data.url
  }

  const planLabel = userPlan === 'top' ? 'Pro' : userPlan === 'mid' ? 'Basic' : 'Free'
  const renderMinuteLimit = userPlan === 'top' ? 3600 : userPlan === 'mid' ? 3600 : 1500
  const usageLimits = {
    ideas: userPlan === 'top' ? 210 : userPlan === 'mid' ? 95 : 24,
    scripts: userPlan === 'top' ? 96 : userPlan === 'mid' ? 20 : 1,
    filming: userPlan === 'top' ? 98 : userPlan === 'mid' ? 50 : 7,
  }

  if (!accountLoaded || !accountCurrency) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />
  }

  if (userPlan && userPlan !== 'free' && subDetails) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)' }}>
        <Sidebar />
        <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
          <nav className="plans-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
            <Link href="/"><ReelezyLogo size={44} /></Link>
            <button onClick={async () => { await supabase.auth.signOut({ scope: 'local' }); window.location.href = '/login' }} style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>Log out</button>
          </nav>
          <div style={{ padding: '32px 48px 64px', maxWidth: 640, margin: '0 auto' }}>
            <h1 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Manage subscription</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32 }}>
              {subDetails.billing_interval === 'yearly' ? 'Billed annually' : 'Billed monthly'}
            </p>

            {/* Plan card */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid rgba(128,128,128,0.15)', borderRadius: 4, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Current plan</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--coral)' }}>{planLabel}</p>
                </div>
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: portalLoading ? 0.6 : 1 }}
                >
                  {portalLoading ? 'Opening…' : 'Manage billing'}
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                To upgrade, downgrade, or cancel your plan, click <strong>Manage billing</strong> to open the Stripe customer portal.
              </p>
            </div>

            {/* Weekly usage */}
            {usage && (
              <div style={{ background: 'var(--card-bg)', border: '1px solid rgba(128,128,128,0.15)', borderRadius: 4, padding: '24px 28px', marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 }}>This week's usage</p>
                {[
                  { label: 'Content ideas', used: usage.ideas, limit: usageLimits.ideas },
                  { label: 'Scripts', used: usage.scripts, limit: usageLimits.scripts },
                  { label: 'Filming instructions', used: usage.filming, limit: usageLimits.filming },
                  { label: 'Render minutes (this month)', used: usage.renderMinutes, limit: renderMinuteLimit },
                ].map(({ label, used, limit }) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--ink)' }}>{label}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label === 'Render minutes (this month)' ? `${String(Math.floor(used/60)).padStart(2,'0')}:${String(Math.floor(used%60)).padStart(2,'0')} / ${String(Math.floor(limit/60)).padStart(2,'0')}:00` : `${used} / ${limit}`}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: 'rgba(128,128,128,0.12)' }}>
                      <div style={{ height: 6, borderRadius: 4, background: 'var(--coral)', width: `${Math.min(100, (used / limit) * 100)}%`, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Storage is a running total, not a weekly allowance */}
            {usage && (() => {
              const limit = libraryLimitBytes(userPlan === 'top' ? 'top' : userPlan === 'mid' ? 'mid' : 'free')
              const pct = Math.min(100, (libraryUsed / limit) * 100)
              return (
                <div style={{ background: 'var(--card-bg)', border: '1px solid rgba(128,128,128,0.15)', borderRadius: 4, padding: '24px 28px', marginBottom: 20 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 }}>Storage</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--ink)' }}>Clip library</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatBytes(libraryUsed)} / {formatBytes(limit)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: 'rgba(128,128,128,0.12)' }}>
                    <div style={{ height: 6, borderRadius: 4, background: pct >= 90 ? '#d92d20' : 'var(--coral)', width: `${libraryUsed > 0 ? Math.max(pct, 1) : 0}%`, transition: 'width 0.4s ease' }} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 0', lineHeight: 1.5 }}>This is a running total of the clips you have saved, so it does not reset each week. <Link href="/dashboard/library" style={{ color: 'var(--coral)', fontWeight: 600 }}>Open your library</Link></p>
                </div>
              )
            })()}

            <div style={{ marginBottom: 20 }}><ReferralCard /></div>

            {/* Switch plan link */}
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
              Want to see other plans?{' '}
              <button onClick={() => setSubDetails(null)} style={{ color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                View pricing
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav className="plans-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <Link href="/"><ReelezyLogo size={44} /></Link>
          {userEmail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="plans-nav-badge" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--sand)', borderRadius: 4, padding: '6px 14px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--coral)', display: 'inline-block' }} />
                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{businessName || userEmail}</span>
                {userPlan && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {userPlan === 'free' ? 'Free Plan' : userPlan === 'top' ? 'Pro' : 'Basic'}</span>}
              </div>
              <button onClick={async () => { await supabase.auth.signOut({ scope: 'local' }); window.location.href = '/login' }} style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>Log out</button>
            </div>
          )}
        </nav>

        <div style={{ padding: '32px 48px 64px', maxWidth: 1000, margin: '0 auto' }}>
          <h1 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 32, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
            Plans built for how often you post
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
            Every plan includes AI content ideas and filming checklists. Pricing scales with how many reels you make each month. All prices are in {currency}.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <span style={{ fontSize: 14, fontWeight: billingInterval === 'monthly' ? 600 : 400, color: billingInterval === 'monthly' ? 'var(--ink)' : 'var(--text-secondary)' }}>Monthly</span>
            <button
              onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'yearly' : 'monthly')}
              style={{
                position: 'relative',
                width: 48,
                height: 26,
                borderRadius: 4,
                border: 'none',
                background: 'var(--coral)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: billingInterval === 'yearly' ? 25 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.15s ease',
                }}
              />
            </button>
            <span style={{ fontSize: 14, fontWeight: billingInterval === 'yearly' ? 600 : 400, color: billingInterval === 'yearly' ? 'var(--ink)' : 'var(--text-secondary)' }}>
              Yearly <span style={{ color: 'var(--coral)', fontWeight: 600 }}>(2 months free)</span>
            </span>
          </div>

          <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 48 }}>
            {pricing.map((tier) => (
              <div
                key={tier.id}
                style={{
                  background: tier.highlight ? '#FFFFFF' : 'var(--sand)',
                  borderRadius: 4,
                  padding: '36px 28px',
                  border: tier.highlight ? '1px solid var(--coral)' : '1px solid var(--line)',
                }}
              >
                <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4, color: tier.highlight ? 'var(--ink)' : 'var(--ink)' }}>
                  {tier.name}
                </h3>
                <p style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", marginBottom: 4, color: tier.highlight ? 'var(--ink)' : 'var(--ink)' }}>
                  {effectivePercent ? (
                    <>
                      <span style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: 24 }}>{billingInterval === 'yearly' ? tier.yearlyPerMonth : tier.monthlyPrice}</span>
                      {' '}
                      {discountedPrice(billingInterval === 'yearly' ? tier.yearlyPerMonth : tier.monthlyPrice)}
                    </>
                  ) : (billingInterval === 'yearly' ? tier.yearlyPerMonth : tier.monthlyPrice)}
                  <span style={{ fontSize: 15, fontWeight: 400 }}>/mo</span>
                </p>
                <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0.3, marginTop: -2, marginBottom: 6, color: tier.highlight ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{currency}</p>
                {billingInterval === 'yearly' && (
                  <p style={{ fontSize: 12, color: tier.highlight ? 'var(--text-secondary)' : 'var(--text-muted)', marginBottom: 8 }}>
                    Billed {tier.yearlyPrice} annually
                  </p>
                )}
                <p style={{ fontSize: 13, color: tier.highlight ? 'var(--text-secondary)' : 'var(--text-secondary)', marginBottom: 24 }}>
                  {tier.desc}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {tier.features.map((f) => {
                    return (
                      <li key={f} style={{ fontSize: 14, color: tier.highlight ? 'var(--ink)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>• {f}</span>
                      </li>
                    )
                  })}
                </ul>
                {tier.id !== 'free' && (
                  <button
                    onClick={() => { trackEvent('checkout_started', { plan: tier.id, currency }); router.push(`/checkout?plan=${tier.id}&interval=${billingInterval}${discountCode ? `&code=${encodeURIComponent(discountCode)}` : ''}`) }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'center',
                      padding: '12px',
                      borderRadius: 4,
                      backgroundColor: tier.highlight ? 'var(--coral)' : 'transparent',
                      border: tier.highlight ? 'none' : '1px solid var(--ink)',
                      color: tier.highlight ? '#fff' : 'var(--ink)',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Get started
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Discount code */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && applyDiscount()}
                placeholder="Have a code?"
                style={{ padding: '10px 14px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", width: 180, outline: 'none', textTransform: 'uppercase' }}
              />
              <button
                onClick={applyDiscount}
                disabled={discountLoading || !discountInput.trim()}
                style={{ padding: '10px 16px', borderRadius: 4, background: 'var(--coral)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: discountLoading || !discountInput.trim() ? 'not-allowed' : 'pointer', opacity: discountLoading || !discountInput.trim() ? 0.6 : 1 }}
              >
                {discountLoading ? 'Checking...' : 'Apply'}
              </button>
            </div>
            {discountError && <p style={{ fontSize: 12, color: 'var(--coral)' }}>{discountError}</p>}
            {discountPercent && <p style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600 }}>{discountPercent}% off applied!</p>}
          </div>

          {userEmail && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 32 }}>
              {referralPercent > 0 ? (
                <p style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600, textAlign: 'center', margin: 0 }}>Friend&apos;s referral applied: {referralPercent}% off your first payment.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      value={refInput}
                      onChange={(e) => setRefInput(cleanReferralInput(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && applyReferral()}
                      placeholder="Friend's referral code"
                      autoComplete="off"
                      aria-label="Referral code"
                      style={{ padding: '10px 14px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 16, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", width: 200, outline: 'none' }}
                    />
                    <button
                      onClick={applyReferral}
                      disabled={refBusy || !refInput.trim()}
                      style={{ padding: '10px 16px', borderRadius: 4, background: 'var(--coral)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: refBusy || !refInput.trim() ? 'not-allowed' : 'pointer', opacity: refBusy || !refInput.trim() ? 0.6 : 1 }}
                    >
                      {refBusy ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>New here? A friend&apos;s code takes {REFERRAL_PERCENT_OFF}% off your first payment, and gives them a free month.</p>
                  {refMsg && <p style={{ fontSize: 12, color: 'var(--coral)', margin: 0 }}>{refMsg}</p>}
                </>
              )}
            </div>
          )}
          {userEmail && <div style={{ maxWidth: 640, margin: '0 auto' }}><ReferralCard /></div>}

          
        </div>
      </div>
    </div>
  )
}
