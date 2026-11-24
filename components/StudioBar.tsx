'use client'

import Icon from '@/components/Icon'

export type StudioStep = 'plan' | 'film' | 'edit' | 'publish'

const STEPS: { id: StudioStep; label: string; hint: string }[] = [
  { id: 'plan', label: 'Plan', hint: 'Script and shot list' },
  { id: 'film', label: 'Film', hint: 'Teleprompter or your camera' },
  { id: 'edit', label: 'Edit', hint: 'Captions, music, finish' },
  { id: 'publish', label: 'Publish', hint: 'Download and post' },
]
const FONT = "var(--font-geist-sans), 'Inter', sans-serif"

// The bar across the top of the Studio: which video you are working on and where you are in making it.
// Every step can be clicked, so you can go back to the plan or jump ahead to editing.
export default function StudioBar({ title, step, done, onStep, onBack, tool }: {
  title: string
  step: StudioStep | null
  done: Partial<Record<StudioStep, boolean>>
  onStep: (s: StudioStep) => void
  onBack: () => void
  // A Studio tool that is not about one video (editing your own clips, planning several at once)
  tool?: string
}) {
  const current = step ? STEPS.findIndex((s) => s.id === step) : -1
  return (
    <div className="studio-bar" style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: '14px 18px 16px', marginBottom: 22, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: tool ? 0 : 14 }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', padding: '4px 0', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONT }}>
          <Icon n="back" />All videos
        </button>
        <span aria-hidden style={{ color: 'var(--line)' }}>|</span>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--coral)' }}>Studio</p>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 160px' }}>{tool || title}</h2>
      </div>
      {!tool && (
        <ol aria-label="Steps to make this video" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0 }}>
          {STEPS.map((s, i) => {
            const isCurrent = i === current
            const isDone = !!done[s.id] || (current > -1 && i < current)
            return (
              <li key={s.id} style={{ position: 'relative', minWidth: 0 }}>
                {i > 0 && <span aria-hidden style={{ position: 'absolute', top: 15, right: '50%', width: '100%', height: 2, background: isDone || isCurrent ? 'var(--coral)' : 'var(--line)', zIndex: 0 }} />}
                <button type="button" onClick={() => onStep(s.id)} aria-current={isCurrent ? 'step' : undefined}
                  style={{ position: 'relative', zIndex: 1, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontFamily: FONT }}>
                  <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
                    background: isCurrent ? 'var(--coral)' : isDone ? 'var(--coral)' : 'var(--card-bg)', color: isCurrent || isDone ? '#fff' : 'var(--text-muted)',
                    border: isCurrent || isDone ? '2px solid var(--coral)' : '2px solid var(--line)', boxShadow: isCurrent ? '0 0 0 4px rgba(255,106,77,0.18)' : 'none' }}>
                    {isDone && !isCurrent ? <Icon n="check" /> : i + 1}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 600, color: isCurrent ? 'var(--ink)' : 'var(--text-secondary)' }}>{s.label}</span>
                  <span className="studio-hint" style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{s.hint}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
