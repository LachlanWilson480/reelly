'use client'

import { useState } from 'react'

export type VideoStage = 'idea' | 'planned' | 'made'
export type BoardVideo = {
  id: string; title: string; hook?: string; description?: string; notes?: string
  kind: 'idea' | 'script'; stage: VideoStage; madeAt?: string | null
}

const FONT = "var(--font-geist-sans), 'Inter', sans-serif"
const STAGES: { id: VideoStage; label: string }[] = [{ id: 'idea', label: 'Idea' }, { id: 'planned', label: 'Planned' }, { id: 'made', label: 'Video made' }]
const NEXT: Record<VideoStage, { label: string; sub: string }> = {
  idea: { label: 'Plan it', sub: 'Get a script and a shot list' },
  planned: { label: 'Film it', sub: 'Use the teleprompter or upload clips' },
  made: { label: 'Post it', sub: 'It is waiting in Publish' },
}

// Every video you are making, with how far along it is and the one thing to do next
export default function VideoBoard({ videos, onNext, onOpen, onRemove, onNotes, compact, emptyAction }: {
  videos: BoardVideo[]
  onNext: (v: BoardVideo) => void
  onOpen: (v: BoardVideo) => void
  onRemove?: (v: BoardVideo) => void
  onNotes?: (v: BoardVideo, notes: string) => void
  compact?: boolean
  emptyAction?: React.ReactNode
}) {
  const [notesOpen, setNotesOpen] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  if (videos.length === 0) {
    return (
      <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '40px 24px', textAlign: 'center', fontFamily: FONT }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>No videos on the go</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Save an idea you like, or write your own script, and it shows up here ready to plan, film and edit.</p>
        {emptyAction}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: compact ? 10 : 16, fontFamily: FONT }}>
      {videos.map((v) => {
        const si = STAGES.findIndex((s) => s.id === v.stage)
        const next = NEXT[v.stage]
        return (
          <div key={v.id} className="video-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: compact ? '14px 16px' : 20, display: 'flex', flexDirection: compact ? 'row' : 'column', gap: compact ? 14 : 12, alignItems: compact ? 'center' : 'stretch', flexWrap: 'wrap' }}>
            <div style={{ flex: compact ? '1 1 220px' : '0 0 auto', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                {/* Progress: three dots that fill as the video moves along */}
                <span aria-label={`Stage: ${STAGES[si].label}`} style={{ display: 'inline-flex', gap: 4 }}>
                  {STAGES.map((s, i) => <span key={s.id} style={{ width: 18, height: 4, borderRadius: 2, background: i <= si ? 'var(--coral)' : 'var(--line)' }} />)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: v.stage === 'made' ? 'var(--coral)' : 'var(--text-muted)' }}>{STAGES[si].label}</span>
                {v.kind === 'script' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your script</span>}
              </div>
              <button type="button" onClick={() => onOpen(v)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: FONT, display: 'block', width: '100%' }}>
                <h3 style={{ fontSize: compact ? 15 : 16, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.35 }}>{v.title}</h3>
              </button>
              {!compact && v.hook && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '6px 0 0' }}>{v.hook}</p>}
              {!compact && v.notes && notesOpen !== v.id && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0', fontStyle: 'italic' }}>Notes: {v.notes}</p>}
            </div>

            {!compact && notesOpen === v.id && onNotes && (
              <textarea autoFocus defaultValue={v.notes || ''} onBlur={(e) => { onNotes(v, e.target.value); setNotesOpen(null) }} rows={3}
                placeholder="Anything to remember: who is in it, props, the offer to mention"
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 4, padding: '8px 10px', fontSize: 13, fontFamily: FONT, background: 'var(--card-bg)', color: 'var(--ink)', resize: 'vertical' }} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: compact ? 0 : 'auto' }}>
              <button type="button" onClick={() => onNext(v)} aria-label={`${next.label}: ${v.title}`}
                style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                {next.label}
              </button>
              {!compact && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{next.sub}</span>}
              {!compact && (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                  {onNotes && <button type="button" onClick={() => setNotesOpen(notesOpen === v.id ? null : v.id)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 8px', fontFamily: FONT }}>Notes</button>}
                  {onRemove && (confirmRemove === v.id ? (
                    <>
                      <button type="button" onClick={() => setConfirmRemove(null)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 8px', fontFamily: FONT }}>Keep</button>
                      <button type="button" onClick={() => { setConfirmRemove(null); onRemove(v) }} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: '#D92D20', cursor: 'pointer', padding: '6px 8px', fontFamily: FONT }}>Remove</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmRemove(v.id)} aria-label={`Remove ${v.title}`} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 8px', fontFamily: FONT }}>Remove</button>
                  ))}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
