'use client'

import { useState } from 'react'
import Link from 'next/link'

type Idea = { title: string; hook: string; film: string }

// The free reel idea generator: business type in, three ideas out, then a nudge to sign up for more
export default function FreeIdeasTool() {
  const [business, setBusiness] = useState('')
  const [place, setPlace] = useState('')
  const [goal, setGoal] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(false)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [copied, setCopied] = useState(-1)

  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || business.trim().length < 2) return
    setBusy(true); setError(''); setLimit(false)
    try {
      const res = await fetch('/api/free/reel-ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business, place, goal }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); setLimit(!!data.limit); return }
      setIdeas(data.ideas || [])
    } catch { setError('Something went wrong. Please try again.') } finally { setBusy(false) }
  }

  const copy = async (i: number) => {
    const it = ideas[i]
    try { await navigator.clipboard.writeText(`${it.title}\nOpen with: ${it.hook}\nFilm: ${it.film}`); setCopied(i); setTimeout(() => setCopied(-1), 1600) } catch { /* the browser said no */ }
  }

  return (
    <>
      <form className="pg-tool" onSubmit={go}>
        <div className="pg-field">
          <label htmlFor="fi-business">What kind of business do you have?</label>
          <input id="fi-business" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="For example: dog groomer, cafe, mobile mechanic" maxLength={80} required />
        </div>
        <div className="pg-row2">
          <div className="pg-field">
            <label htmlFor="fi-place">Where are you? <small>(optional)</small></label>
            <input id="fi-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Suburb or town" maxLength={60} />
          </div>
          <div className="pg-field">
            <label htmlFor="fi-goal">What do you want more of? <small>(optional)</small></label>
            <select id="fi-goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="">Anything</option>
              <option value="bookings">Bookings</option>
              <option value="people walking in">People walking in</option>
              <option value="online orders">Online orders</option>
              <option value="followers">Followers</option>
              <option value="enquiries">Enquiries</option>
            </select>
          </div>
        </div>
        <button type="submit" className="lp-btn" disabled={busy || business.trim().length < 2}>{busy ? 'Writing your ideas...' : ideas.length ? 'Get 3 more ideas' : 'Get 3 reel ideas'}</button>
        {error && <p className="pg-err" role="alert">{error}{limit && <> <Link href="/signup?from=free-reel-ideas">Sign up free</Link></>}</p>}
      </form>

      {ideas.length > 0 && (
        <div className="pg-results" aria-live="polite">
          {ideas.map((it, i) => (
            <div key={`${it.title}-${i}`} className="pg-result">
              <h3>{it.title}</h3>
              <p className="pg-label">Open with</p>
              <p><b style={{ fontWeight: 500 }}>“{it.hook}”</b></p>
              <p className="pg-label">What to film</p>
              <p>{it.film}</p>
              <button type="button" className="pg-copy" onClick={() => copy(i)}>{copied === i ? 'Copied' : 'Copy idea'}</button>
            </div>
          ))}
          <div className="pg-cta" style={{ marginTop: 16 }}>
            <div>
              <h2 className="lp-h3">Turn these into finished reels</h2>
              <p>Sign up free and Reelezy gives you a script to read while you film, then edits the video with captions and music for you.</p>
            </div>
            <Link href="/signup?from=free-reel-ideas" className="lp-btn">Get started free</Link>
          </div>
        </div>
      )}
    </>
  )
}
