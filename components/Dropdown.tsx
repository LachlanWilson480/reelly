'use client'
import { useEffect, useId, useRef, useState } from 'react'

export type DropdownOption = { value: string; label: string }

// A drop-down that matches the rest of the site (the browser's own menu cannot be styled).
export default function Dropdown({ value, onChange, options, ariaLabel, style, height = 40 }: {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  ariaLabel?: string
  style?: React.CSSProperties
  height?: number
}) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const id = useId()
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown) }
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const openList = () => {
    const r = wrapRef.current?.getBoundingClientRect()
    setUp(!!r && window.innerHeight - r.bottom < 260 && r.top > 260)
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const pick = (v: string) => { onChange(v); setOpen(false) }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openList() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) pick(options[active].value) }
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()))
      if (i >= 0) setActive(i)
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', ...style }}>
      <button type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKey}
        style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 12px', borderRadius: 4, border: `1px solid ${open ? 'var(--ink)' : 'rgba(128,128,128,0.25)'}`, background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current?.label ?? value}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </button>
      {open && (
        <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={ariaLabel}
          style={{ position: 'absolute', left: 0, minWidth: '100%', width: 'max-content', maxWidth: 300, zIndex: 60, margin: 0, padding: 4, listStyle: 'none', maxHeight: 240, overflowY: 'auto', background: '#fff', border: '1px solid var(--line, #E5E5E5)', borderRadius: 4, boxShadow: '0 6px 20px rgba(0,0,0,0.08)', ...(up ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }) }}>
          {options.map((o, i) => {
            const sel = o.value === value
            return (
              <li key={o.value} role="option" aria-selected={sel} data-active={i === active}
                onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o.value)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 10px', borderRadius: 3, fontSize: 13, cursor: 'pointer', color: sel ? 'var(--coral)' : 'var(--ink)', fontWeight: sel ? 600 : 400, background: i === active ? 'var(--sand, #F9F9F9)' : 'transparent' }}>
                <span>{o.label}</span>
                {sel && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2.5 6.5 2.3 2.3 4.7-5.1" /></svg>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
