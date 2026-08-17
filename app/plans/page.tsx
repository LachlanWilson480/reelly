'use client'

import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default function PlansPage() {
  const pricing = [
    {
      name: 'Basic',
      price: '$20–$30',
      period: '/mo',
      desc: '~2 render minutes/week',
      features: ['AI content ideas', 'Filming checklists', 'Basic scheduling', 'Instagram & Facebook posting', 'Email support'],
    },
    {
      name: 'Mid',
      price: '$68–$79',
      period: '/mo',
      desc: '~10 render minutes/week',
      features: ['Everything in Basic', 'More renders/week', 'Priority support', 'Content calendar', 'Overage renders available'],
      highlight: true,
    },
    {
      name: 'Top',
      price: '$120–$140',
      period: '/mo',
      desc: '~15 render minutes/week',
      features: ['Everything in Mid', 'Long-form video support', 'Highest render allowance', 'Early access to new features'],
    },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 56 }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <Link href="/" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            Reelly
          </Link>
          <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Sign up
          </Link>
        </nav>

        <div style={{ padding: '32px 48px 64px', maxWidth: 1000, margin: '0 auto' }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
            Plans built for how often you post
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 48, maxWidth: 500, margin: '0 auto 48px' }}>
            Every plan includes AI content ideas and filming checklists. Pricing scales with how many render minutes you need each week.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 48 }}>
            {pricing.map((tier) => (
              <div
                key={tier.name}
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
                      ✓ {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '12px',
                    borderRadius: 8,
                    backgroundColor: tier.highlight ? 'var(--coral)' : 'transparent',
                    border: tier.highlight ? 'none' : '1px solid var(--ink)',
                    color: tier.highlight ? '#fff' : 'var(--ink)',
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '28px 32px' }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              What happens if I go over my render minutes?
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Overage renders are billed monthly with a 50% markup plus a flat fee. You'll always see a confirm-before-charge summary before anything is billed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
