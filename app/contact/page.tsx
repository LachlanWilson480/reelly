'use client'

import { useState } from 'react'
import LegalLogo from '@/components/LegalLogo'

const FIELD = { width: '100%', padding: '11px 14px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' } as const
const LABEL = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 } as const

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setState('sending')
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, message, website }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); setState('idle'); return }
      setState('sent')
    } catch {
      setError('Something went wrong. Please try again.')
      setState('idle')
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)', lineHeight: 1.6 }}>
      <LegalLogo />
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Contact us</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>Questions, feedback or need a hand? Send us a message and we will reply by email.</p>
      {state === 'sent' ? (
        <p style={{ fontWeight: 600 }}>Thanks, your message is on its way. We will reply soon.</p>
      ) : (
        <form onSubmit={send}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="c-name" style={LABEL}>Your name</label>
            <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} style={FIELD} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="c-email" style={LABEL}>Your email</label>
            <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} style={FIELD} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="c-msg" style={LABEL}>Message</label>
            <textarea id="c-msg" value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={4000} rows={6} style={{ ...FIELD, resize: 'vertical' }} />
          </div>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999, opacity: 0, height: 0, width: 0 }} />
          {error && <p style={{ color: '#D92D20', fontSize: 14, marginBottom: 12 }}>{error}</p>}
          <button type="submit" disabled={state === 'sending'} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '12px 22px', fontSize: 15, fontWeight: 700, cursor: state === 'sending' ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {state === 'sending' ? 'Sending...' : 'Send message'}
          </button>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>Or email info@reelezy.com. Reelezy, ABN 76 182 998 115.</p>
        </form>
      )}
    </div>
  )
}
