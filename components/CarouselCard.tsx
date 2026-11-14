'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { carouselImageUrls, downloadCarousel } from '@/lib/carouselFiles'
import { cleanString } from '@/lib/cleanText'

export type CarouselItem = { id: string; image_paths: string[]; caption: string | null; created_at: string }

const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 4, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
export const carouselBtn = {
  primary: { ...btn, background: 'var(--coral)', color: '#fff', border: '1px solid var(--coral)' } as React.CSSProperties,
  secondary: { ...btn, background: '#fff', color: 'var(--ink)', border: '1px solid var(--line)' } as React.CSSProperties,
  danger: { ...btn, background: '#fff', color: '#D92D20', border: '1px solid #D92D20' } as React.CSSProperties,
}

// One saved carousel: its pictures in order, the caption, and what you can do with it.
// Used on the Carousel page and in Publish.
export default function CarouselCard({ c, index, onDelete, onPublish }: { c: CarouselItem; index?: number; onDelete?: () => void; onPublish?: () => void }) {
  const [urls, setUrls] = useState<string[]>([])
  const [busy, setBusy] = useState<'' | 'download' | 'delete'>('')
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [failed, setFailed] = useState('')
  const pathsKey = c.image_paths.join('|')

  useEffect(() => {
    let live = true
    carouselImageUrls(c.image_paths, 6).then((u) => { if (live) setUrls(u) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathsKey])

  const caption = c.caption ? cleanString(c.caption) : ''
  const n = c.image_paths.length
  const extra = n - Math.min(n, 6)

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 4, background: '#fff', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'thin' }} aria-label={`${n} pictures`}>
        {Array.from({ length: Math.min(n, 6) }).map((_, i) => (
          <div key={i} style={{ position: 'relative', width: 76, aspectRatio: '4 / 5', flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: 'var(--sand)' }}>
            {urls[i] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[i]} alt={`Picture ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
            <span style={{ position: 'absolute', left: 4, top: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 2, padding: '1px 5px' }}>{i + 1}</span>
            {i === 5 && extra > 0 && <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+{extra}</span>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{typeof index === 'number' ? `Carousel ${index + 1}` : 'Carousel'}</p>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n} {n === 1 ? 'picture' : 'pictures'} · {new Date(c.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      {caption ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <p style={{ flex: '1 1 220px', margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{caption}</p>
          <button type="button" onClick={() => { void navigator.clipboard.writeText(caption).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }} style={carouselBtn.secondary} aria-label="Copy caption">
            <Icon n={copied ? 'check' : 'copy'} />{copied ? 'Copied' : 'Copy caption'}
          </button>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>No caption</p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" disabled={busy === 'download'} onClick={async () => { setBusy('download'); setFailed(''); const ok = await downloadCarousel(c.image_paths, `carousel${typeof index === 'number' ? `-${index + 1}` : ''}.zip`).catch(() => false); if (!ok) setFailed('Could not download the pictures. Please try again.'); setBusy('') }} style={{ ...carouselBtn.primary, opacity: busy === 'download' ? 0.7 : 1 }}>
          <Icon n="download" />{busy === 'download' ? 'Preparing...' : 'Download pictures'}
        </button>
        {onPublish && <button type="button" onClick={onPublish} style={carouselBtn.secondary}>Open in Publish</button>}
        <span style={{ flex: 1 }} />
        {onDelete && (confirm ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Delete this carousel?</span>
            <button type="button" onClick={() => setConfirm(false)} style={carouselBtn.secondary}>Keep</button>
            <button type="button" disabled={busy === 'delete'} onClick={() => { setBusy('delete'); onDelete() }} style={{ ...carouselBtn.danger, background: '#D92D20', color: '#fff' }}>Delete</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} style={carouselBtn.danger}>Delete</button>
        ))}
      </div>
      {failed && <p role="alert" style={{ margin: 0, fontSize: 12, color: '#D92D20' }}>{failed}</p>}
    </div>
  )
}
