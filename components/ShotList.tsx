'use client'

import { useState } from 'react'
import type { ComfortLevel } from '@/lib/filmingComfort'

export type Shot = { time: string | null; seconds: number | null; film: string; say: string; screen: string[] }

const FONT = "var(--font-geist-sans), 'Inter', sans-serif"

// How the spoken words are labelled, from the filming comfort the person chose in Settings
const SAY_LABEL: Record<ComfortLevel | 'none', string> = { full: 'Say to camera', medium: 'Say (voice only)', low: 'Say', none: 'Say' }

// The filming plan as a list of shots. Each shot keeps apart what to film, what to say and what text goes on screen,
// so it can be read at a glance on a phone while filming.
export default function ShotList({ shots, comfort, onCamera, peopleCount, onEditLine }: {
  shots: Shot[]
  comfort: ComfortLevel | null
  onCamera: string | null
  peopleCount: number | null
  // Saves a new spoken line for one shot. Only given when each shot has its own line.
  onEditLine?: (index: number, text: string) => Promise<void> | void
}) {
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const talking = shots.some((s) => s.say)
  const total = shots.reduce((t, s) => t + (s.seconds || 0), 0)
  const who = peopleCount === 0 ? 'No one on camera' : onCamera?.trim() ? `On camera: ${onCamera.trim()}` : peopleCount && peopleCount > 1 ? `${peopleCount} people on camera` : null
  const style = comfort === 'low' || (!talking && shots.some((s) => s.screen.length)) ? 'No talking, words on screen'
    : comfort === 'medium' ? 'Hands and voice, no face'
    : talking ? 'You talk to camera' : null
  const chips = [`${shots.length} ${shots.length === 1 ? 'shot' : 'shots'}`, total ? `About ${total} seconds` : null, style, who].filter(Boolean) as string[]

  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', paddingTop: 2, whiteSpace: 'nowrap' }

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {chips.map((c) => (
          <span key={c} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 12px' }}>{c}</span>
        ))}
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {shots.map((s, i) => (
          <li key={i} className="shot-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--coral)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Shot {i + 1}</span>
              {s.time && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.time}{s.seconds ? ` · ${s.seconds}s` : ''}</span>}
            </div>

            <div className="shot-rows" style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 16, rowGap: 10, paddingLeft: 38 }}>
              {s.film && (
                <>
                  <span style={{ ...label, color: 'var(--text-secondary)' }}>Film</span>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' }}>{s.film}</p>
                </>
              )}
              {s.say && (
                <>
                  <span style={{ ...label, color: 'var(--coral)' }}>{SAY_LABEL[comfort || 'none']}</span>
                  {editing === i ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null) }}
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)', background: 'var(--card-bg)', border: '1px solid var(--coral)', borderRadius: 4, padding: '8px 10px', fontFamily: FONT, resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" disabled={saving} onClick={async () => { setSaving(true); try { await onEditLine?.(i, draft.trim() || s.say) } finally { setSaving(false); setEditing(null) } }}
                          style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--coral)', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontFamily: FONT }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button type="button" onClick={() => setEditing(null)} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <p style={{ margin: 0, flex: 1, fontSize: 16, lineHeight: 1.5, fontWeight: 600, color: 'var(--ink)', borderLeft: '3px solid var(--coral)', paddingLeft: 10 }}>{s.say}</p>
                      {onEditLine && (
                        <button type="button" onClick={() => { setDraft(s.say); setEditing(i) }} aria-label={`Edit what to say in shot ${i + 1}`}
                          style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', flexShrink: 0, fontFamily: FONT }}>Edit</button>
                      )}
                    </div>
                  )}
                </>
              )}
              {s.screen.length > 0 && (
                <>
                  <span style={{ ...label, color: 'var(--text-secondary)' }}>On screen</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {s.screen.map((t, k) => (
                      <span key={k} style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', background: 'var(--sand)', border: '1px dashed var(--text-muted)', borderRadius: 4, padding: '3px 10px' }}>{t}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
