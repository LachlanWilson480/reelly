'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/authFetch'
import { card, fieldLabel, inputCompact, smallLabel } from '@/lib/ui'

// Loads one admin list and sends changes to the same address, then reloads
export function useAdminApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await authFetch(url)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Could not load.'); return }
      setError(''); setData(d)
    } catch { setError('Could not load. Check your connection.') }
  }, [url])
  useEffect(() => { load() }, [load])

  const post = useCallback(async (body: Record<string, unknown>, done?: string) => {
    setBusy(true); setMessage(null)
    try {
      const res = await authFetch(url, { method: 'POST', body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage({ text: d.error || 'Something went wrong.', bad: true }); return null }
      setMessage({ text: d.message || done || 'Saved.' })
      await load()
      return d
    } catch {
      setMessage({ text: 'Could not save. Check your connection.', bad: true }); return null
    } finally { setBusy(false) }
  }, [url, load])

  return { data, error, busy, message, setMessage, load, post }
}

export function Notice({ message }: { message: { text: string; bad?: boolean } | null }) {
  if (!message) return null
  return <div role="status" style={{ ...card, padding: 14, marginBottom: 20, fontSize: 14, borderColor: message.bad ? 'var(--coral)' : 'var(--line)', color: message.bad ? 'var(--coral)' : 'var(--ink)' }}>{message.text}</div>
}

export function Field({ label, value, onChange, type = 'text', placeholder, width = 180, hint }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; width?: number; hint?: string }) {
  return (
    <label style={{ flex: `1 1 ${width}px`, minWidth: 0 }}>
      <span style={fieldLabel}>{label}</span>
      <input style={inputCompact} type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      {hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</span>}
    </label>
  )
}

export function Pick({ label, value, onChange, options, width = 140 }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; width?: number }) {
  return (
    <label style={{ flex: `1 1 ${width}px`, minWidth: 0 }}>
      <span style={fieldLabel}>{label}</span>
      <select style={inputCompact} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  )
}

export function Tick({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--coral)' }} />
      <span>{label}</span>
    </label>
  )
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return <div><div style={smallLabel}>{label}</div><div style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink)', marginTop: 2 }}>{value}</div></div>
}

export const row: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' }
export const small: React.CSSProperties = { padding: '6px 12px', fontSize: 13 }
export const pill = (bg: string, fg = '#fff'): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', background: bg, color: fg, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' })
export const shortDate = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' }) : ''
