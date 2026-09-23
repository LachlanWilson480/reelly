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

  const pricing = [
    {
      id: 'basic',
      name: 'Basic',
      price: '$20',
      period: '/mo',
      desc: '10 render minutes/month',
      features: ['10 render minutes/month', '3 ideas generated per batch (24/week max)', '24 filming instructions/week max', 'Access to AI Editor Upload', 'Access to Upload For Any Video', 'Limited access to video scheduler (10 posts/month)', 'Overage fee of $0.50/minute after limit', '1 GB of storage (app only)'],
    },
    {
      id: 'mid',
      name: 'Pro',
      price: '$35',
      period: '/mo',
      desc: '25 render minutes/month',
      features: ['25 render minutes/month', '5 ideas generated per batch (50/week max)', '50 filming instructions/week max', 'Access to Sound library', 'Limited access to Script Generator (10/week)', 'Full access to video scheduler', 'Access to in-depth video analytics', '5 GB of storage (app only)', 'Access to cloud library (stock videos etc)'],
      highlight: true,
    },
    {
      id: 'top',
      name: 'Premium',
      price: '$69',
      period: '/mo',
      desc: '60 render minutes/month',
      features: ['60 render minutes/month', '7 ideas generated per batch (98/week max)', '98 filming instructions/week max', 'Full access to Script Generator', 'Access to suggested video ideas', 'Access to Dual Accounts (app only)', 'Access to Competitor Analytics', 'Access to higher capacity thinking AI', '10 GB of storage (app only)'],
    },
  ]
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
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 48, maxWidth: 500, margin: '0 auto 48px' }}>
            Every plan includes AI content ideas and filming checklists. Pricing scales with how many render minutes you need each week.
          </p>

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
                  {tier.price}<span style={{ fontSize: 15, fontWeight: 400 }}>{tier.period}</span>
                </p>
                <p style={{ fontSize: 13, color: tier.highlight ? '#D3D1C7' : 'var(--text-secondary)', marginBottom: 24 }}>
                  {tier.desc}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {tier.features.map((f) => (
                    <li key={f} style={{ fontSize: 14, color: tier.highlight ? '#F1EFE8' : 'var(--text-secondary)' }}>
                      • {f}
                    </li>
                  ))}
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
