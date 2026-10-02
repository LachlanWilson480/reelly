'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import CheckoutModal from '@/components/CheckoutModal'

export default function PlansPage() {
  const router = useRouter()
  const [checkoutPlan, setCheckoutPlan] = useState<{ id: string; label: string } | null>(null)
  const [success, setSuccess] = useState(false)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [discountCode, setDiscountCode] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [discountError, setDiscountError] = useState('')
  const [discountLoading, setDiscountLoading] = useState(false)
  const [discountPercent, setDiscountPercent] = useState<number | null>(null)

  const pricing = [
    {
      id: 'mid',
      name: 'Basic',
      monthlyPrice: '$35',
      yearlyPrice: '$350',
      yearlyPerMonth: '$29.17',
      desc: '25 render minutes/month',
      features: ['25 render minutes/month', '5 ideas per batch (95/week max)', '50 filming instructions/week max', '20 scripts per week', 'AI Editor and video uploads', 'Sound library', 'Video scheduler', '5 GB of storage (app only)'],
    },
    {
      id: 'top',
      name: 'Pro',
      monthlyPrice: '$69',
      yearlyPrice: '$690',
      yearlyPerMonth: '$57.50',
      desc: '60 render minutes/month',
      features: ['60 render minutes/month', '7 ideas per batch (210/week max)', '98 filming instructions/week max', '96 scripts per week', 'AI Editor and video uploads', 'Sound library', 'Full video scheduler', 'Higher capacity AI for better content', '10 GB of storage (app only)', 'Suggested video ideas (coming soon)', 'Cloud stock library (coming soon)', 'Dual accounts (coming soon)', 'Competitor analytics (coming soon)'],
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

  const discountedPrice = (price: string) => {
    if (!discountPercent) return null
    const num = parseFloat(price.replace('$', ''))
    return `$${(num * (1 - discountPercent / 100)).toFixed(2)}`
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <Link href="/" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            Reelezy
          </Link>
        </nav>

        <div style={{ padding: '32px 48px 64px', maxWidth: 1000, margin: '0 auto' }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
            Plans built for how often you post
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
            Every plan includes AI content ideas and filming checklists. Pricing scales with how many render minutes you need each week.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <span style={{ fontSize: 14, fontWeight: billingInterval === 'monthly' ? 600 : 400, color: billingInterval === 'monthly' ? 'var(--ink)' : 'var(--text-secondary)' }}>Monthly</span>
            <button
              onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'yearly' : 'monthly')}
              style={{
                position: 'relative',
                width: 48,
                height: 26,
                borderRadius: 999,
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

          {/* Discount code */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && applyDiscount()}
                placeholder="Discount code"
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "'Inter', sans-serif", width: 180, outline: 'none', textTransform: 'uppercase' }}
              />
              <button
                onClick={applyDiscount}
                disabled={discountLoading || !discountInput.trim()}
                style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--coral)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: discountLoading || !discountInput.trim() ? 'not-allowed' : 'pointer', opacity: discountLoading || !discountInput.trim() ? 0.6 : 1 }}
              >
                {discountLoading ? 'Checking...' : 'Apply'}
              </button>
            </div>
            {discountError && <p style={{ fontSize: 12, color: 'var(--coral)' }}>{discountError}</p>}
            {discountPercent && <p style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600 }}>✓ {discountPercent}% off applied!</p>}
          </div>

          {success && (
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '20px 24px', marginBottom: 32, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>Subscription active! You're all set.</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 48 }}>
            {pricing.map((tier) => (
              <div
                key={tier.id}
                style={{
                  background: tier.highlight ? 'linear-gradient(135deg, #26215C, #712B13)' : 'var(--sand)',
                  borderRadius: 20,
                  padding: '36px 28px',
                  border: tier.highlight ? 'none' : '1px solid rgba(128,128,128,0.15)',
                }}
              >
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4, color: tier.highlight ? '#F1EFE8' : 'var(--ink)' }}>
                  {tier.name}
                </h3>
                <p style={{ fontSize: 32, fontWeight: 600, fontFamily: "'Outfit', sans-serif", marginBottom: 4, color: tier.highlight ? '#F1EFE8' : 'var(--ink)' }}>
                  {discountPercent ? (
                    <>
                      <span style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: 24 }}>{billingInterval === 'yearly' ? tier.yearlyPerMonth : tier.monthlyPrice}</span>
                      {' '}
                      {discountedPrice(billingInterval === 'yearly' ? tier.yearlyPerMonth : tier.monthlyPrice)}
                    </>
                  ) : (billingInterval === 'yearly' ? tier.yearlyPerMonth : tier.monthlyPrice)}
                  <span style={{ fontSize: 15, fontWeight: 400 }}>/mo</span>
                </p>
                {billingInterval === 'yearly' && (
                  <p style={{ fontSize: 12, color: tier.highlight ? '#D3D1C7' : 'var(--text-muted)', marginBottom: 8 }}>
                    Billed {tier.yearlyPrice} annually
                  </p>
                )}
                <p style={{ fontSize: 13, color: tier.highlight ? '#D3D1C7' : 'var(--text-secondary)', marginBottom: 24 }}>
                  {tier.desc}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {tier.features.map((f) => {
                    const isComing = f.includes('(coming soon)')
                    const label = isComing ? f.replace(' (coming soon)', '') : f
                    return (
                      <li key={f} style={{ fontSize: 14, color: isComing ? 'rgba(128,128,128,0.5)' : tier.highlight ? '#F1EFE8' : 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span>• {label}</span>
                        {isComing && <span style={{ fontSize: 11, color: 'rgba(128,128,128,0.5)', whiteSpace: 'nowrap' }}>Soon</span>}
                      </li>
                    )
                  })}
                </ul>
                <button
                  onClick={() => setCheckoutPlan({ id: tier.id, label: tier.name })}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'center',
                    padding: '12px',
                    borderRadius: 8,
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
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '28px 32px' }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              What happens if I go over my render minutes?
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Overage renders are billed monthly at a flat fee of $0.50/minute over. You'll always see a confirmation before any render over your monthly limit, and you'll be charged on the 1st of every month.
            </p>
          </div>
        </div>
      </div>

      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan.id}
          planLabel={checkoutPlan.label}
          billingInterval={billingInterval}
          discountCode={discountCode || undefined}
          discountPercent={discountPercent}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => {
            setCheckoutPlan(null)
            setSuccess(true)
            setTimeout(() => router.push('/dashboard'), 1500)
          }}
        />
      )}
    </div>
  )
}
