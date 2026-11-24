'use client'

import { card, sectionTitle } from '@/lib/ui'
import { useAdminApi, Notice, Stat, row, pill, shortDate } from './shared'

type Row = { key: string; label: string; last30: number; all: number; paying: number }
type Recent = { email: string; created_at: string; heard: string; from: string; paying: boolean }
type Data = { totals: { all: number; last30: number; paying: number }; heard: Row[]; from: Row[]; recent: Recent[] }

const th: React.CSSProperties = { textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '8px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontSize: 14, padding: '10px', borderBottom: '1px solid var(--line)' }
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

function Table({ title, note, rows }: { title: string; note: string; rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.all))
  return (
    <div style={{ ...card, padding: 20, marginBottom: 20, overflowX: 'auto' }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>{note}</p>
      {rows.length === 0 ? <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No sign-ups yet.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
          <thead><tr><th style={th}>Source</th><th style={{ ...th, textAlign: 'right' }}>Last 30 days</th><th style={{ ...th, textAlign: 'right' }}>All time</th><th style={{ ...th, textAlign: 'right' }}>Paying now</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td style={{ ...td, color: r.key === 'none' ? 'var(--text-muted)' : 'var(--ink)' }}>
                  <div>{r.label}</div>
                  <div style={{ height: 3, marginTop: 6, background: 'var(--line)', borderRadius: 2 }}><div style={{ height: 3, width: `${(r.all / max) * 100}%`, background: r.key === 'none' ? 'var(--text-muted)' : 'var(--coral)', borderRadius: 2 }} /></div>
                </td>
                <td style={num}>{r.last30}</td>
                <td style={num}>{r.all}</td>
                <td style={num}>{r.paying}{r.all ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> ({Math.round((r.paying / r.all) * 100)}%)</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// Where sign-ups come from, so you can see which marketing is working
export default function SignupsPanel() {
  const api = useAdminApi<Data>('/api/admin/signups')
  const d = api.data
  return (
    <div>
      <h2 style={{ ...sectionTitle, marginBottom: 8 }}>Sign-ups</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Where new accounts come from. &quot;How they heard&quot; is the answer on the sign-up page. &quot;Signed up from&quot; is the page or website they first arrived from, such as a reel ideas page, a free tool, or google.com. Accounts made before this was added show as not answered.
      </p>
      {api.error && <Notice message={{ text: api.error, bad: true }} />}
      {!d && !api.error && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading…</p>}
      {d && (
        <>
          <div style={{ ...row, gap: 32, marginBottom: 20 }}>
            <Stat label="Sign-ups, last 30 days" value={d.totals.last30} />
            <Stat label="Sign-ups, all time" value={d.totals.all} />
            <Stat label="Paying now" value={d.totals.paying} />
          </div>
          <Table title="How they heard about Reelezy" note="Their answer on the sign-up page." rows={d.heard} />
          <Table title="Signed up from" note="The first page or website they came from on that browser." rows={d.from} />
          <div style={{ ...card, padding: 20, overflowX: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>Latest sign-ups</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead><tr><th style={th}>Email</th><th style={th}>Joined</th><th style={th}>Heard from</th><th style={th}>Came from</th><th style={th}></th></tr></thead>
              <tbody>
                {d.recent.map((r, i) => (
                  <tr key={`${r.email}-${i}`}>
                    <td style={{ ...td, wordBreak: 'break-all' }}>{r.email}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{shortDate(r.created_at)}</td>
                    <td style={td}>{r.heard || <span style={{ color: 'var(--text-muted)' }}>None</span>}</td>
                    <td style={td}>{r.from || <span style={{ color: 'var(--text-muted)' }}>None</span>}</td>
                    <td style={td}>{r.paying && <span style={pill('var(--coral)')}>Paying</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
