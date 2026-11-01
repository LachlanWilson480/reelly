'use client'
import { useId, useState } from 'react'

// A settings box that starts closed and shows a one-line summary of what is set,
// so people can render without opening every box.
export default function CollapsibleBox({ title, summary, defaultOpen = false, children }: {
  title: string
  summary?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div style={{ background: 'var(--sand)', borderRadius: 4 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
      >
        <span aria-hidden="true" style={{ display: 'inline-block', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}>›</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
        {summary && !open && (
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{summary}</span>
        )}
      </button>
      {open && (
        <div id={id} style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {children}
        </div>
      )}
    </div>
  )
}
