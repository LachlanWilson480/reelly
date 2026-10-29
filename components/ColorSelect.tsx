'use client'
import { useEffect, useId, useRef, useState } from 'react'

const PRESETS = ['#000000', '#FFFFFF', '#FF6A4D', '#E8392B', '#FFD60A', '#2BB673', '#2F6FED', '#8B5CF6', '#FF4FA3', '#777777', '#111111', '#F9F9F9']

// A colour picker that matches the site, with an optional "No background" choice.
export default function ColorSelect({ value, onChange, allowNone = false, noneLabel = 'No background', ariaLabel, height = 40 }: {
  value: string | null
  onChange: (value: string | null) => void
  allowNone?: boolean
  noneLabel?: string
  ariaLabel?: string
  height?: number
}) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const toggle = () => {
    if (!open) {
      const r = wrapRef.current?.getBoundingClientRect()
      setUp(!!r && window.innerHeight - r.bottom < 300 && r.top > 300)
    }
    setOpen((o) => !o)
  }
  const isNone = value === null
  const same = (a: string, b: string | null) => !!b && a.toLowerCase() === b.toLowerCase()

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-pop`} aria-label={ariaLabel} onClick={toggle}
        style={{ width: '100%', height, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', borderRadius: 4, border: `1px solid ${open ? 'var(--ink)' : 'rgba(128,128,128,0.25)'}`, background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', boxSizing: 'border-box', textAlign: 'left' }}>
        {isNone
          ? <span aria-hidden style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid rgba(128,128,128,0.4)', background: 'linear-gradient(to top right, transparent calc(50% - 1px), #d92d20 calc(50% - 1px), #d92d20 calc(50% + 1px), transparent calc(50% + 1px))', flexShrink: 0 }} />
          : <span aria-hidden style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid rgba(128,128,128,0.4)', background: value ?? '#000', flexShrink: 0 }} />}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isNone ? noneLabel : (value ?? '').toUpperCase()}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </button>
      {open && (
        <div id={`${id}-pop`} role="dialog" aria-label={ariaLabel}
          style={{ position: 'absolute', left: 0, zIndex: 60, width: 232, maxWidth: '90vw', padding: 10, background: '#fff', border: '1px solid var(--line, #E5E5E5)', borderRadius: 4, boxShadow: '0 6px 20px rgba(0,0,0,0.08)', ...(up ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }) }}>
          {allowNone && (
            <button type="button" onClick={() => { onChange(null); setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 10px', marginBottom: 8, borderRadius: 3, border: 'none', background: isNone ? 'var(--sand, #F9F9F9)' : 'transparent', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', color: isNone ? 'var(--coral)' : 'var(--ink)', fontWeight: isNone ? 600 : 400, textAlign: 'left' }}>
              <span>{noneLabel}</span>
              {isNone && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2.5 6.5 2.3 2.3 4.7-5.1" /></svg>}
            </button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {PRESETS.map((c) => (
              <button key={c} type="button" aria-label={c} title={c} onClick={() => { onChange(c); setOpen(false) }}
                style={{ height: 28, borderRadius: 4, background: c, cursor: 'pointer', padding: 0, border: same(c, value) ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.35)', boxSizing: 'border-box' }} />
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line, #E5E5E5)', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
            Custom colour
            <input type="color" value={value ?? '#000000'} onChange={(e) => onChange(e.target.value)} aria-label="Pick any colour" style={{ width: 40, height: 26, padding: 0, border: '1px solid rgba(128,128,128,0.35)', borderRadius: 4, background: 'none', cursor: 'pointer' }} />
          </label>
        </div>
      )}
    </div>
  )
}
