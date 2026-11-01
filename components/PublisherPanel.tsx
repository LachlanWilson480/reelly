'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import CollapsibleBox from '@/components/CollapsibleBox'
import { PLATFORMS, cleanProfile, connectedPlatforms, type PlatformId, type SocialProfiles } from '@/lib/socialProfiles'

const input = { width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid var(--line)', background: '#fff', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' as const }
const chip = (on: boolean) => ({ padding: '8px 14px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: on ? '2px solid var(--coral)' : '1px solid var(--line)', background: on ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', color: on ? 'var(--coral)' : 'var(--ink)' })

export type ScheduledPost = {
  id: string; title: string; caption: string | null; video_url: string | null; scheduled_for: string
  platforms: string[]; status: string; error_text: string | null
}

// Loads and saves the person's social pages
export function useSocialProfiles(userId: string | null) {
  const [profiles, setProfiles] = useState<SocialProfiles>({})
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!userId) return
    ;(async () => {
      const { data, error } = await supabase.from('business_profiles').select('social_profiles, instagram_handle, tiktok_handle').eq('user_id', userId).maybeSingle()
      const saved = (!error && data?.social_profiles && typeof data.social_profiles === 'object' ? data.social_profiles : {}) as SocialProfiles
      // Older accounts only have the two handles from onboarding
      const next: SocialProfiles = { ...saved }
      if (!next.instagram && data?.instagram_handle) { const c = cleanProfile('instagram', String(data.instagram_handle)); if (c) next.instagram = c }
      if (!next.tiktok && data?.tiktok_handle) { const c = cleanProfile('tiktok', String(data.tiktok_handle)); if (c) next.tiktok = c }
      setProfiles(next)
      setLoaded(true)
    })()
  }, [userId])
  const save = async (next: SocialProfiles): Promise<boolean> => {
    if (!userId) return false
    const { error } = await supabase.from('business_profiles').update({ social_profiles: next }).eq('user_id', userId)
    if (error) return false
    setProfiles(next)
    return true
  }
  return { profiles, loaded, save }
}

export function ProfilesCard({ profiles, onSave }: { profiles: SocialProfiles; onSave: (p: SocialProfiles) => Promise<boolean> }) {
  const [draft, setDraft] = useState<Record<PlatformId, string>>({ youtube: profiles.youtube || '', tiktok: profiles.tiktok || '', instagram: profiles.instagram || '', linkedin: profiles.linkedin || '', facebook: profiles.facebook || '' })
  const [errors, setErrors] = useState<Partial<Record<PlatformId, string>>>({})
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const count = connectedPlatforms(profiles).length

  const submit = async () => {
    const next: SocialProfiles = {}
    const errs: Partial<Record<PlatformId, string>> = {}
    for (const p of PLATFORMS) {
      const c = cleanProfile(p.id, draft[p.id])
      if (c === null) errs[p.id] = `That does not look like a ${p.label} handle or link.`
      else if (c) next[p.id] = c
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setState('saving')
    setState((await onSave(next)) ? 'saved' : 'failed')
  }

  return (
    <CollapsibleBox title="Your social pages" summary={count > 0 ? `${count} added` : 'Add them to schedule posts'} defaultOpen={count === 0}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
        Add the pages you post to. You can leave any blank. Paste a handle like @yourbusiness or a link to the page.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {PLATFORMS.map((p) => (
          <div key={p.id}>
            <label htmlFor={`sp-${p.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{p.label}</label>
            <input id={`sp-${p.id}`} value={draft[p.id]} onChange={(e) => { setDraft((d) => ({ ...d, [p.id]: e.target.value })); setState('idle') }} placeholder={p.placeholder} style={{ ...input, borderColor: errors[p.id] ? '#d92d20' : 'var(--line)' }} />
            {errors[p.id] && <p role="alert" style={{ fontSize: 11, color: '#d92d20', margin: '4px 0 0' }}>{errors[p.id]}</p>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={submit} disabled={state === 'saving'} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{state === 'saving' ? 'Saving...' : 'Save pages'}</button>
        {state === 'saved' && <span role="status" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Saved</span>}
        {state === 'failed' && <span role="alert" style={{ fontSize: 13, color: '#d92d20' }}>Could not save. Please try again.</span>}
      </div>
    </CollapsibleBox>
  )
}

// Inline form on a finished video: pick where it goes and when
export function ScheduleForm({ renderId, title, caption, tags, videoUrl, connected, onScheduled }: {
  renderId: string; title: string; caption: string; tags: string; videoUrl: string | null; connected: PlatformId[]; onScheduled: () => void
}) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<PlatformId[]>(connected)
  const [when, setWhen] = useState('')
  const [text, setText] = useState([caption, tags].filter(Boolean).join('\n'))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState(false)

  if (connected.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Add your social pages above to schedule this video.</p>
  }
  if (done) return <p role="status" style={{ fontSize: 13, color: 'var(--ink)', margin: 0, fontWeight: 600 }}>Scheduled. It is in your queue.</p>
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ ...chip(false), alignSelf: 'flex-start' }}>Schedule post</button>
  }

  const submit = async () => {
    setMsg('')
    if (picked.length === 0) { setMsg('Choose at least one place to post.'); return }
    const d = new Date(when)
    if (!when || Number.isNaN(d.getTime()) || d.getTime() < Date.now() + 60_000) { setMsg('Pick a time in the future.'); return }
    setBusy(true)
    try {
      const res = await authFetch('/api/schedule-post', { method: 'POST', body: JSON.stringify({ ideaId: renderId, title: title || 'Untitled video', caption: text, tags: null, videoUrl, scheduledFor: d.toISOString(), platforms: picked }) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); setMsg(e.error || 'Could not schedule. Please try again.'); setBusy(false); return }
      setDone(true); onScheduled()
    } catch { setMsg('Could not schedule. Please try again.') }
    setBusy(false)
  }

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: 4, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--line)' }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 6px' }}>Post to</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PLATFORMS.filter((p) => connected.includes(p.id)).map((p) => (
            <button key={p.id} type="button" aria-pressed={picked.includes(p.id)} onClick={() => setPicked((cur) => cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id])} style={chip(picked.includes(p.id))}>{p.label}</button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor={`when-${renderId}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Date and time</label>
        <input id={`when-${renderId}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ ...input, maxWidth: 260 }} />
      </div>
      <div>
        <label htmlFor={`cap-${renderId}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Caption</label>
        <textarea id={`cap-${renderId}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
      </div>
      {msg && <p role="alert" style={{ fontSize: 12, color: '#d92d20', margin: 0 }}>{msg}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={submit} disabled={busy} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Scheduling...' : 'Schedule'}</button>
        <button type="button" onClick={() => setOpen(false)} style={chip(false)}>Cancel</button>
      </div>
    </div>
  )
}

const STATUS: Record<string, string> = { scheduled: 'Scheduled', posted: 'Posted', failed: 'Failed', cancelled: 'Cancelled', needs_connection: 'Not posted' }

export function Queue({ posts, onCancel, onDownload }: { posts: ScheduledPost[]; onCancel: (id: string) => void; onDownload: (url: string) => void }) {
  const live = posts.filter((p) => p.status !== 'cancelled')
  return (
    <CollapsibleBox title="Your queue" summary={live.length === 0 ? 'Nothing scheduled' : `${live.filter((p) => p.status === 'scheduled').length} scheduled`} defaultOpen={live.length > 0}>
      {live.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Schedule a finished video below and it will show up here.</p>
      ) : live.map((p) => (
        <div key={p.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0, flex: 1, minWidth: 0 }}>{p.title}</p>
            <span style={{ fontSize: 12, fontWeight: 700, color: p.status === 'needs_connection' || p.status === 'failed' ? '#d92d20' : 'var(--text-secondary)' }}>{STATUS[p.status] || p.status}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {new Date(p.scheduled_for).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {p.platforms.map((x) => PLATFORMS.find((q) => q.id === x)?.label || x).join(', ')}
          </p>
          {p.status === 'needs_connection' && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Automatic posting is not switched on yet, so this was not posted. Download the video and post it yourself.</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            {p.video_url && (p.status === 'needs_connection' || p.status === 'failed') && <button type="button" onClick={() => onDownload(p.video_url!)} style={chip(false)}>Download</button>}
            {p.status === 'scheduled' && <button type="button" onClick={() => onCancel(p.id)} style={chip(false)}>Cancel post</button>}
          </div>
        </div>
      ))}
    </CollapsibleBox>
  )
}
