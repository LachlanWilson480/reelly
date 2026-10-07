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
    { q: 'Do I need to edit my videos?', a: 'No. Reelezy edits your videos automatically based on your filming script. Captions, trimming, and music are all handled. No editing skills or software required.' },
    { q: "What if I don't post often?", a: "That's exactly who Reelezy is built for. Content ideas and filming steps are designed to take minutes, not hours, so posting consistently becomes realistic even with a full schedule." },
    { q: 'Is my business data safe?', a: 'Your business information is used only to personalise your experience and generate relevant content. We never sell your data. Full details in the Terms of Service.' },
    { q: 'Do I need filming or editing experience?', a: 'No. Reelezy gives you step-by-step filming instructions and handles all editing, captions, and sound automatically.' },
    { q: 'Can I use my own phone to film?', a: 'Yes. Reelezy is built around filming on your phone.' },
  ]

  const steps = [
    { title: 'Tell us about your business', desc: 'A quick onboarding covers:', points: ['Your services', 'Your location', 'Your brand voice', 'Preferred video styles'] },
    { title: 'Get content ideas', desc: 'Reelezy generates:', points: ['Video ideas and hooks', 'Titles and hashtags', 'Step-by-step filming guides', 'Tailored to your business and local audience'] },
    { title: 'Post in minutes', desc: 'To finish a video:', points: ['Film clips on your phone', 'Upload them to Reelezy', 'Let the platform edit automatically', 'Or fine-tune it yourself in the editor'] },
  ]

  const pricing = [
    { name: 'Basic', price: '$35', period: '/mo', desc: '25 render minutes per month', features: ['5 ideas per batch, 98 per week', 'Full video scheduler', 'Sound library and video analytics', 'Limited Script Generator access'], highlight: false },
    { name: 'Pro', price: '$69', period: '/mo', desc: '60 render minutes per month', features: ['Everything in Basic', '7 ideas per batch, 210 per week', 'Full Script Generator access', 'Competitor analytics and dual accounts'], highlight: true },
  ]

  const mockIdeas = [
    { title: 'Behind the chair: 3 quick tips', tag: '#sydneysalon' },
    { title: 'Before and after reveal', tag: '#transformation' },
    { title: 'Booking slots open this week', tag: '#comebookus' },
  ]

  const mockFilmingSteps = [
    '0:00-0:08 — Standing at the counter, introduce yourself',
    '0:08-0:17 — Show the product up close, explain the benefit',
    '0:17-0:25 — End with a smile, invite them to book',
  ]

  const heroSteps = [
    { label: 'Generate ideas' },
    { label: 'Filming guide' },
    { label: 'Auto-edited video' },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 0 }}>

        <nav className="site-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 64px' }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: -0.2 }}>Reelezy</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link href="/login" style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Log in</Link>
            <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Sign up</Link>
          </div>
        </nav>

        <section className="hero-section" style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 24, margin: '8px 64px 0', padding: '80px 64px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: 64, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24 }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 50, fontWeight: 600, color: '#F1EFE8', maxWidth: 520, lineHeight: 1.1, letterSpacing: -0.5, margin: 0 }}>
              Content ideas, filmed and posted in minutes.
            </h1>
            <p style={{ fontSize: 16, color: '#B8B5AE', maxWidth: 420, lineHeight: 1.65, margin: 0 }}>
              Reelezy helps personal-service businesses turn everyday work into social media content. AI-powered ideas, simple filming guides, automatic editing, and scheduling in one place.
            </p>
            <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '13px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
              Get started free
            </Link>
          </div>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {heroSteps.map((step, i) => (
                <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, backgroundColor: i === heroStep ? 'var(--coral)' : 'rgba(255,255,255,0.08)', transition: 'background-color 0.35s ease' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#F1EFE8' }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: '#F1EFE8', whiteSpace: 'nowrap' }}>{step.label}</span>
                </div>
              ))}
            </div>
            <div style={{ width: 380, height: 236, boxSizing: 'border-box', background: '#16151c', borderRadius: '12px 12px 3px 3px', padding: '14px 14px 28px', boxShadow: '0 24px 48px rgba(0,0,0,0.45)', border: '4px solid #2a2833', transform: 'perspective(900px) rotateX(4deg)' }}>
              <div style={{ background: '#0d0c11', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', justifyContent: 'center', overflow: 'hidden' }}>
                {heroStep === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'heroFadeIn 0.4s ease' }}>
                    {mockIdeas.map((idea) => (
                      <div key={idea.title} style={{ background: '#232129', borderRadius: 8, padding: '9px 11px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#F1EFE8', lineHeight: 1.3, marginBottom: 3 }}>{idea.title}</p>
                        <p style={{ fontSize: 12, color: 'var(--coral)', margin: 0 }}>{idea.tag}</p>
                      </div>
                    ))}
                  </div>
                )}
                {heroStep === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, animation: 'heroFadeIn 0.4s ease' }}>
                    {mockFilmingSteps.map((step) => (
                      <div key={step} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--coral)', fontSize: 14, flexShrink: 0, marginTop: 1 }}>&#10003;</span>
                        <p style={{ fontSize: 13, color: '#F1EFE8', lineHeight: 1.45, margin: 0 }}>{step}</p>
                      </div>
                    ))}
                  </div>
                )}
                {heroStep === 2 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, animation: 'heroFadeIn 0.4s ease' }}>
                    <div style={{ width: 90, height: 156, background: '#232129', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '16px solid #F1EFE8' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#F1EFE8', marginBottom: 4 }}>Render complete</p>
                      <p style={{ fontSize: 13, color: 'var(--coral)', margin: 0 }}>Captions and music added</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ width: 416, height: 14, background: '#2a2833', borderRadius: '0 0 8px 8px' }} />
            <div style={{ width: 52, height: 4, background: '#3a3743', borderRadius: 3, marginTop: -10 }} />
          </div>
          <style>{`@keyframes heroFadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </section>

        <section style={{ padding: '48px 64px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', fontWeight: 600 }}>Made for small businesses</p>
        </section>

        <section style={{ padding: '96px 64px 0' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 600, marginBottom: 12, textAlign: 'center', letterSpacing: -0.3 }}>How it works</h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 48, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>From setup to your first posted video in under an hour.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {steps.map((s, i) => (
                <div key={s.title} style={{ padding: '28px 24px', background: 'var(--sand)', borderRadius: 14, border: '1px solid rgba(128,128,128,0.1)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{i + 1}</div>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>{s.title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>{s.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {s.points.map((pt) => (
                      <li key={pt} style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: 14, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--coral)' }}>•</span>{pt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '96px 64px 0' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 600, marginBottom: 12, textAlign: 'center', letterSpacing: -0.3 }}>Everything you need to post consistently</h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 48, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>Built so you can go from idea to scheduled post without opening a single other app.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {[
                { title: 'AI content ideas', desc: 'Get:', points: ['Hyperlocal video ideas', 'Titles and hashtags', 'Step-by-step filming checklists'] },
                { title: 'Automatic editing', desc: 'Reelezy handles:', points: ['Stitching your clips together', 'Captions', 'Pause removal', 'Sound'] },
                { title: 'Scheduling', desc: 'Stay consistent by:', points: ['Planning content ahead of time', 'Keeping your accounts active', 'Not having to remember to post'] },
              ].map((f) => (
                <div key={f.title} style={{ background: 'var(--sand)', borderRadius: 14, padding: '28px 24px', border: '1px solid rgba(128,128,128,0.1)' }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>{f.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {f.points.map((pt) => (
                      <li key={pt} style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: 14, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--coral)' }}>•</span>{pt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '96px 64px 0' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 600, marginBottom: 8, textAlign: 'center', letterSpacing: -0.3 }}>Pricing</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 44 }}>Priced by render minutes per month. Full details at checkout.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, maxWidth: 640, margin: '0 auto' }}>
              {pricing.map((tier) => (
                <div key={tier.name} style={{ background: tier.highlight ? 'linear-gradient(135deg, #26215C, #712B13)' : 'var(--sand)', borderRadius: 14, padding: '32px 24px', border: tier.highlight ? 'none' : '1px solid rgba(128,128,128,0.15)' }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, color: tier.highlight ? '#F1EFE8' : 'var(--ink)', margin: '0 0 4px' }}>{tier.name}</h3>
                  <p style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Outfit', sans-serif", color: tier.highlight ? '#F1EFE8' : 'var(--ink)', margin: '0 0 4px' }}>{tier.price}<span style={{ fontSize: 14, fontWeight: 400 }}>{tier.period}</span></p>
                  <p style={{ fontSize: 14, color: tier.highlight ? '#B8B5AE' : 'var(--text-secondary)', marginBottom: 20 }}>{tier.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {tier.features.map((f) => (
                      <li key={f} style={{ fontSize: 14, color: tier.highlight ? '#D3D1C7' : 'var(--text-secondary)', paddingLeft: 14, position: 'relative', lineHeight: 1.5 }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--coral)' }}>•</span>{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" style={{ display: 'block', textAlign: 'center', backgroundColor: tier.highlight ? 'var(--coral)' : 'transparent', color: tier.highlight ? '#fff' : 'var(--coral)', border: tier.highlight ? 'none' : '1.5px solid var(--coral)', padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Get started</Link>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Link href="/plans" style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600, textDecoration: 'none' }}>See full plan details</Link>
            </div>
          </div>
        </section>

        <section style={{ padding: '96px 64px 0' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 600, marginBottom: 36, textAlign: 'center', letterSpacing: -0.3 }}>Common questions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {faqs.map((f, i) => (
                <div key={f.q} style={{ background: 'var(--sand)', borderRadius: 10, border: '1px solid rgba(128,128,128,0.1)', overflow: 'hidden' }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', textAlign: 'left', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, color: 'var(--ink)', gap: 12 }}>
                    <span>{f.q}</span>
                    <span style={{ fontSize: 18, color: 'var(--coral)', flexShrink: 0, lineHeight: 1, fontWeight: 400 }}>{openFaq === i ? '−' : '+'}</span>
                  </button>
                  {openFaq === i && <p style={{ padding: '0 20px 18px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{f.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 24, margin: '96px 64px 0', padding: '60px 56px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 600, color: '#F1EFE8', marginBottom: 10, letterSpacing: -0.3 }}>Start posting consistently</h2>
          <p style={{ fontSize: 15, color: '#B8B5AE', marginBottom: 28 }}>No credit card required.</p>
          <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '13px 32px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>Get started free</Link>
        </section>

        <footer style={{ padding: '56px 64px 48px', borderTop: '1px solid rgba(128,128,128,0.12)', marginTop: 64 }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32 }}>
            <div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600 }}>Reelezy</span>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, maxWidth: 220, lineHeight: 1.6 }}>AI-powered social content for personal-service businesses.</p>
            </div>
            <div style={{ display: 'flex', gap: 48 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Product</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <Link href="/plans" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Plans</Link>
                  <Link href="/signup" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Sign up</Link>
                  <Link href="/login" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Log in</Link>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Company</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <Link href="/terms" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms of Service</Link>
                  <Link href="/privacy" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy Policy</Link>
                  <a href="mailto:hello@reelezy.com" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Contact</a>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 48 }}>© 2026 Reelezy. Built in Sydney.</p>
        </footer>

      </div>
    </div>
  )
}
