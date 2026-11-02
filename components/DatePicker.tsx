'use client'

import { useEffect, useRef, useState } from 'react'

const pad = (n: number) => String(n).padStart(2, '0')
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromValue = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }

// A small month calendar in the same dropdown style. Days before today can not be picked.
export default function DatePicker({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away); document.addEventListener('touchstart', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('touchstart', away); document.removeEventListener('keydown', esc) }
  }, [open])
  const selected = fromValue(value)
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1))
  const [today] = useState(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t })
  const lead = (month.getDay() + 6) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))] as (Date | null)[]
  const nav: React.CSSProperties = { background: 'none', border: '1px solid var(--line)', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }
  const canBack = month.getTime() > new Date(today.getFullYear(), today.getMonth(), 1).getTime()
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button id={id} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1)); setOpen((o) => !o) }} style={{ width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 12px', borderRadius: 4, border: `1px solid ${open ? 'var(--ink)' : 'rgba(128,128,128,0.25)'}`, background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box' }}>
        <span>{selected.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </button>
      {open && (
        <div role="dialog" aria-label={label} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60, width: 266, padding: 12, boxSizing: 'border-box', background: '#fff', border: '1px solid var(--line, #E5E5E5)', borderRadius: 4, boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" aria-label="Previous month" disabled={!canBack} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ ...nav, opacity: canBack ? 1 : 0.35, cursor: canBack ? 'pointer' : 'default' }}><svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true"><path d="M6 1L1 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</span>
            <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={nav}><svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true"><path d="M2 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const past = d.getTime() < today.getTime()
              const on = toValue(d) === value
              return (
                <button key={i} type="button" disabled={past} aria-pressed={on} onClick={() => { onChange(toValue(d)); setOpen(false) }} className={past || on ? undefined : 'lib-option'} style={{ padding: '7px 0', borderRadius: 4, border: d.getTime() === today.getTime() && !on ? '1px solid var(--line)' : '1px solid transparent', background: on ? 'var(--coral)' : 'transparent', color: on ? '#fff' : past ? 'var(--text-muted)' : 'var(--ink)', opacity: past ? 0.4 : 1, fontSize: 13, fontWeight: on ? 700 : 500, cursor: past ? 'default' : 'pointer' }}>{d.getDate()}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

