'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase, consumeRecoveryFlag } from '@/lib/supabase'
import { ReelezyLogo } from '@/components/ReelezyLogo'
import { CURRENCY_PRICES, PLAN_COPY } from '@/lib/pricing'
import { useCurrency } from '@/lib/useCurrency'

export default function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [checking, setChecking] = useState(true)
  const [heroStep, setHeroStep] = useState(0)
  const currency = useCurrency()

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroStep((prev) => (prev + 1) % 3)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const check = async () => {
      if (consumeRecoveryFlag()) {
        router.replace('/reset-password')
        return
      }
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
    { q: 'Is my business data safe?', a: 'Your business information is used only to personalise your experience and generate relevant content. We never sell your data. Full details in the Privacy Policy.' },
    { q: 'Do I need filming or editing experience?', a: 'No. Reelezy gives you step-by-step filming instructions and handles all editing, captions, and sound automatically.' },
    { q: 'Can I use my own phone to film?', a: 'Yes. Reelezy is built around filming on your phone.' },
  ]

  const steps = [
    { title: 'Tell us about your business', desc: 'A quick onboarding covers:', points: ['Your services', 'Your location', 'Your brand voice', 'Preferred video styles'] },
    { title: 'Get content ideas', desc: 'Reelezy generates:', points: ['Video ideas and hooks', 'Titles and hashtags', 'Step-by-step filming guides', 'Tailored to your business and local audience'] },
    { title: 'Post in minutes', desc: 'To finish a video:', points: ['Film clips on your phone', 'Upload them to Reelezy', 'Let the platform edit automatically', 'Or fine-tune it yourself in the editor'] },
  ]

  const cp = CURRENCY_PRICES[currency ?? 'AUD']
  const pricing = [
    { name: PLAN_COPY.free.name, price: `${cp.symbol}0`, period: '', note: '', desc: PLAN_COPY.free.desc, features: PLAN_COPY.free.features, highlight: false },
    { name: PLAN_COPY.basic.name, price: `${cp.symbol}${cp.basic}`, period: '/mo', note: `or ${cp.symbol}${cp.basicYearly} a year (2 months free)`, desc: PLAN_COPY.basic.desc, features: PLAN_COPY.basic.features, highlight: false },
    { name: PLAN_COPY.pro.name, price: `${cp.symbol}${cp.pro}`, period: '/mo', note: `or ${cp.symbol}${cp.proYearly} a year (2 months free)`, desc: PLAN_COPY.pro.desc, features: PLAN_COPY.pro.features, highlight: true },
  ]

  const mockIdeas = [
    { title: 'Behind the scenes: how it is made', tag: '#smallbusiness' },
    { title: 'Before and after reveal', tag: '#transformation' },
    { title: 'Come and see us this weekend', tag: '#shoplocal' },
  ]

  const mockFilmingSteps = [
    "Hi, I'm Mia, and I'm about to fix a fringe.",
    "Here's the mistake I see every week.",
    'Book in and I will show you the fix.',
  ]

  const phoneLines = [
    "Hi, I'm Mia, and I'm about to fix a fringe.",
    "Here's the mistake I see every week.",
    'Book in and I will show you the fix.',
  ]

  const heroSteps = [
    { label: 'Generate ideas' },
    { label: 'Film with a script' },
    { label: 'Auto-edited video' },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Poppins', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 0 }}>

        <nav className="site-nav landing-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
          <ReelezyLogo size={36} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/login" style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}>Log in</Link>
            <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Sign up</Link>
          </div>
        </nav>

        <section className="hero-section" style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(640px 460px at 76% 52%, rgba(255,150,110,0.20), transparent 68%), linear-gradient(135deg, #26215C, #712B13)', borderRadius: 28, margin: '8px 64px 0', padding: '88px 72px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 48, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 28 }}>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 58, fontWeight: 700, color: '#F7F4EC', maxWidth: 560, lineHeight: 1.04, letterSpacing: -1.6, margin: 0 }}>
              Content ideas, filmed and posted in minutes.
            </h1>
            <p className="hero-subtext" style={{ fontSize: 18, color: '#CFCBE0', maxWidth: 470, lineHeight: 1.65, margin: 0 }}>
              Reelezy gives small businesses video ideas, a script to read off your screen while you film, and automatic editing with captions and music. No editing skills needed.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '15px 32px', borderRadius: 12, fontSize: 16, fontWeight: 600, textDecoration: 'none', display: 'inline-block', boxShadow: '0 10px 28px -12px rgba(255,106,77,0.9)' }}>
                Get started free
              </Link>
              <a href="#how" style={{ color: '#F7F4EC', padding: '14px 26px', borderRadius: 12, fontSize: 16, fontWeight: 600, textDecoration: 'none', display: 'inline-block', border: '1.5px solid rgba(255,255,255,0.3)' }}>
                See how it works
              </a>
            </div>
            <p style={{ fontSize: 13.5, color: '#CFCBE0', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ecf9b', display: 'inline-block' }} />
              No credit card required.
            </p>
          </div>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, padding: 4, borderRadius: 999, background: 'rgba(8,6,30,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {heroSteps.map((step, i) => (
                <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, backgroundColor: i === heroStep ? 'var(--coral)' : 'transparent', transition: 'background-color 0.35s ease' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#F1EFE8' }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: '#F1EFE8', whiteSpace: 'nowrap' }}>{step.label}</span>
                </div>
              ))}
            </div>
            <div className="hp-stage" aria-hidden="true">
              <div className="hp-phone hp-back">
                <div className="hp-notch" />
                <div className="hp-screen">
                  <div className="hp-s hp-film" style={{ animation: 'none' }}>
                    <div className="hp-subject hp-dim"><span className="hp-head" /><span className="hp-shoulders" /></div>
                    <div className="hp-caption">Booking slots <b>open</b> this week</div>
                  </div>
                </div>
              </div>
              <div className="hp-phone hp-front">
                <div className="hp-notch" />
                <div className="hp-screen">
                  {heroStep === 0 && (
                    <div className="hp-s hp-ideas" key="ideas">
                      <p className="hp-title">Ideas for this week</p>
                      {mockIdeas.map((idea, i) => (
                        <div key={idea.title} className="hp-idea" style={{ animationDelay: `${i * 90}ms` }}>
                          <div>
                            <p className="hp-idea-t">{idea.title}</p>
                            <p className="hp-idea-h">{idea.tag}</p>
                          </div>
                          <span className={i === 0 ? 'hp-star hp-star-on' : 'hp-star'}>★</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {heroStep === 1 && (
                    <div className="hp-s hp-film" key="film">
                      <div className="hp-subject"><span className="hp-head" /><span className="hp-shoulders" /></div>
                      <div className="hp-prompter">
                        {phoneLines.map((line, i) => (
                          <p key={line} className={i === 1 ? 'hp-line hp-line-on' : 'hp-line'}>{line}</p>
                        ))}
                      </div>
                      <div className="hp-rec"><span className="hp-rec-dot" />REC</div>
                      <div className="hp-clips">Clip 2 of 3</div>
                      <div className="hp-shutter"><span /></div>
                    </div>
                  )}
                  {heroStep === 2 && (
                    <div className="hp-s hp-film" key="edit">
                      <div className="hp-subject hp-dim"><span className="hp-head" /><span className="hp-shoulders" /></div>
                      <div className="hp-done">Render complete</div>
                      <div className="hp-caption">Booking slots <b>open</b> this week</div>
                      <div className="hp-chips"><span>Captions</span><span>Music</span><span>Pauses cut</span></div>
                      <div className="hp-progress"><span /></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <style>{`@keyframes heroFadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
.hp-phone { position: absolute; left: 50%; top: 0; width: 262px; height: 530px; border-radius: 40px; background: #0b0a10; padding: 8px; box-shadow: 0 0 0 1.5px #4a4483, 0 28px 56px rgba(8,6,30,.5); }
.hp-stage { position: relative; width: 520px; max-width: 100%; height: 590px; }
.hp-front { z-index: 2; margin-left: -131px; transform: translateX(62px) scale(1.1); transform-origin: top center; }
.hp-back { z-index: 1; margin-left: -131px; transform: translate(-122px, 34px) rotate(-7deg) scale(0.96); transform-origin: top center; opacity: .5; box-shadow: 0 0 0 1.5px #3b3568, 0 20px 40px rgba(8,6,30,.4); }
.hp-notch { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); width: 76px; height: 20px; border-radius: 11px; background: #0b0a10; z-index: 6; }
.hp-screen { position: relative; width: 100%; height: 100%; border-radius: 32px; overflow: hidden; background: #17151f; }
.hp-s { position: absolute; inset: 0; animation: hpIn .45s ease; }
@keyframes hpIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes hpUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes hpPulse { 50% { opacity: .25; } }
@keyframes hpBar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.hp-ideas { padding: 54px 14px 14px; display: flex; flex-direction: column; gap: 9px; }
.hp-title { font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 18px; margin: 0 0 4px; color: #F1EFE8; }
.hp-idea { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #26232f; border-radius: 13px; padding: 12px; animation: hpUp .45s ease both; }
.hp-idea-t { font-size: 13px; font-weight: 600; line-height: 1.3; color: #F1EFE8; margin: 0; }
.hp-idea-h { font-size: 11px; margin: 4px 0 0; color: #ff8a63; }
.hp-star { font-size: 16px; color: #4b4757; }
.hp-star-on { color: #f2b83c; }
.hp-film { background: #2c2766; }
.hp-subject { position: absolute; inset: 0; }
.hp-head { position: absolute; left: 50%; top: 40%; width: 86px; height: 86px; margin-left: -43px; border-radius: 50%; background: #5a4f94; }
.hp-shoulders { position: absolute; left: 50%; top: 60%; width: 206px; height: 320px; margin-left: -103px; border-radius: 103px 103px 0 0; background: #463d7d; }
.hp-dim .hp-head { background: #4d4484; }
.hp-dim .hp-shoulders { background: #3b3470; }
.hp-prompter { position: absolute; top: 0; left: 0; right: 0; padding: 44px 16px 12px; background: rgba(8,6,24,.62); display: flex; flex-direction: column; gap: 5px; }
.hp-line { font-size: 12.5px; line-height: 1.35; color: rgba(241,239,232,.45); margin: 0; }
.hp-line-on { color: #fff; font-weight: 700; font-size: 14.5px; }
.hp-rec { position: absolute; left: 12px; bottom: 88px; display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; letter-spacing: .06em; color: #fff; background: rgba(8,6,24,.6); padding: 4px 9px; border-radius: 20px; }
.hp-rec-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff3b30; animation: hpPulse 1.1s ease-in-out infinite; }
.hp-clips { position: absolute; right: 12px; bottom: 88px; font-size: 10px; font-weight: 700; color: #fff; background: rgba(8,6,24,.6); padding: 4px 9px; border-radius: 20px; }
.hp-shutter { position: absolute; left: 50%; bottom: 20px; margin-left: -26px; width: 52px; height: 52px; border-radius: 50%; border: 3px solid #fff; display: flex; align-items: center; justify-content: center; }
.hp-shutter span { width: 22px; height: 22px; border-radius: 6px; background: #ff3b30; }
.hp-done { position: absolute; top: 44px; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: #0c2a20; background: #3ecf9b; padding: 5px 12px; border-radius: 20px; white-space: nowrap; }
.hp-caption { position: absolute; left: 16px; right: 16px; bottom: 108px; text-align: center; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 20px; line-height: 1.15; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,.45); }
.hp-caption b { color: #ffb36b; font-weight: 600; }
.hp-chips { position: absolute; left: 0; right: 0; bottom: 52px; display: flex; justify-content: center; gap: 5px; }
.hp-chips span { font-size: 10px; font-weight: 600; color: #fff; background: rgba(8,6,24,.55); padding: 4px 9px; border-radius: 20px; }
.hp-progress { position: absolute; left: 16px; right: 16px; bottom: 26px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.25); overflow: hidden; }
.hp-progress span { display: block; height: 100%; width: 100%; background: #fff; transform-origin: left; animation: hpBar 3s linear both; }
@media (prefers-reduced-motion: reduce) { .hp-s, .hp-idea, .hp-rec-dot, .hp-progress span { animation: none !important; } }`}</style>
        </section>

        <section style={{ padding: '24px 64px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', fontWeight: 600 }}>Made for small businesses: cafés, salons, trades, makers and market stalls</p>
        </section>

        <section id="how" style={{ padding: '48px 64px 0', scrollMarginTop: 24 }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: 600, marginBottom: 12, textAlign: 'center', letterSpacing: -0.3 }}>How it works</h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 48, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>From setup to your first posted video in under an hour.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {steps.map((s, i) => (
                <div key={s.title} style={{ padding: '28px 24px', background: 'var(--sand)', borderRadius: 14, border: '1px solid rgba(128,128,128,0.1)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{i + 1}</div>
                  <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>{s.title}</h3>
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

        <section style={{ padding: '48px 64px 0' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: 600, marginBottom: 12, textAlign: 'center', letterSpacing: -0.3 }}>Everything you need to post consistently</h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 48, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>Built so you can go from idea to scheduled post without opening a single other app.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {[
                { title: 'AI content ideas', desc: 'Get:', points: ['Hyperlocal video ideas', 'Titles and hashtags', 'Step-by-step filming checklists'] },
                { title: 'Automatic editing', desc: 'Reelezy handles:', points: ['Stitching your clips together', 'Captions', 'Pause removal', 'Sound'] },
                { title: 'Film with a teleprompter', desc: 'When you film:', points: ['Your script scrolls on screen', 'One clip at a time', 'Redo any clip before you render'] },
                { title: 'Plan your week', desc: 'Stay consistent by:', points: ['Lining up ideas ahead of time', 'Filming steps ready to go', 'Never staring at a blank page'] },
              ].map((f) => (
                <div key={f.title} style={{ background: 'var(--sand)', borderRadius: 14, padding: '28px 24px', border: '1px solid rgba(128,128,128,0.1)' }}>
                  <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>{f.title}</h3>
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

        <section style={{ padding: '48px 64px 0' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: 600, marginBottom: 8, textAlign: 'center', letterSpacing: -0.3 }}>Pricing</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 44 }}>Pick the plan that fits how many reels you make. Prices are in {currency ?? 'AUD'}. Full details at checkout.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, maxWidth: 960, margin: '0 auto' }}>
              {pricing.map((tier) => (
                <div key={tier.name} style={{ background: tier.highlight ? 'linear-gradient(135deg, #26215C, #712B13)' : 'var(--sand)', borderRadius: 14, padding: '32px 24px', border: tier.highlight ? 'none' : '1px solid rgba(128,128,128,0.15)' }}>
                  <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 16, fontWeight: 600, color: tier.highlight ? '#F1EFE8' : 'var(--ink)', margin: '0 0 4px' }}>{tier.name}</h3>
                  <p style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Poppins', sans-serif", color: tier.highlight ? '#F1EFE8' : 'var(--ink)', margin: '0 0 4px' }}>{currency ? tier.price : '\u00a0'}<span style={{ fontSize: 14, fontWeight: 400 }}>{currency ? tier.period : ''}</span></p>
                  <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0.3, margin: '0 0 4px', color: tier.highlight ? '#B8B5AE' : 'var(--text-muted)', minHeight: 16 }}>{currency ?? ''}</p>
                  {tier.note && <p style={{ fontSize: 12, margin: '0 0 8px', color: tier.highlight ? '#B8B5AE' : 'var(--text-muted)' }}>{currency ? tier.note : ''}</p>}
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

        <section style={{ padding: '48px 64px 0' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: 600, marginBottom: 36, textAlign: 'center', letterSpacing: -0.3 }}>Common questions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {faqs.map((f, i) => (
                <div key={f.q} style={{ background: 'var(--sand)', borderRadius: 10, border: '1px solid rgba(128,128,128,0.1)', overflow: 'hidden' }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', textAlign: 'left', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 500, color: 'var(--ink)', gap: 12 }}>
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
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 28, fontWeight: 600, color: '#F1EFE8', marginBottom: 10, letterSpacing: -0.3 }}>Start posting consistently</h2>
          <p style={{ fontSize: 15, color: '#B8B5AE', marginBottom: 28 }}>No credit card required.</p>
          <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '13px 32px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>Get started free</Link>
        </section>

        <footer style={{ padding: '56px 64px 48px', borderTop: '1px solid rgba(128,128,128,0.12)', marginTop: 64 }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32 }}>
            <div>
              <ReelezyLogo size={44} />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, maxWidth: 220, lineHeight: 1.6 }}>AI-powered social content for small businesses.</p>
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
                  <Link href="/privacy" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy Policy</Link>
                  <a href="mailto:hello@reelezy.com" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Contact</a>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 48 }}>© 2026 Reelezy. </p>
        </footer>

      </div>
    </div>
  )
}
