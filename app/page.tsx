'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase, consumeRecoveryFlag } from '@/lib/supabase'
import { CURRENCY_PRICES, PLAN_COPY } from '@/lib/pricing'
import { useCurrency } from '@/lib/useCurrency'
import './landing.css'
import Icon from '@/components/Icon'

const Points = ({ items }: { items: readonly string[] }) => (
  <ul className="lp-list">
    {items.map((pt) => (<li key={pt}>{pt}</li>))}
  </ul>
)

// The clapperboard mark (public/logo-mark.png) with the wordmark beside it
const Logo = ({ size = 22 }: { size?: number }) => (
  <span className="lp-logo" style={{ fontSize: size }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/logo-mark.png" alt="" width={Math.round(size * 1.5)} height={Math.round(size * 1.5)} style={{ display: 'block', flexShrink: 0 }} />
    <span>Reel<b>ezy</b></span>
  </span>
)

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
    }, 3600)
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
    return <div style={{ minHeight: '100vh', backgroundColor: '#FFFFFF' }} />
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

  const phoneLines = [
    "Hi, I'm Mia, and I'm about to fix a fringe.",
    "Here's the mistake I see every week.",
    'Book in and I will show you the fix.',
  ]

  // Film with the script on screen, then the edit, then the finished video
  const heroSteps = [
    { label: 'Read your script while you film' },
    { label: 'Preview and edit your reel' },
    { label: 'Download it, ready to post' },
  ]
  const exportRows = ['Captions added', 'Music mixed', 'Pauses cut', 'Exported in HD', 'Saved to your phone']

  return (
    <div className="lp">
      <Sidebar />

      <nav className="lp-nav" aria-label="Main">
        <div className="lp-nav-in">
          <Logo />
          <div className="lp-nav-actions">
            <Link href="/login" className="lp-login">Log in</Link>
            <Link href="/signup" className="lp-btn lp-btn-sm">Sign up</Link>
          </div>
        </div>
      </nav>

      <header className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <h1 className="lp-h1">Your reels done for you: what to film, edited and ready to post.</h1>
            <p className="lp-hero-sub">
              Reelezy tells you what to film, gives you a script to read off your screen, then edits it with captions and music. Ready for Instagram, Facebook, TikTok and YouTube. No editing skills needed.
            </p>
            <div className="lp-hero-actions">
              <Link href="/signup" className="lp-btn">Get started free</Link>
              <a href="#how" className="lp-textlink">See how it works</a>
            </div>
            <p className="lp-hero-note">No credit card required.</p>
          </div>

          <div className="lp-stage">
            <div className="hp-phone" aria-hidden="true">
              <div className="hp-notch" />
              <div className="hp-screen">
                {heroStep === 0 && (
                  <div className="hp-s hp-film" key="film">
                    <div className="hp-subject"><span className="hp-head" /><span className="hp-shoulders" /></div>
                    <div className="hp-prompter">
                      <p className="hp-line">{phoneLines[0]}</p>
                      <p className="hp-line hp-line-on">{phoneLines[1]}</p>
                      <p className="hp-line">{phoneLines[2]}</p>
                    </div>
                    <div className="hp-rec"><span className="hp-rec-dot" />REC</div>
                    <div className="hp-clips">Clip 2 of 3</div>
                    <div className="hp-shutter"><span /></div>
                  </div>
                )}
                {heroStep === 1 && (
                  <div className="hp-s hp-film" key="edit">
                    <div className="hp-subject hp-dim"><span className="hp-head" /><span className="hp-shoulders" /></div>
                    <div className="hp-bar-top">Preview</div>
                    <div className="hp-caption">Booking slots <b>open</b> this week</div>
                    <div className="hp-chips"><span>Captions</span><span>Music</span><span>Pauses cut</span></div>
                    <div className="hp-progress"><span /></div>
                  </div>
                )}
                {heroStep === 2 && (
                  <div className="hp-s hp-post" key="export">
                    <p className="hp-title">Finishing your reel</p>
                    {exportRows.map((name, i) => (
                      <div key={name} className="hp-plat" style={{ animationDelay: `${i * 160}ms` }}>
                        <span>{name}</span>
                        <i style={{ animationDelay: `${i * 160 + 200}ms` }} />
                        <b style={{ animationDelay: `${i * 160 + 900}ms` }}>Done</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="lp-stage-cap" aria-live="off">{heroSteps[heroStep].label}</p>
          </div>
        </div>
      </header>

      <div className="lp-for">
        <p className="lp-for-in"><b>Made for busy small-business owners:</b> cafés and restaurants, salons and beauty, tradies, makers and market stalls.</p>
      </div>

      <section id="how" className="lp-sec lp-anchor">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2 className="lp-h2">How it works</h2>
            <p className="lp-lead">From setup to your first finished video in under an hour.</p>
          </div>
          <div className="lp-steps">
            {steps.map((st, i) => (
              <div key={st.title} className="lp-step">
                <div className="lp-step-head">
                  <p className="lp-num">{i + 1}</p>
                  <h3 className="lp-h3">{st.title}</h3>
                  <p className="lp-sub">{st.desc}</p>
                </div>
                <ul className="lp-list lp-step-list">{st.points.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="lp-sec lp-band lp-anchor">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2 className="lp-h2">Everything you need to post consistently</h2>
            <p className="lp-lead">Built so you can go from idea to finished video without opening a single other app.</p>
          </div>
          <div className="lp-rows">
            <div className="lp-row">
              <div className="lp-row-text">
                <h3 className="lp-h3">AI content ideas</h3>
                <p className="lp-tile-lead">A fresh set of ideas written for your business and your local area.</p>
                <Points items={['Hyperlocal video ideas', 'Titles and hashtags', 'Step-by-step filming checklists']} />
              </div>
              <div className="lp-screen lp-ideas" aria-hidden="true">
                {mockIdeas.map((idea, i) => (
                  <div key={idea.title} className="lp-idea">
                    <div><strong>{idea.title}</strong><span>{idea.tag}</span></div>
                    <em className={i === 0 ? 'on' : ''}><Icon n="star" /></em>
                  </div>
                ))}
              </div>
            </div>

            <div className="lp-row">
              <div className="lp-row-text">
                <h3 className="lp-h3">Film with a teleprompter</h3>
                <p className="lp-tile-lead">Read your script off the screen while you film.</p>
                <Points items={['Your script scrolls on screen', 'One clip at a time', 'Redo any clip before you render']} />
              </div>
              <div className="lp-screen" aria-hidden="true">
                <div className="lp-prompt">
                  <span className="lp-rec"><i />REC</span>
                  {phoneLines.map((line, i) => (<p key={line} className={i === 1 ? 'on' : ''}>{line}</p>))}
                </div>
              </div>
            </div>

            <div className="lp-row">
              <div className="lp-row-text">
                <h3 className="lp-h3">Automatic editing</h3>
                <p className="lp-tile-lead">Film the clips. Reelezy puts the video together.</p>
                <Points items={['Stitching your clips together', 'Captions', 'Pause removal', 'Sound']} />
              </div>
              <div className="lp-screen" aria-hidden="true">
                <div className="lp-frame">
                  <div className="cap">Booking slots <b>open</b> this week</div>
                  <div className="lp-chip-row"><span>Captions</span><span>Music</span><span>Pauses cut</span></div>
                  <div className="lp-bar"><i /></div>
                </div>
              </div>
            </div>

            <div className="lp-row">
              <div className="lp-row-text">
                <h3 className="lp-h3">Plan your week</h3>
                <p className="lp-tile-lead">Line up the week once, then film when it suits you.</p>
                <Points items={['Lining up ideas ahead of time', 'Filming steps ready to go', 'Never staring at a blank page']} />
              </div>
              <div className="lp-screen" aria-hidden="true">
                <div className="lp-week">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                    <div key={d} className="lp-day">
                      <small>{d}</small>
                      {d === 'Mon' && <span>Before and after</span>}
                      {d === 'Wed' && <span className="alt">Behind the scenes</span>}
                      {d === 'Fri' && <span>Meet the team</span>}
                      {d === 'Sat' && <span className="alt">Come and see us</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="lp-sec lp-anchor">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2 className="lp-h2">Pricing</h2>
            <p className="lp-lead">Pick the plan that fits how many reels you make. Prices are in {currency ?? 'AUD'}. Full details at checkout.</p>
          </div>
          <div className="lp-plans">
            {pricing.map((tier) => (
              <div key={tier.name} className={tier.highlight ? 'lp-plan lp-plan-hi' : 'lp-plan'}>
                <h3>{tier.name}</h3>
                <p className="desc">{tier.desc}</p>
                <p className="lp-price">{currency ? tier.price : '\u00a0'}<small>{currency ? tier.period : ''}</small></p>
                <p className="meta">{currency && tier.note ? tier.note : ''}</p>
                <Points items={tier.features} />
                <Link href="/signup" className={tier.highlight ? 'lp-btn' : 'lp-btn lp-btn-line'}>Get started</Link>
              </div>
            ))}
          </div>
          <p className="lp-more"><Link href="/plans">See full plan details</Link></p>
        </div>
      </section>

      <section id="faq" className="lp-sec lp-band lp-anchor">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2 className="lp-h2">Common questions</h2>
          </div>
          <div className="lp-faq">
            {faqs.map((f, i) => (
              <div key={f.q} className={openFaq === i ? 'lp-q open' : 'lp-q'}>
                <button type="button" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{f.q}</span>
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 2v14M2 9h14" stroke="#FF6A4D" strokeWidth="1.5" /></svg>
                </button>
                <div className="lp-ans"><div><p>{f.a}</p></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec lp-final">
        <div className="lp-wrap lp-final-in">
          <h2 className="lp-h2">Start posting consistently</h2>
          <p className="lp-lead">No credit card required.</p>
          <Link href="/signup" className="lp-btn">Get started free</Link>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <div className="lp-foot-top">
            <div>
              <Logo size={24} />
              <p className="lp-foot-line">AI-powered social content for small businesses.</p>
            </div>
            <div className="lp-foot-cols">
              <div>
                <h4>Product</h4>
                <div className="lp-foot-col">
                  <Link href="/plans">Plans</Link>
                  <Link href="/signup">Sign up</Link>
                  <Link href="/login">Log in</Link>
                </div>
              </div>
              <div>
                <h4>Company</h4>
                <div className="lp-foot-col">
                  <Link href="/privacy">Privacy Policy</Link>
                  <Link href="/terms">Terms of Service</Link>
                  <Link href="/contact">Contact</Link>
                </div>
              </div>
            </div>
          </div>
          <p className="lp-copy">© 2026 Reelezy. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
