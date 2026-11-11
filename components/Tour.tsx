'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

// One step of the guided tour. `target` is the data-tour name of the button the card sits beside.
export type TourStep = {
  id: string
  target?: string
  title: string
  body: string
  // Runs when the step opens, e.g. to switch tab or open a menu so the target is on screen
  enter?: () => void
  // Move on by itself when the person presses the highlighted button
  advanceOnClick?: boolean
}

type Phase = 'off' | 'welcome' | 'step' | 'done'
type Box = { top: number; left: number; width: number; height: number }
type Place = { top: number; left: number; width: number }

const storeKey = (userId: string) => `reelly-tour-v1:${userId}`
// The answer is kept on the account as well as in this browser, so the tour does not come back on another device or on another Reelezy domain
const remember = (userId: string, value: 'done' | 'skipped' | 'seen') => {
  try { localStorage.setItem(storeKey(userId), value) } catch { /* private window: the account copy below still works */ }
  supabase.auth.updateUser({ data: { reelezy_tour: value } }).catch(() => {})
}
const readAccountAnswer = async (): Promise<'done' | 'skipped' | 'seen' | null> => {
  try {
    const { data } = await supabase.auth.getUser()
    const v = data.user?.user_metadata?.reelezy_tour
    return v === 'done' || v === 'skipped' || v === 'seen' ? v : null
  } catch { return null }
}

const ring = 'var(--coral)'
const primary = { background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' } as const
const quiet = { background: 'none', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 4, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const
const link = { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: '4px 2px', textDecoration: 'underline' } as const

// A short walk through everything needed to get a first video going. Cards open beside the
// button to press. The person can skip it at the start, or at any step, and it is remembered.
export default function Tour({ userId, steps, runKey, onStatus }: { userId: string | null; steps: TourStep[]; runKey: number; onStatus?: (how: 'done' | 'skipped') => void }) {
  const [phase, setPhase] = useState<Phase>('off')
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const stepsRef = useRef(steps)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const startedAt = useRef(0)
  const scrolled = useRef(false)
  useEffect(() => { stepsRef.current = steps })

  // Shows the welcome card once, ever, for anyone who has not seen it yet. It is marked as seen as soon as it appears.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const t = setTimeout(async () => {
      let answered = false
      try { answered = !!localStorage.getItem(storeKey(userId)) } catch { /* no storage: the account copy decides */ }
      if (!answered) {
        const account = await readAccountAnswer()
        if (account) { answered = true; try { localStorage.setItem(storeKey(userId), account) } catch { /* ignore */ } }
      }
      if (cancelled || answered) return
      remember(userId, 'seen')
      setPhase('welcome')
    }, 900)
    return () => { cancelled = true; clearTimeout(t) }
  }, [userId])

  // "Take the tour" buttons raise runKey to start it again
  useEffect(() => {
    if (runKey === 0) return
    const t = setTimeout(() => { setIndex(0); setPhase('welcome') }, 0)
    return () => clearTimeout(t)
  }, [runKey])

  const finish = useCallback((how: 'done' | 'skipped') => {
    if (userId) remember(userId, how)
    onStatus?.(how)
    setPhase(how === 'done' ? 'done' : 'off')
  }, [userId, onStatus])

  const goTo = useCallback((i: number) => {
    const list = stepsRef.current
    if (i >= list.length) { finish('done'); return }
    const at = Math.max(0, i)
    list[at].enter?.()
    startedAt.current = Date.now()
    scrolled.current = false
    setBox(null)
    setPlace(null)
    setIndex(at)
    setPhase('step')
  }, [finish])

  // Keeps the highlight and the card on the button, even while the page scrolls or a tab changes
  useEffect(() => {
    if (phase !== 'step') return
    const step = stepsRef.current[index]
    const measure = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const width = Math.min(340, vw - 24)
      const height = cardRef.current?.offsetHeight ?? 190
      const el = step?.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      if (!el) {
        // Not on screen (yet): wait a moment, then sit at the bottom of the screen
        setBox(null)
        if (Date.now() - startedAt.current > 900) setPlace({ top: Math.max(12, vh - height - 16), left: Math.max(12, (vw - width) / 2), width })
        return
      }
      if (!scrolled.current) { scrolled.current = true; el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }) }
      const r = el.getBoundingClientRect()
      setBox((p) => (p && Math.abs(p.top - r.top) < 1 && Math.abs(p.left - r.left) < 1 && Math.abs(p.width - r.width) < 1 && Math.abs(p.height - r.height) < 1 ? p : { top: r.top, left: r.left, width: r.width, height: r.height }))
      const gap = 14
      const clampLeft = (x: number) => Math.max(12, Math.min(x, vw - width - 12))
      const clampTop = (y: number) => Math.max(12, Math.min(y, vh - height - 12))
      let next: Place
      if (vw >= 700 && r.right + gap + width + 12 <= vw) next = { top: clampTop(r.top + r.height / 2 - height / 2), left: r.right + gap, width }
      else if (vw >= 700 && r.left - gap - width >= 12) next = { top: clampTop(r.top + r.height / 2 - height / 2), left: r.left - gap - width, width }
      else if (r.bottom + gap + height + 12 <= vh) next = { top: r.bottom + gap, left: clampLeft(r.left + r.width / 2 - width / 2), width }
      else if (r.top - gap - height >= 12) next = { top: r.top - gap - height, left: clampLeft(r.left + r.width / 2 - width / 2), width }
      else next = { top: Math.max(12, vh - height - 16), left: Math.max(12, (vw - width) / 2), width }
      setPlace((p) => (p && Math.abs(p.top - next.top) < 1 && Math.abs(p.left - next.left) < 1 && p.width === next.width ? p : next))
    }
    const first = setTimeout(measure, 0)
    const timer = setInterval(measure, 150)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { clearTimeout(first); clearInterval(timer); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [phase, index])

  // Pressing the highlighted button moves on by itself
  useEffect(() => {
    if (phase !== 'step') return
    const step = stepsRef.current[index]
    if (!step?.advanceOnClick || !step.target) return
    const onClick = (e: MouseEvent) => {
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      if (el && e.target instanceof Node && el.contains(e.target)) setTimeout(() => goTo(index + 1), 350)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [phase, index, goTo])

  useEffect(() => {
    if (phase === 'off' || phase === 'done') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish('skipped') }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase, finish])

  if (phase === 'off' || typeof document === 'undefined') return null

  const modal = (title: string, body: string, buttons: React.ReactNode) => createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 10020, background: 'rgba(20,16,30,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--card-bg, #fff)', color: 'var(--ink)', border: `1.5px solid ${ring}`, borderRadius: 4, padding: '24px 24px 20px', width: '100%', maxWidth: 400 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{title}</p>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{body}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 20 }}>{buttons}</div>
      </div>
    </div>,
    document.body
  )

  if (phase === 'welcome') {
    return modal(
      'New here? Take a 2 minute tour.',
      'We will point at each button you need, from your first idea to a finished video you can publish. You can skip it now and start it again any time from the Overview tab.',
      <>
        <button type="button" style={primary} onClick={() => goTo(0)}>Show me around</button>
        <button type="button" style={quiet} onClick={() => finish('skipped')}>No thanks</button>
      </>
    )
  }
  if (phase === 'done') {
    return modal(
      'You are ready to make a video.',
      'Start with Create, then Content Ideas. If you want this tour again, press Take the tour on the Overview tab.',
      <button type="button" style={primary} onClick={() => setPhase('off')}>Got it</button>
    )
  }

  const step = steps[index]
  if (!step) return null
  const last = index === steps.length - 1
  return createPortal(
    <>
      {box && (
        <div aria-hidden="true" style={{ position: 'fixed', top: box.top - 5, left: box.left - 5, width: box.width + 10, height: box.height + 10, borderRadius: 6, outline: `2px solid ${ring}`, boxShadow: '0 0 0 9999px rgba(20,16,30,0.45)', pointerEvents: 'none', zIndex: 10015 }} />
      )}
      <div ref={cardRef} role="dialog" aria-label={step.title}
        style={{ position: 'fixed', top: place?.top ?? 0, left: place?.left ?? 0, width: place?.width ?? Math.min(340, 300), zIndex: 10020, visibility: place ? 'visible' : 'hidden', background: 'var(--card-bg, #fff)', color: 'var(--ink)', border: `1.5px solid ${ring}`, borderRadius: 4, padding: '16px 16px 14px', boxSizing: 'border-box', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Step {index + 1} of {steps.length}</p>
        <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{step.title}</p>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{step.body}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
          <button type="button" style={primary} onClick={() => goTo(index + 1)}>{last ? 'Finish' : 'Next'}</button>
          {index > 0 && <button type="button" style={quiet} onClick={() => goTo(index - 1)}>Back</button>}
          <span style={{ flex: 1 }} />
          <button type="button" style={link} onClick={() => finish('skipped')}>Skip tour</button>
        </div>
      </div>
    </>,
    document.body
  )
}
