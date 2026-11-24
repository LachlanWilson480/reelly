'use client'

import { useState } from 'react'
import Link from 'next/link'

const TONES = [
  { v: 'friendly', l: 'Friendly' },
  { v: 'fun', l: 'Fun' },
  { v: 'professional', l: 'Professional' },
  { v: 'bold', l: 'Bold' },
]
const LABELS = ['Short', 'Medium', 'Long']

// The free caption and hashtag generator: what the post is about in, three captions and hashtags out
export default function FreeCaptionTool() {
  const [about, setAbout] = useState('')
  const [business, setBusiness] = useState('')
  const [place, setPlace] = useState('')
  const [tone, setTone] = useState('friendly')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(false)
  const [captions, setCaptions] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [copied, setCopied] = useState('')

  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || about.trim().length < 4) return
    setBusy(true); setError(''); setLimit(false)
    try {
      const res = await fetch('/api/free/caption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ about, business, place, tone }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); setLimit(!!data.limit); return }
      setCaptions(data.captions || []); setTags(data.hashtags || [])
    } catch { setError('Something went wrong. Please try again.') } finally { setBusy(false) }
  }

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1600) } catch { /* the browser said no */ }
  }

  return (
    <>
      <form className="pg-tool" onSubmit={go}>
        <div className="pg-field">
          <label htmlFor="fc-about">What is your video or post about?</label>
          <textarea id="fc-about" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="For example: our new summer menu has a mango smoothie bowl, out this Friday" maxLength={300} required />
        </div>
        <div className="pg-row2">
          <div className="pg-field">
            <label htmlFor="fc-business">Type of business <small>(optional)</small></label>
            <input id="fc-business" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="For example: cafe" maxLength={80} />
          </div>
          <div className="pg-field">
            <label htmlFor="fc-place">Where are you? <small>(optional)</small></label>
            <input id="fc-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Suburb or town, for local hashtags" maxLength={60} />
          </div>
        </div>
        <div className="pg-field">
          <label htmlFor="fc-tone">Tone</label>
          <select id="fc-tone" value={tone} onChange={(e) => setTone(e.target.value)}>
            {TONES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <button type="submit" className="lp-btn" disabled={busy || about.trim().length < 4}>{busy ? 'Writing your captions...' : captions.length ? 'Write new captions' : 'Write my captions'}</button>
        {error && <p className="pg-err" role="alert">{error}{limit && <> <Link href="/signup?from=free-caption-generator">Sign up free</Link></>}</p>}
      </form>

      {captions.length > 0 && (
        <div className="pg-results" aria-live="polite">
          {captions.map((c, i) => (
            <div key={i} className="pg-result">
              <h3>{LABELS[i] || 'Caption'}</h3>
              <p>{c}</p>
              <button type="button" className="pg-copy" onClick={() => copy(`c${i}`, c)}>{copied === `c${i}` ? 'Copied' : 'Copy caption'}</button>
            </div>
          ))}
          {tags.length > 0 && (
            <div className="pg-result">
              <h3>Hashtags</h3>
              <div className="pg-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>
              <button type="button" className="pg-copy" onClick={() => copy('tags', tags.join(' '))}>{copied === 'tags' ? 'Copied' : 'Copy all hashtags'}</button>
            </div>
          )}
          <div className="pg-cta" style={{ marginTop: 16 }}>
            <div>
              <h2 className="lp-h3">Need the video too?</h2>
              <p>Reelezy tells you what to film, gives you a script to read off your screen, and edits the reel with captions and music. Free to start.</p>
            </div>
            <Link href="/signup?from=free-caption-generator" className="lp-btn">Get started free</Link>
          </div>
        </div>
      )}
    </>
  )
}
