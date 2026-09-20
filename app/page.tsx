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
  const [heroStep, setHeroStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroStep((prev) => (prev + 1) % 3)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

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
    { q: 'Do I need to edit my videos?', a: "No, Reelezy edits your videos for you, automatically following your filming script - captions, trimming, and music all handled. No editing skills or software required." },
    { q: 'What if I don\u2019t post often?', a: 'That\u2019s exactly who Reelezy is built for. Content ideas and filming steps are designed to take minutes, not hours, so posting consistently becomes realistic even with a busy schedule.' },
    { q: 'Is my business data safe?', a: "Your business information is used to personalise your Reelezy experience and generate relevant content. We don't use or sell any of your information. (More details in the ToS)" },
    { q: 'Do I need filming or editing experience?', a: 'No. Reelezy gives you step-by-step filming instructions, and handles editing, captions, and sound automatically.' },
    { q: 'Can I use my own phone to film?', a: 'Yes. Reelezy is built around you filming on your phone.' },
  ]

  const steps = [
    { title: 'Tell us about your business', desc: 'A quick onboarding covers:', points: ['Your services', 'Your location', 'Your brand voice', 'Preferred video styles'] },
    { title: 'Get content ideas', desc: 'Reelezy generates:', points: ['Video ideas and hooks', 'Titles and hashtags', 'Step-by-step filming guides', 'Tailored to your business and local audience'] },
    { title: 'Post in minutes', desc: 'To finish a video:', points: ['Film clips on your phone', 'Upload them to Reelezy', 'Let the platform edit automatically', 'Or fine-tune it yourself in the editor'] },
  ]

  const pricing = [
    { name: 'Basic', price: '$20', period: '/mo', desc: '10 render minutes/month', features: ['AI content ideas', 'Filming checklists', 'Basic scheduling', 'Long-form video support'] },
    { name: 'Pro', price: '$35', period: '/mo', desc: '25 render minutes/month', features: ['Everything in Basic', 'Priority support', 'Content calendar', 'Idea refinement'], highlight: true },
    { name: 'Premium', price: '$69', period: '/mo', desc: '60 render minutes/month', features: ['Everything in Pro', 'Highest render allowance', 'Early access to new features'] },
  ]

  const mockIdeas = [
    { title: 'Behind the chair: 3 quick tips', tag: '#sydneysalon' },
    { title: 'Before & after reveal', tag: '#transformation' },
    { title: 'Booking slots open this week', tag: '#comebookus' },
  ]

  const mockFilmingSteps = [
    '0:00-0:08 - Standing at the counter, introduce yourself',
    '0:08-0:17 - Show the product up close, explain the benefit',
    '0:17-0:25 - End with a smile, invite them to book',
  ]

  const heroSteps = [
    { label: 'Generate ideas' },
    { label: 'Get filming instructions' },
    { label: 'Auto-edited video' },
  ]



  const SECTION_PAD = '120px 64px'
  const CONTAINER_WIDTH = 1080

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav className="site-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 64px' }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600 }}>
            Reelezy
          </span>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <Link href="/login" style={{ color: 'var(--ink)', fontSize: 14, textDecoration: 'none' }}>
              Log in
            </Link>
            <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Sign up
            </Link>
          </div>
        </nav>

        <section className="hero-section" style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 28, margin: '16px 64px 0', padding: '96px 72px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: 64, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 28 }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 52, fontWeight: 600, color: '#F1EFE8', maxWidth: 560, lineHeight: 1.12, letterSpacing: -0.5 }}>
              Content ideas, filmed and posted in minutes.
            </h1>
            <p style={{ fontSize: 17, color: '#D3D1C7', maxWidth: 440, lineHeight: 1.6 }}>
              Reelezy helps businesses turn everyday work into social media content. With AI-powered ideas, simple filming guides, automatic editing, and scheduling all in one place.
            </p>
            <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '15px 30px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
              Get started free
            </Link>
          </div>

          <div style={{ position: "relative", width: 420, height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {heroSteps.map((step, i) => (
                <div
                  key={step.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: i === heroStep ? "var(--coral)" : "rgba(255,255,255,0.08)",
                    transition: "background 0.4s ease",
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#F1EFE8" }}>{i + 1}</span>
                  <span style={{ fontSize: 10, color: "#F1EFE8", whiteSpace: "nowrap" }}>{step.label}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                position: "relative",
                width: 380,
                height: 236,
                boxSizing: "border-box",
                background: "#16151c",
                borderRadius: "12px 12px 3px 3px",
                padding: "14px 14px 28px",
                boxShadow: "0 30px 60px rgba(0,0,0,0.4)",
                border: "4px solid #2a2833",
                transform: "perspective(900px) rotateX(4deg)",
              }}
            >
              <div style={{ background: "#0d0c11", borderRadius: 6, padding: 14, display: "flex", flexDirection: "column", gap: 8, height: "100%", justifyContent: "center", overflow: "hidden" }}>
                {heroStep === 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "heroFadeIn 0.5s ease" }}>
                    {mockIdeas.map((idea) => (
                      <div key={"idea-" + idea.title} style={{ background: "#232129", borderRadius: 8, padding: "9px 11px" }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: "#F1EFE8", lineHeight: 1.3, marginBottom: 3 }}>{idea.title}</p>
                        <p style={{ fontSize: 9, color: "var(--coral)" }}>{idea.tag}</p>
                      </div>
                    ))}
                  </div>
                )}
                {heroStep === 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, animation: "heroFadeIn 0.5s ease" }}>
                    {mockFilmingSteps.map((step) => (
                      <div key={step} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: "var(--coral)", fontSize: 11, flexShrink: 0 }}>&#10003;</span>
                        <p style={{ fontSize: 10, color: "#F1EFE8", lineHeight: 1.4 }}>{step}</p>
                      </div>
                    ))}
                  </div>
                )}
                {heroStep === 2 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, animation: "heroFadeIn 0.5s ease" }}>
                    <div style={{ width: 90, height: 156, background: "#232129", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      <div style={{ width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "16px solid #F1EFE8" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#F1EFE8", marginBottom: 4 }}>Render complete</p>
                      <p style={{ fontSize: 10, color: "var(--coral)" }}>Captions + music added</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ position: "relative", width: 416, height: 14, background: "#2a2833", borderRadius: "0 0 8px 8px", marginLeft: "auto", marginRight: "auto" }} />
            <div style={{ position: "relative", width: 52, height: 4, background: "#3a3743", borderRadius: 3, marginTop: -9 }} />
          </div>

          <style>{`
            @keyframes heroFadeIn {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </section>

        <section style={{ padding: '48px 64px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
            Built for creators, freelancers, and small businesses  -  anywhere
          </p>
        </section>

        <section style={{ padding: '112px 64px 0' }}>
          <div style={{ maxWidth: 1320, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 600, marginBottom: 56, textAlign: 'center', letterSpacing: -0.3 }}>
              How it works
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
              {steps.map((s, i) => (
                <div key={s.title} style={{ position: 'relative', padding: '32px 28px', background: 'var(--sand)', borderRadius: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, marginBottom: 18 }}>
                    {i + 1}
                  </div>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 10 }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>{s.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {s.points.map((pt) => (
                      <li key={pt} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: 14, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--coral)' }}>•</span>{pt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '112px 64px 0' }}>
          <div style={{ maxWidth: 1320, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 600, marginBottom: 56, textAlign: 'center', letterSpacing: -0.3 }}>
              Everything you need to post consistently
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
              {[
                { title: 'AI content ideas', desc: 'Get:', points: ['Hyperlocal video ideas', 'Titles and hashtags', 'Step-by-step filming checklists'] },
                { title: 'Automatic editing', desc: 'Reelezy handles:', points: ['Stitching your clips together', 'Captions', 'Pause removal', 'Sound'] },
                { title: 'Scheduling built in', desc: 'Stay consistent by:', points: ['Planning content ahead of time', 'Keeping your accounts active', 'Never having to remember to post'] },
              ].map((f) => (
                <div key={f.title} style={{ background: 'var(--sand)', borderRadius: 16, padding: '32px 28px' }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 10 }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>{f.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {f.points.map((pt) => (
                      <li key={pt} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: 14, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--coral)' }}>•</span>{pt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '112px 64px 0' }}>
          <div style={{ maxWidth: 1320, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 600, marginBottom: 12, textAlign: 'center', letterSpacing: -0.3 }}>
              Simple pricing
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 48 }}>
              Priced by render minutes per week. Full details at checkout.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
              {pricing.map((tier) => (
                <div
                  key={tier.name}
                  style={{
                    background: tier.highlight ? 'linear-gradient(135deg, #26215C, #712B13)' : 'var(--sand)',
                    borderRadius: 16,
                    padding: '36px 28px',
                    border: tier.highlight ? 'none' : '1px solid rgba(128,128,128,0.15)',
                  }}
                >
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 4, color: tier.highlight ? '#F1EFE8' : 'var(--ink)' }}>
                    {tier.name}
                  </h3>
                  <p style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Outfit', sans-serif", marginBottom: 4, color: tier.highlight ? '#F1EFE8' : 'var(--ink)' }}>
                    {tier.price}<span style={{ fontSize: 14, fontWeight: 400 }}>{tier.period}</span>
                  </p>
                  <p style={{ fontSize: 13, color: tier.highlight ? '#D3D1C7' : 'var(--text-secondary)', marginBottom: 22 }}>
                    {tier.desc}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {tier.features.map((f) => (
                      <li key={f} style={{ fontSize: 13, color: tier.highlight ? '#F1EFE8' : 'var(--text-secondary)' }}>
                        • {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <Link href="/plans" style={{ fontSize: 14, color: 'var(--coral)', fontWeight: 600, textDecoration: 'none' }}>
                See full plan details →
              </Link>
            </div>
          </div>
        </section>

        <section style={{ padding: '112px 64px 0' }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 600, marginBottom: 40, textAlign: 'center', letterSpacing: -0.3 }}>
              Questions? Answered.
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {faqs.map((f, i) => (
                <div key={f.q} style={{ background: 'var(--sand)', borderRadius: 12, overflow: 'hidden' }}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: '100%', textAlign: 'left', padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}
                  >
                    {f.q}
                    <span style={{ fontSize: 18, color: 'var(--coral)' }}>{openFaq === i ? '\u2212' : '+'}</span>
                  </button>
                  {openFaq === i && (
                    <p style={{ padding: '0 22px 20px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                      {f.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 28, margin: '112px 64px 0', padding: '64px 56px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 600, color: '#F1EFE8', marginBottom: 14, letterSpacing: -0.3 }}>
            Ready to post consistently?
          </h2>
          <p style={{ fontSize: 15, color: '#D3D1C7', marginBottom: 28 }}>
            Start free - no credit card required.
          </p>
          <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '15px 34px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
            Get started free
          </Link>
        </section>

        <footer style={{ padding: '64px', borderTop: '1px solid rgba(128,128,128,0.15)', marginTop: 64 }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32 }}>
            <div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 600 }}>Reelezy</span>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10, maxWidth: 240, lineHeight: 1.6 }}>
                AI-powered content for anyone creating on social media.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 56 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Product</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <Link href="/plans" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Plans</Link>
                  <Link href="/signup" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Sign up</Link>
                  <Link href="/login" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Log in</Link>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Company</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sydney, Australia</span>
                  <Link href="/terms" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms of Service</Link>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 48 }}>
            \u00a9 2026 Reelezy. Built in Sydney.
          </p>
        </footer>
      </div>
    </div>
  )
}
