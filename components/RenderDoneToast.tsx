'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/authFetch'
import { trackEvent } from '@/lib/track'
import { readTracked, writeTracked, trackRenders, TRACK_EVENT, type TrackedRender } from '@/lib/renderTracker'

const DAY = 24 * 60 * 60 * 1000

// Follows every video that is rendering (one or a whole batch) and tells the person when they are ready
export default function RenderDoneToast() {
  const router = useRouter()
  const [items, setItems] = useState<TrackedRender[]>([])
  const [progress, setProgress] = useState<Record<string, number>>({})
  const busyRef = useRef(false)
  const [shown, setShown] = useState(false)
  const [phase, setPhase] = useState<'ask' | 'busy' | 'done' | 'noacct' | 'tiktok' | 'error'>('ask')

  // Wait until the page has finished loading before showing anything
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const go = () => { t = setTimeout(() => setShown(true), 1800) }
    if (document.readyState === 'complete') go()
    else window.addEventListener('load', go, { once: true })
    return () => { clearTimeout(t); window.removeEventListener('load', go) }
  }, [])

  useEffect(() => {
    const sync = () => setItems(readTracked())
    const first = setTimeout(sync, 0)
    window.addEventListener(TRACK_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      clearTimeout(first)
      window.removeEventListener(TRACK_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    const tick = async () => {
      if (busyRef.current) return
      busyRef.current = true
      try {
        // A single render started from one of the editors
        const legacy = localStorage.getItem('reelezy-render')
        let legacyId: string | null = null
        if (legacy) {
          try {
            const parsed = JSON.parse(legacy)
            if (typeof parsed?.id === 'string') { legacyId = parsed.id; trackRenders([{ id: parsed.id }]) }
          } catch {}
        }

        const now = Date.now()
        const fresh = readTracked().filter((r) => now - r.ts < DAY)
        const pending = fresh.filter((r) => r.state === 'pending').slice(0, 12)
        if (pending.length === 0) return

        const results = await Promise.all(pending.map(async (r) => {
          try {
            const res = await authFetch('/api/render-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ renderId: r.id }) })
            if (!res.ok) return null
            return { id: r.id, data: await res.json() as { status?: string; progress?: number; outputUrl?: string | null } }
          } catch { return null }
        }))

        const byId = new Map(results.filter((x): x is NonNullable<typeof x> => !!x).map((x) => [x.id, x.data]))
        const nextProgress: Record<string, number> = {}
        let changed = fresh.length !== readTracked().length
        const updated = fresh.map((r) => {
          const d = byId.get(r.id)
          if (!d || r.state !== 'pending') return r
          if (d.status === 'done') { try { if (!localStorage.getItem('reelezy-first-reel')) { localStorage.setItem('reelezy-first-reel', '1'); trackEvent('first_reel_created') } } catch {} changed = true; return { ...r, state: 'done' as const, outputUrl: d.outputUrl || null } }
          if (d.status === 'failed') { changed = true; return { ...r, state: 'failed' as const } }
          if (typeof d.progress === 'number') nextProgress[r.id] = d.progress
          return r
        })
        if (legacyId && updated.some((r) => r.id === legacyId && r.state !== 'pending')) localStorage.removeItem('reelezy-render')
        setProgress((prev) => ({ ...prev, ...nextProgress }))
        if (changed) writeTracked(updated)
      } finally {
        busyRef.current = false
      }
    }
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 5000)
    return () => { clearTimeout(first); clearInterval(timer) }
  }, [])

  const pending = items.filter((r) => r.state === 'pending')
  const ready = items.filter((r) => r.state === 'done')
  const failed = items.filter((r) => r.state === 'failed')
  if (!shown || (pending.length === 0 && ready.length === 0 && failed.length === 0)) return null

  const dismiss = () => { writeTracked(readTracked().filter((r) => r.state === 'pending')); setPhase('ask') }
  const autoSchedule = async () => {
    setPhase('busy')
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    let next: 'done' | 'noacct' | 'tiktok' | 'error' = 'done'
    for (const r of ready) {
      try {
        const res = await authFetch('/api/auto-schedule', { method: 'POST', body: JSON.stringify({ renderId: r.id, timezone }) })
        if (!res.ok) { const e = await res.json().catch(() => ({})); next = e.error === 'no_accounts' ? 'noacct' : e.error === 'tiktok_needs_settings' ? 'tiktok' : 'error'; break }
      } catch { next = 'error'; break }
    }
    setPhase(next)
  }
  const openPublish = () => { dismiss(); router.push('/dashboard/scheduler') }

  const total = items.length
  const finished = ready.length + failed.length
  const overall = total === 0 ? 0 : Math.min(100, Math.round(((finished + pending.reduce((sum, r) => sum + (progress[r.id] || 0) / 100, 0)) / total) * 100))
  const previewUrl = ready.find((r) => r.outputUrl)?.outputUrl || null

  return (
    <>
      <style>{`
        @keyframes rdtIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rdtSpin { to { transform: rotate(360deg); } }
        .rdt { position: fixed; right: 20px; bottom: calc(20px + env(safe-area-inset-bottom)); width: 380px; z-index: 9999; animation: rdtIn 280ms ease-out; }
        @media (max-width: 640px) { .rdt { left: 12px; right: 12px; width: auto; bottom: calc(12px + env(safe-area-inset-bottom)); } }
        @media (prefers-reduced-motion: reduce) { .rdt { animation: none; } .rdt-spin { animation: none !important; } }
      `}</style>
      <div className="rdt" role="status" aria-live="polite" style={{ background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 4, boxShadow: '0 6px 24px rgba(0,0,0,0.10)', overflow: 'hidden', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
        {ready.length > 0 ? (
          <div style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 58, height: 104, borderRadius: 4, overflow: 'hidden', background: '#0b0a10', flexShrink: 0, position: 'relative' }}>
              {previewUrl && <video src={previewUrl} muted loop autoPlay playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              {ready.length > 1 && (
                <span style={{ position: 'absolute', right: 4, bottom: 4, background: 'var(--coral)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '1px 7px' }}>{ready.length}</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1.3 }}>
                {phase === 'done' ? 'Scheduled' : phase === 'noacct' ? 'Your video is ready' : phase === 'tiktok' ? 'Choose your TikTok settings' : ready.length === 1 ? 'Your video is ready' : `${ready.length} videos are ready`}
              </p>
              <p style={{ fontSize: 12, color: phase === 'error' ? '#D92D20' : 'var(--text-secondary)', margin: '3px 0 0', lineHeight: 1.4 }}>
                {phase === 'done' ? 'You can see it in your Publish calendar.' : phase === 'noacct' ? 'Find it in Publish, ready to download.' : phase === 'tiktok' ? 'TikTok asks you to choose who can view each video. Open Publish to set that and schedule it.' : phase === 'error' ? 'Open Publish to find it.' : ready.length === 1 ? 'Find it in Publish, with its title and description ready to copy.' : 'Find them in Publish, with their titles and descriptions ready to copy.'}
              </p>
              {pending.length > 0 && phase === 'ask' && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0' }}>{pending.length} still rendering</p>}
              {failed.length > 0 && phase === 'ask' && <p style={{ fontSize: 11, color: '#D92D20', margin: '3px 0 0' }}>{failed.length} could not be rendered</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {(phase === 'ask' || phase === 'error' || phase === 'busy') && (
                  <button onClick={openPublish} disabled={phase === 'busy'} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: phase === 'busy' ? 'default' : 'pointer', opacity: phase === 'busy' ? 0.6 : 1, fontFamily: 'inherit' }}>Open Publish</button>
                )}
                {(phase === 'noacct' || phase === 'tiktok' || phase === 'done') && (
                  <button onClick={openPublish} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{phase === 'done' ? 'View calendar' : 'Open Publish'}</button>
                )}
                {phase !== 'busy' && <button onClick={dismiss} style={{ background: '#fff', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 4, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>}
              </div>
            </div>
          </div>
        ) : pending.length > 0 ? (
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="rdt-spin" aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid var(--line)', borderTopColor: 'var(--coral)', animation: 'rdtSpin 0.9s linear infinite', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                  {total > 1 ? `Rendering ${finished + 1} of ${total} videos` : 'Rendering your video'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>You can keep using Reelezy or close this tab. We&apos;ll let you know when it&apos;s done.</p>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: 'var(--line)', marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${overall}%`, height: '100%', background: 'var(--coral)', borderRadius: 4, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        ) : (
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{failed.length === 1 ? 'A video could not be rendered' : `${failed.length} videos could not be rendered`}</p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Please try filming and rendering it again.</p>
            </div>
            <button onClick={dismiss} style={{ background: '#fff', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 4, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Dismiss</button>
          </div>
        )}
      </div>
    </>
  )
}
