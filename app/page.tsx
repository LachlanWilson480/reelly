'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const check = async () => {
      if (searchParams.get('stay')) {
        setChecking(false)
        return
      }

      const { data: sessionData } = await supabase.auth.getUser()
      const user = sessionData.user

      if (!user) {
        setChecking(false)
        return
      }

      const { data: profile } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    }
    check()
  }, [router, searchParams])

  if (checking) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />
  }

  const faqs = [
    { q: 'Does this replace my videographer?', a: "Not necessarily. Reelly helps you plan, film, and edit content yourself in minutes. Many businesses use it for everyday posts and still hire a videographer for bigger campaigns." },
    { q: 'What if I don\u2019t post often?', a: 'That\u2019s exactly who Reelly is built for. Content ideas and filming steps are designed to take minutes, not hours, so posting consistently becomes realistic even with a busy schedule.' },
    { q: 'Is my business data safe?', a: 'Yes. Your business details are stored securely and only used to generate content tailored to you \u2014 never shared or sold.' },
    { q: 'Do I need filming or editing experience?', a: 'No. Reelly gives you step-by-step filming instructions, and handles editing, captions, and sound automatically.' },
    { q: 'Can I use my own phone to film?', a: 'Yes \u2014 most businesses film everything on their phone. Reelly is built around that.' },
  ]

  const steps = [
    { title: 'Tell us about your business', desc: 'A quick onboarding covering your services, tone, and audience \u2014 so every idea is built for you, not generic.' },
    { title: 'Get content ideas', desc: 'Hyperlocal video ideas, titles, hashtags, and step-by-step filming checklists, ready when you are.' },
    { title: 'Post in minutes', desc: 'Upload your clips, get them edited automatically, and schedule across your platforms \u2014 all from one place.' },
  ]

  const pricing = [
    { name: 'Basic', price: '$20\u2013$30', period: '/mo', desc: '~2 render minutes/week', features: ['AI content ideas', 'Filming checklists', 'Basic scheduling'] },
    { name: 'Mid', price: '$68\u2013$79', period: '/mo', desc: '~10 render minutes/week', features: ['Everything in Basic', 'More renders/week', 'Priority support'], highlight: true },
    { name: 'Top', price: '$120\u2013$140', period: '/mo', desc: '~15 render minutes/week', features: ['Everything in Mid', 'Long-form video support', 'Highest render allowance'] },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 56 }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600 }}>
            Reelly
          </span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link href="/login" style={{ color: 'var(--ink)', fontSize: 14, textDecoration: 'none' }}>
              Log in
            </Link>
            <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Sign up
            </Link>
          </div>
        </nav>

        <section style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 24, margin: '24px 48px', padding: '80px 48px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20 }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 44, fontWeight: 600, color: '#F1EFE8', maxWidth: 600, lineHeight: 1.2 }}>
            Content ideas, filmed and posted in minutes.
          </h1>
          <p style={{ fontSize: 17, color: '#D3D1C7', maxWidth: 480 }}>
            Reelly gives Sydney salons, studios, and small businesses AI-powered content ideas, filming steps, and scheduling \u2014 built for your suburb, your audience, your brand.
          </p>
          <div style={{ width: '100%', maxWidth: 600, height: 220, borderRadius: 12, background: 'rgba(127,119,221,0.2)', border: '1px dashed rgba(127,119,221,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 13, color: '#AFA9EC' }}>3D animation coming soon</span>
          </div>
          <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '14px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none', marginTop: 8 }}>
            Get started free
          </Link>
        </section>

        <section style={{ padding: '24px 48px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Built for salons, tattoo studios & wedding vendors across Sydney
          </p>
        </section>

        <section style={{ padding: '48px 48px', maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 40, textAlign: 'center' }}>
            How it works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {steps.map((s, i) => (
              <div key={s.title} style={{ position: 'relative', padding: '28px 24px', background: 'var(--sand)', borderRadius: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                  {i + 1}
                </div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '48px 48px', maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 40, textAlign: 'center' }}>
            Everything you need to post consistently
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {[
              { title: 'AI content ideas', desc: 'Hyperlocal video ideas, titles, hashtags, and step-by-step filming checklists built for your business.' },
              { title: 'Automatic editing', desc: 'Upload your clips and get them stitched together with captions, pause removal, and sound.' },
              { title: 'Scheduling built in', desc: 'Plan and post across Instagram, Facebook, and soon TikTok \u2014 all from one place.' },
            ].map((f) => (
              <div key={f.title} style={{ background: 'var(--sand)', borderRadius: 16, padding: '28px 24px' }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '48px 48px', maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
            Simple pricing
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 40 }}>
            Priced by render minutes per week. Full details at checkout.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {pricing.map((tier) => (
              <div
                key={tier.name}
                style={{
                  background: tier.highlight ? 'linear-gradient(135deg, #26215C, #712B13)' : 'var(--sand)',
                  borderRadius: 16,
                  padding: '32px 24px',
                  border: tier.highlight ? 'none' : '1px solid rgba(128,128,128,0.15)',
                }}
              >
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 4, color: tier.highlight ? '#F1EFE8' : 'var(--ink)' }}>
                  {tier.name}
                </h3>
                <p style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Outfit', sans-serif", marginBottom: 4, color: tier.highlight ? '#F1EFE8' : 'var(--ink)' }}>
                  {tier.price}<span style={{ fontSize: 14, fontWeight: 400 }}>{tier.period}</span>
                </p>
                <p style={{ fontSize: 13, color: tier.highlight ? '#D3D1C7' : 'var(--text-secondary)', marginBottom: 20 }}>
                  {tier.desc}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tier.features.map((f) => (
                    <li key={f} style={{ fontSize: 13, color: tier.highlight ? '#F1EFE8' : 'var(--text-secondary)' }}>
                      ✓ {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link href="/plans" style={{ fontSize: 14, color: 'var(--coral)', fontWeight: 600, textDecoration: 'none' }}>
              See full plan details →
            </Link>
          </div>
        </section>

        <section style={{ padding: '48px 48px', maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 32, textAlign: 'center' }}>
            Questions? Answered.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map((f, i) => (
              <div key={f.q} style={{ background: 'var(--sand)', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', textAlign: 'left', padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}
                >
                  {f.q}
                  <span style={{ fontSize: 18, color: 'var(--coral)' }}>{openFaq === i ? '\u2212' : '+'}</span>
                </button>
                {openFaq === i && (
                  <p style={{ padding: '0 20px 18px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {f.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 24, margin: '24px 48px', padding: '56px 48px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 600, color: '#F1EFE8', marginBottom: 12 }}>
            Ready to post consistently?
          </h2>
          <p style={{ fontSize: 15, color: '#D3D1C7', marginBottom: 24 }}>
            Start free \u2014 no credit card required.
          </p>
          <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '14px 32px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
            Get started free
          </Link>
        </section>

        <footer style={{ padding: '48px', borderTop: '1px solid rgba(128,128,128,0.15)', marginTop: 24 }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 600 }}>Reelly</span>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, maxWidth: 240 }}>
                AI-powered content for Sydney's personal-service businesses.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 48 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Product</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Link href="/plans" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Plans</Link>
                  <Link href="/signup" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Sign up</Link>
                  <Link href="/login" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Log in</Link>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Company</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sydney, Australia</span>
                  <Link href="/terms" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms of Service</Link>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
            © 2026 Reelly. Built in Sydney.
          </p>
        </footer>
      </div>
    </div>
  )
}
