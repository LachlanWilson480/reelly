'use client'

import { useEffect, useRef, useState } from 'react'
import { authFetch } from '@/lib/authFetch'
import { buttonPrimary, buttonSecondary } from '@/lib/ui'
import Dropdown from '@/components/Dropdown'

type Status = { enabled: boolean; connected: boolean; expired?: boolean; business?: string | null; location?: string | null; locations?: { path: string; title: string }[] }
type Photo = { name: string; url: string; category: string }
type Review = { name: string; reviewer: string; stars: number; comment: string; updated: string; reply: string | null }

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'AT_WORK', label: 'Our work' },
  { value: 'PRODUCT', label: 'Products' },
  { value: 'INTERIOR', label: 'Inside the store' },
  { value: 'EXTERIOR', label: 'Outside the store' },
  { value: 'TEAMS', label: 'Our team' },
  { value: 'ADDITIONAL', label: 'Other' },
]
const small = { fontSize: 13, color: 'var(--text-secondary)', margin: 0 } as const
const card = { border: '1px solid var(--line)', borderRadius: 4, padding: 16, background: '#fff', display: 'flex', flexDirection: 'column', gap: 12 } as const
const btn = { padding: '8px 14px', fontSize: 13 } as const

// Shrinks a photo so it fits inside the 4.5MB request limit
async function shrink(file: File): Promise<File> {
  if (file.size < 3_000_000 && file.type === 'image/jpeg') return file
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  for (const q of [0.88, 0.75, 0.6]) {
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q))
    if (blob && blob.size < 3_800_000) return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  }
  throw new Error('That photo is too large')
}

export default function GoogleBusinessPanel({ isFree }: { isFree: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [rating, setRating] = useState<{ average: number; total: number } | null>(null)
  const [category, setCategory] = useState('AT_WORK')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(() => {
    if (typeof window === 'undefined') return ''
    const q = new URLSearchParams(window.location.search)
    if (q.get('gbp') === 'connected') return 'Google Business Profile connected.'
    const e = q.get('gbp_error')
    return e ? (e === 'denied' ? 'Connection cancelled.' : e === 'unavailable' ? 'This connection is not switched on yet.' : `Could not connect Google. ${e}`) : ''
  })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadData = () => {
    authFetch('/api/gbp/photos').then(async (r) => { const j = await r.json().catch(() => ({})); if (r.ok) setPhotos(j.photos || []); else if (j.error) setNotice(j.error) }).catch(() => {})
    authFetch('/api/gbp/reviews').then(async (r) => { const j = await r.json().catch(() => ({})); if (r.ok) { setReviews(j.reviews || []); setRating({ average: j.average, total: j.total }) } else if (j.error) setNotice(j.error) }).catch(() => {})
  }
  const loadStatus = () => authFetch('/api/gbp/status').then(async (r) => (r.ok ? await r.json() : { enabled: false, connected: false })).catch(() => ({ enabled: false, connected: false }))

  useEffect(() => {
    let live = true
    loadStatus().then((s: Status) => {
      if (!live) return
      setStatus(s)
      if (s.connected && !s.expired) loadData()
    })
    return () => { live = false }
  }, [])

  const connect = async () => {
    setNotice(''); setBusy('connect')
    const r = await authFetch('/api/gbp/connect', { method: 'POST' }); const j = await r.json().catch(() => ({}))
    if (r.ok && j.url) { window.location.href = j.url; return }
    setBusy(''); setNotice(j.error || 'Could not start the connection. Try again.')
  }
  const disconnect = async () => {
    await authFetch('/api/gbp/status', { method: 'DELETE' })
    setStatus({ enabled: true, connected: false }); setPhotos([]); setReviews([]); setRating(null)
  }
  const choose = async (location: string) => {
    const r = await authFetch('/api/gbp/status', { method: 'POST', body: JSON.stringify({ location }) }); const j = await r.json().catch(() => ({}))
    if (!r.ok) { setNotice(j.error || 'Could not switch business'); return }
    setStatus((s) => (s ? { ...s, business: j.business, location } : s)); setPhotos([]); setReviews([]); loadData()
  }

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setNotice(''); setBusy('upload'); let done = 0
    for (const f of Array.from(files).slice(0, 10)) {
      try {
        const small = await shrink(f)
        const fd = new FormData(); fd.append('file', small); fd.append('category', category)
        const r = await authFetch('/api/gbp/photos', { method: 'POST', body: fd })
        if (!r.ok) { const j = await r.json().catch(() => ({})); setNotice(j.error || 'Upload failed'); break }
        done++
      } catch (e) { setNotice(e instanceof Error ? e.message : 'Upload failed'); break }
    }
    setBusy(''); if (fileRef.current) fileRef.current.value = ''
    if (done > 0) { setNotice(`${done} photo${done === 1 ? '' : 's'} added. Google can take a little while to show them.`); loadData() }
  }
  const removePhoto = async (name: string) => {
    setBusy(name)
    const r = await authFetch('/api/gbp/photos', { method: 'DELETE', body: JSON.stringify({ name }) })
    setBusy(''); if (r.ok) setPhotos((p) => p.filter((x) => x.name !== name)); else setNotice('Could not remove that photo')
  }

  const draft = async (rv: Review) => {
    setBusy(`d${rv.name}`)
    const r = await authFetch('/api/gbp/draft-reply', { method: 'POST', body: JSON.stringify({ stars: rv.stars, comment: rv.comment, reviewer: rv.reviewer }) }); const j = await r.json().catch(() => ({}))
    setBusy('')
    if (r.ok && j.reply) setDrafts((d) => ({ ...d, [rv.name]: j.reply })); else setNotice(j.error || 'Could not write a reply right now')
  }
  const send = async (rv: Review) => {
    const comment = (drafts[rv.name] || '').trim(); if (!comment) return
    setBusy(`s${rv.name}`)
    const r = await authFetch('/api/gbp/reviews', { method: 'POST', body: JSON.stringify({ review: rv.name, comment }) }); const j = await r.json().catch(() => ({}))
    setBusy('')
    if (r.ok) { setReviews((l) => l.map((x) => (x.name === rv.name ? { ...x, reply: comment } : x))); setOpen(null) } else setNotice(j.error || 'Could not post that reply')
  }
  const removeReply = async (rv: Review) => {
    setBusy(`s${rv.name}`)
    const r = await authFetch('/api/gbp/reviews', { method: 'DELETE', body: JSON.stringify({ review: rv.name }) })
    setBusy(''); if (r.ok) setReviews((l) => l.map((x) => (x.name === rv.name ? { ...x, reply: null } : x))); else setNotice('Could not remove that reply')
  }

  const enabled = !!status?.enabled
  const connected = !!status?.connected && !status.expired

  return (
    <section aria-labelledby="pub-gbp" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 id="pub-gbp" style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Google Business Profile</h3>
      {notice && <p role="status" style={{ fontSize: 13, background: 'var(--sand)', border: '1px solid var(--line)', borderRadius: 4, padding: '10px 14px', margin: 0 }}>{notice}</p>}

      {!connected ? (
        <div style={card}>
          <p style={{ ...small, color: 'var(--text-primary, inherit)', fontSize: 14 }}>Add photos of your work and your store to Google, and reply to your reviews, without leaving Reelezy.</p>
          {status === null ? <p style={small}>Loading…</p> : !enabled ? (
            <p style={small}>Coming soon. We are waiting on Google to switch this on.</p>
          ) : (
            <div>
              <button type="button" onClick={connect} disabled={isFree || busy === 'connect'} style={{ ...buttonPrimary, ...btn, opacity: isFree ? 0.45 : 1, cursor: isFree ? 'not-allowed' : 'pointer' }}>{status.expired ? 'Reconnect Google' : 'Connect Google'}</button>
              {isFree && <p style={{ ...small, marginTop: 8 }}><a href="/plans" style={{ color: 'var(--coral)', fontWeight: 600 }}>Upgrade</a> to connect your Google Business Profile.</p>}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ ...card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{status?.business || 'Your business'}</p>
              <p style={small}>{rating && rating.total > 0 ? `${rating.average.toFixed(1)} stars from ${rating.total} review${rating.total === 1 ? '' : 's'}` : 'Connected'}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {(status?.locations?.length || 0) > 1 && (
                <Dropdown ariaLabel="Business" style={{ width: 220 }} height={36} value={status?.location || ''} onChange={choose} options={(status?.locations || []).map((l) => ({ value: l.path, label: l.title }))} />
              )}
              <button type="button" onClick={disconnect} style={{ ...buttonSecondary, ...btn }}>Disconnect</button>
            </div>
          </div>

          <div style={card}>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Photos</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Dropdown ariaLabel="What the photo shows" value={category} onChange={setCategory} options={CATEGORIES} style={{ width: 200 }} height={36} />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple onChange={(e) => upload(e.target.files)} hidden />
              <button type="button" disabled={busy === 'upload'} onClick={() => fileRef.current?.click()} style={{ ...buttonPrimary, ...btn }}>{busy === 'upload' ? 'Uploading…' : 'Add photos'}</button>
            </div>
            <p style={small}>JPG or PNG, up to 10 at a time. Show real jobs, your shopfront and your space. Google shows these on your listing.</p>
            {photos.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                {photos.map((p) => (
                  <div key={p.name} style={{ position: 'relative', aspectRatio: '1', borderRadius: 4, overflow: 'hidden', background: 'var(--sand)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={CATEGORIES.find((c) => c.value === p.category)?.label || 'Business photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button type="button" aria-label="Remove photo" disabled={busy === p.name} onClick={() => removePhoto(p.name)} style={{ position: 'absolute', top: 4, right: 4, border: 'none', borderRadius: 4, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 12, padding: '3px 8px', cursor: 'pointer' }}>Remove</button>
                  </div>
                ))}
              </div>
            ) : <p style={small}>No photos on your profile yet.</p>}
          </div>

          <div style={card}>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Reviews</p>
            {reviews.length === 0 && <p style={small}>No reviews yet.</p>}
            {reviews.map((rv) => (
              <div key={rv.name} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{rv.reviewer} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{rv.stars} of 5 stars{rv.updated ? `, ${new Date(rv.updated).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span></p>
                {rv.comment && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{rv.comment}</p>}
                {rv.reply && open !== rv.name && (
                  <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '8px 12px' }}>
                    <p style={{ ...small, marginBottom: 2 }}>Your reply</p>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{rv.reply}</p>
                  </div>
                )}
                {open === rv.name ? (
                  <>
                    <textarea value={drafts[rv.name] ?? rv.reply ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [rv.name]: e.target.value }))} rows={3} maxLength={4000} aria-label={`Reply to ${rv.reviewer}`} style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 4, padding: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => send(rv)} disabled={busy === `s${rv.name}`} style={{ ...buttonPrimary, ...btn }}>{busy === `s${rv.name}` ? 'Posting…' : 'Post reply'}</button>
                      <button type="button" onClick={() => draft(rv)} disabled={busy === `d${rv.name}`} style={{ ...buttonSecondary, ...btn }}>{busy === `d${rv.name}` ? 'Writing…' : 'Write it for me'}</button>
                      <button type="button" onClick={() => setOpen(null)} style={{ ...buttonSecondary, ...btn }}>Cancel</button>
                    </div>
                    <p style={small}>Replies are public. Check it before you post.</p>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => { setOpen(rv.name); setDrafts((d) => ({ ...d, [rv.name]: d[rv.name] ?? rv.reply ?? '' })); if (!rv.reply && !drafts[rv.name]) draft(rv) }} style={{ ...buttonSecondary, ...btn }}>{rv.reply ? 'Edit reply' : 'Reply'}</button>
                    {rv.reply && <button type="button" onClick={() => removeReply(rv)} disabled={busy === `s${rv.name}`} style={{ ...buttonSecondary, ...btn }}>Delete reply</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
