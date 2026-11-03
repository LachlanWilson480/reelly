'use client'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/authFetch'
import Dropdown from '@/components/Dropdown'
import { TIKTOK_PRIVACY_LABELS, type TikTokCreator, type TikTokOptions } from '@/lib/tiktok'

const muted = { fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 } as const

function Switch({ checked, onChange, label, note, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; note?: string; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, opacity: disabled ? 0.55 : 1 }}>
      <span style={{ fontSize: 13 }}>{label}{note && <span style={{ ...muted, display: 'block' }}>{note}</span>}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        style={{ width: 38, height: 22, borderRadius: 11, border: 'none', padding: 2, background: checked ? 'var(--coral)' : 'rgba(128,128,128,0.35)', cursor: disabled ? 'default' : 'pointer', flexShrink: 0, display: 'flex', justifyContent: checked ? 'flex-end' : 'flex-start', transition: 'background 0.15s' }}>
        <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', display: 'block' }} />
      </button>
    </div>
  )
}

// What TikTok requires before a video can be posted: who the post goes to, who can view it, interaction settings, commercial disclosure and consent.
export default function TikTokSettings({ videoUrl, value, onChange }: { videoUrl: string | null; value: TikTokOptions; onChange: (v: TikTokOptions) => void }) {
  const [creator, setCreator] = useState<TikTokCreator | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    authFetch('/api/social/tiktok-creator')
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!live) return
        if (r.ok && j.creator) setCreator(j.creator)
        else setError(j.error || 'Could not load your TikTok account.')
        setLoading(false)
      })
      .catch(() => { if (live) { setError('Could not load your TikTok account.'); setLoading(false) } })
    return () => { live = false }
  }, [])

  const set = (patch: Partial<TikTokOptions>) => onChange({ ...value, ...patch })
  const box = { border: '1px solid var(--line)', borderRadius: 4, background: '#fff', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 } as const

  if (loading) return <div style={box}><p style={muted}>Loading your TikTok account...</p></div>
  if (!creator) return <div style={box}><p role="alert" style={{ ...muted, color: '#D92D20' }}>{error} Reconnect TikTok at the top of this page, or untick TikTok to post without it.</p></div>

  const options = creator.privacyOptions.filter((p) => p in TIKTOK_PRIVACY_LABELS)
  const consent = value.commercial && value.brandedContent
  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {creator.avatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={creator.avatar} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          : <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--sand)', display: 'inline-block' }} />}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Posting to TikTok as {creator.nickname || creator.username}</p>
          {creator.username && <p style={muted}>@{creator.username}</p>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {videoUrl && (
          <video src={videoUrl} controls muted playsInline preload="metadata" aria-label="Video preview" style={{ width: 112, aspectRatio: '9 / 16', background: '#000', borderRadius: 4, objectFit: 'cover' }} />
        )}
        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Who can view this video</span>
            <Dropdown ariaLabel="Who can view this video" placeholder="Choose who can view" value={value.privacy} onChange={(v) => set({ privacy: v })} options={options.map((p) => ({ value: p, label: TIKTOK_PRIVACY_LABELS[p] }))} />
          </div>
          <Switch label="Allow comments" checked={value.allowComment && !creator.commentDisabled} disabled={creator.commentDisabled} note={creator.commentDisabled ? 'Turned off in your TikTok settings' : undefined} onChange={(v) => set({ allowComment: v })} />
          <Switch label="Allow Duet" checked={value.allowDuet && !creator.duetDisabled} disabled={creator.duetDisabled} note={creator.duetDisabled ? 'Turned off in your TikTok settings' : undefined} onChange={(v) => set({ allowDuet: v })} />
          <Switch label="Allow Stitch" checked={value.allowStitch && !creator.stitchDisabled} disabled={creator.stitchDisabled} note={creator.stitchDisabled ? 'Turned off in your TikTok settings' : undefined} onChange={(v) => set({ allowStitch: v })} />
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Switch label="Disclose commercial content" note="Turn this on if the video promotes your own business, a product or a paid partnership." checked={value.commercial} onChange={(v) => set(v ? { commercial: true } : { commercial: false, yourBrand: false, brandedContent: false })} />
        {value.commercial && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 2 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={value.yourBrand} onChange={(e) => set({ yourBrand: e.target.checked })} style={{ marginTop: 2, accentColor: 'var(--coral)' }} />
              <span>Your brand<span style={{ ...muted, display: 'block' }}>You are promoting your own business or products.</span></span>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={value.brandedContent} onChange={(e) => set({ brandedContent: e.target.checked })} style={{ marginTop: 2, accentColor: 'var(--coral)' }} />
              <span>Branded content<span style={{ ...muted, display: 'block' }}>You are promoting another brand or a third party.</span></span>
            </label>
            {(value.yourBrand || value.brandedContent) && (
              <p style={muted}>Your video will be labeled &quot;{value.brandedContent ? 'Paid partnership' : 'Promotional content'}&quot;. This cannot be changed after it is posted.</p>
            )}
            {value.brandedContent && value.privacy === 'SELF_ONLY' && (
              <p role="alert" style={{ ...muted, color: '#D92D20' }}>Branded content cannot be set to Only me. Choose another option above.</p>
            )}
          </div>
        )}
      </div>

      <p style={muted}>
        By posting, you agree to TikTok&apos;s{' '}
        {consent && <><a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Branded Content Policy</a> and{' '}</>}
        <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Music Usage Confirmation</a>.
      </p>
    </div>
  )
}
