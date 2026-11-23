'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { FONT, pageTitle, sectionTitle, fieldLabel, smallLabel, inputCompact, card, buttonPrimary, buttonSecondary, buttonDark } from '@/lib/ui'

type CreatorView = {
  id: string; name: string; email: string; code: string
  commission_percent: number; commission_months: number | null
  abn: string | null; supplier_statement: boolean; agreement_signed: boolean
  bsb: string | null; account_number: string | null; account_name: string | null
  note: string | null; active: boolean; created_at: string
  uses: number; customer_percent_off: number | null; customer_months: number | null; code_active: boolean
  held_cents: number; ready_cents: number; paid_cents: number; check_count: number
}
type Owed = { id: string; creator_id: string; name: string; period: string; total_cents: number; withheld_cents: number; net_cents: number; bsb: string; account_number: string; account_name: string }
type Check = { id: string; name: string; reason: string | null; currency: string; commission_cents: number; paid_at: string; stripe_invoice_id: string }

const aud = (c: number) => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toFixed(2)}`
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
const blankForm = {
  name: '', email: '', code: '', customer_percent_off: '20', customer_months: '1',
  commission_percent: '20', commission_months: '12', lifetime: false,
  abn: '', supplier_statement: false, agreement_signed: false,
  bsb: '', account_number: '', account_name: '', note: '', free_months: '3', free_plan: 'pro',
}

export default function CreatorsAdmin() {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'denied' | 'ready'>('loading')
  const [creators, setCreators] = useState<CreatorView[]>([])
  const [owed, setOwed] = useState<Owed[]>([])
  const [checks, setChecks] = useState<Check[]>([])
  const [period, setPeriod] = useState('')
  const [form, setForm] = useState(blankForm)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [edit, setEdit] = useState<Record<string, string | boolean>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/creators')
    if (res.status === 403) { setState('denied'); return }
    const data = await res.json()
    setCreators(data.creators || []); setOwed(data.owed || []); setChecks(data.checks || []); setPeriod(data.period || '')
    setState('ready')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      load()
    })
  }, [load, router])

  async function post(body: Record<string, unknown>, done?: string) {
    setBusy(true); setMessage(null)
    try {
      const res = await authFetch('/api/admin/creators', { method: 'POST', body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage({ text: data.error || 'Something went wrong.', bad: true }); return null }
      if (done) setMessage({ text: done })
      await load()
      return data
    } finally {
      setBusy(false)
    }
  }

  async function addCreator() {
    const data = await post({ action: 'create', ...form })
    if (!data) return
    setMessage({ text: data.freeNote ? `${form.name} added. ${data.freeNote}` : `${form.name} added. Their code ${form.code.toUpperCase().replace(/[^A-Z0-9]/g, '')} works now.` })
    setForm(blankForm); setAdding(false)
  }

  async function runNow() {
    if (!confirm('Run this month\'s statements now? Creators with anything to report get their statement email.')) return
    const data = await post({ action: 'run' })
    if (!data) return
    const r = data.result
    setMessage({ text: `Done. ${r.payouts.length} payout${r.payouts.length === 1 ? '' : 's'} made and ${r.statements} statement${r.statements === 1 ? '' : 's'} sent for ${r.period}.` })
  }

  function downloadCsv() {
    const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
    const lines = [['Name', 'Account name', 'BSB', 'Account number', 'Amount', 'Reference'].map(q).join(',')]
    for (const o of owed) lines.push([o.name, o.account_name, o.bsb, o.account_number, (o.net_cents / 100).toFixed(2), `Reelezy ${monthLabel(o.period)}`].map(q).join(','))
    const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'reelezy-creator-payouts.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function startEdit(c: CreatorView) {
    setEditing(c.id)
    setEdit({
      name: c.name, email: c.email, commission_percent: String(c.commission_percent), commission_months: c.commission_months ? String(c.commission_months) : '',
      abn: c.abn || '', supplier_statement: c.supplier_statement, agreement_signed: c.agreement_signed,
      bsb: c.bsb || '', account_number: c.account_number || '', account_name: c.account_name || '', note: c.note || '',
    })
  }

  async function saveEdit(id: string) {
    const fields = { ...edit, commission_months: edit.commission_months === '' ? null : edit.commission_months }
    if (await post({ action: 'update', id, fields }, 'Saved.')) setEditing(null)
  }

  if (state === 'loading') return <div style={{ padding: 40, fontFamily: FONT, color: 'var(--text-muted)' }}>Loading…</div>
  if (state === 'denied') return (
    <div style={{ padding: 40, fontFamily: FONT, maxWidth: 520 }}>
      <h1 style={pageTitle}>Creators</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>This page is for the Reelezy team. If that is you, add your email to ADMIN_EMAILS in Vercel and redeploy.</p>
    </div>
  )

  const field = (label: string, key: keyof typeof blankForm, opts: { placeholder?: string; width?: number | string; type?: string } = {}) => (
    <label style={{ flex: `1 1 ${opts.width ?? 200}px`, minWidth: 0 }}>
      <span style={fieldLabel}>{label}</span>
      <input style={inputCompact} type={opts.type || 'text'} value={String(form[key])} placeholder={opts.placeholder}
        onChange={e => setForm({ ...form, [key]: e.target.value })} />
    </label>
  )
  const tick = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span>{label}</span>
    </label>
  )
  const row: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' }
  const th: React.CSSProperties = { ...smallLabel, textAlign: 'left', padding: '8px 12px 8px 0', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: 13, padding: '10px 12px 10px 0', borderTop: '1px solid var(--line)', color: 'var(--ink)', whiteSpace: 'nowrap' }

  return (
    <div style={{ fontFamily: FONT, maxWidth: 1000, margin: '0 auto', padding: '32px 20px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 style={pageTitle}>Creators</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={buttonSecondary} disabled={busy} onClick={runNow}>Run statements now</button>
          <button style={buttonPrimary} disabled={busy} onClick={() => { setAdding(!adding); setMessage(null) }}>{adding ? 'Close' : 'Add a creator'}</button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>
        Commission is held for 30 days in case of a refund. Statements go out by themselves early on the 2nd of each month, covering {period || 'last month'}. Payouts under $20 carry over.
      </p>

      {message && (
        <div style={{ ...card, padding: 14, marginBottom: 20, fontSize: 14, borderColor: message.bad ? 'var(--coral)' : 'var(--line)', color: message.bad ? 'var(--coral)' : 'var(--ink)' }}>{message.text}</div>
      )}

      {adding && (
        <div style={{ ...card, marginBottom: 28, display: 'grid', gap: 16 }}>
          <h2 style={sectionTitle}>Add a creator</h2>
          <div style={row}>{field('Name', 'name')}{field('Email', 'email', { type: 'email' })}{field('Code', 'code', { placeholder: 'DAVEY80' })}</div>
          <div style={row}>
            {field('Their followers get (% off)', 'customer_percent_off', { type: 'number', width: 150 })}
            {field('For how many months', 'customer_months', { type: 'number', width: 150 })}
            {field('Creator earns (%)', 'commission_percent', { type: 'number', width: 150 })}
            {!form.lifetime && field('For each person\'s first (months)', 'commission_months', { type: 'number', width: 150 })}
          </div>
          {tick('Pay commission for as long as each person stays subscribed', form.lifetime, v => setForm({ ...form, lifetime: v }))}
          <div style={row}>{field('ABN', 'abn', { width: 160 })}{field('BSB', 'bsb', { width: 100 })}{field('Account number', 'account_number', { width: 140 })}{field('Account name', 'account_name')}</div>
          {tick('No ABN, but they gave me a signed ATO Statement by a supplier', form.supplier_statement, v => setForm({ ...form, supplier_statement: v }))}
          {tick('They signed the creator agreement (label every post as an ad, and Reelezy can repost their videos and use them in ads)', form.agreement_signed, v => setForm({ ...form, agreement_signed: v }))}
          <div style={row}>
            {field('Free months of Reelezy for them', 'free_months', { type: 'number', width: 150 })}
            <label style={{ flex: '1 1 150px' }}>
              <span style={fieldLabel}>Plan</span>
              <select style={inputCompact} value={form.free_plan} onChange={e => setForm({ ...form, free_plan: e.target.value })}>
                <option value="pro">Pro</option><option value="basic">Basic</option>
              </select>
            </label>
            {field('Note', 'note', { placeholder: 'Their handle, platform', width: 260 })}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Free months only work if they already have a Reelezy account with this email. Set it to 0 to skip.</p>
          <div><button style={buttonPrimary} disabled={busy} onClick={addCreator}>Save creator</button></div>
        </div>
      )}

      {owed.length > 0 && (
        <div style={{ ...card, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <h2 style={sectionTitle}>Payouts to make</h2>
            <button style={buttonDark} onClick={downloadCsv}>Download bank list</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th style={th}>Creator</th><th style={th}>Month</th><th style={th}>Earned</th><th style={th}>Held for ATO</th><th style={th}>Pay them</th><th style={th}>BSB</th><th style={th}>Account</th><th style={th}></th></tr></thead>
              <tbody>{owed.map(o => (
                <tr key={o.id}>
                  <td style={td}>{o.name}</td><td style={td}>{monthLabel(o.period)}</td><td style={td}>{aud(o.total_cents)}</td>
                  <td style={td}>{o.withheld_cents ? aud(o.withheld_cents) : ''}</td><td style={{ ...td, fontWeight: 700 }}>{aud(o.net_cents)}</td>
                  <td style={td}>{o.bsb || <span style={{ color: 'var(--coral)' }}>Missing</span>}</td>
                  <td style={td}>{o.account_number || <span style={{ color: 'var(--coral)' }}>Missing</span>}</td>
                  <td style={td}><button style={{ ...buttonSecondary, padding: '6px 12px', fontSize: 13 }} disabled={busy} onClick={() => post({ action: 'mark_paid', payout_id: o.id }, `${o.name} marked paid.`)}>Mark paid</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {owed.some(o => o.withheld_cents > 0) && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 0' }}>Amounts held for the ATO are paid to the ATO with your activity statement (BAS). Ask your accountant about this the first time.</p>
          )}
        </div>
      )}

      {checks.length > 0 && (
        <div style={{ ...card, marginBottom: 28 }}>
          <h2 style={{ ...sectionTitle, marginBottom: 8 }}>Needs checking</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>These payments could not be checked in Stripe. Look up the invoice in Stripe, then pay or remove the commission.</p>
          {checks.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--line)', fontSize: 13 }}>
              <span>{c.name}: {c.currency.toUpperCase()} {(c.commission_cents / 100).toFixed(2)} on {c.stripe_invoice_id}. {c.reason}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                {c.currency === 'aud' && <button style={{ ...buttonSecondary, padding: '6px 12px', fontSize: 13 }} disabled={busy} onClick={() => post({ action: 'dismiss_check', id: c.id, pay: true }, 'Added to the next payout.')}>Pay it</button>}
                <button style={{ ...buttonSecondary, padding: '6px 12px', fontSize: 13 }} disabled={busy} onClick={() => post({ action: 'dismiss_check', id: c.id, pay: false }, 'Removed.')}>Remove</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ ...sectionTitle, marginBottom: 12 }}>All creators ({creators.length})</h2>
      {creators.length === 0 && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No creators yet. Add your first one above.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {creators.map(c => {
          const warnings = [
            !c.agreement_signed && 'Agreement not signed yet',
            !c.abn && !c.supplier_statement && 'No ABN or supplier statement, so 47% of payouts over $75 is held for the ATO',
            (!c.bsb || !c.account_number) && 'No bank details',
          ].filter(Boolean) as string[]
          const e = editing === c.id
          const ef = (label: string, key: string, width = 160) => (
            <label style={{ flex: `1 1 ${width}px`, minWidth: 0 }}>
              <span style={fieldLabel}>{label}</span>
              <input style={inputCompact} value={String(edit[key] ?? '')} onChange={ev => setEdit({ ...edit, [key]: ev.target.value })} />
            </label>
          )
          return (
            <div key={c.id} style={{ ...card, padding: 18, opacity: c.active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{c.name} <span style={{ fontFamily: 'monospace', fontSize: 14, background: 'var(--sand)', padding: '2px 6px', borderRadius: 4, marginLeft: 6 }}>{c.code}</span>{!c.active && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Turned off</span>}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    {c.email}. Followers get {c.customer_percent_off ?? '?'}% off {c.customer_months === 1 ? 'their first month' : `their first ${c.customer_months} months`}. {c.name.split(' ')[0]} earns {Number(c.commission_percent)}% {c.commission_months ? `for ${c.commission_months} months` : 'for life'}.
                    {c.note ? ` ${c.note}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <button style={{ ...buttonSecondary, padding: '6px 12px', fontSize: 13 }} onClick={() => (e ? setEditing(null) : startEdit(c))}>{e ? 'Cancel' : 'Edit'}</button>
                  <button style={{ ...buttonSecondary, padding: '6px 12px', fontSize: 13 }} disabled={busy}
                    onClick={() => { if (c.active && !confirm(`Turn off ${c.name}? Their code stops working and they stop earning commission.`)) return; post({ action: 'update', id: c.id, fields: { active: !c.active } }, c.active ? `${c.name} turned off.` : `${c.name} turned back on.`) }}>
                    {c.active ? 'Turn off' : 'Turn on'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 14 }}>
                {[['Joined with code', String(c.uses)], ['On 30 day hold', aud(c.held_cents)], ['Ready for next payout', aud(c.ready_cents)], ['Paid so far', aud(c.paid_cents)]].map(([k, v]) => (
                  <div key={k}><div style={smallLabel}>{k}</div><div style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink)', marginTop: 2 }}>{v}</div></div>
                ))}
              </div>
              {warnings.length > 0 && !e && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--coral)' }}>{warnings.join('. ')}.</div>
              )}
              {e && (
                <div style={{ display: 'grid', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                  <div style={row}>{ef('Name', 'name')}{ef('Email', 'email', 220)}{ef('Earns (%)', 'commission_percent', 100)}{ef('For months (blank = for life)', 'commission_months', 180)}</div>
                  <div style={row}>{ef('ABN', 'abn')}{ef('BSB', 'bsb', 100)}{ef('Account number', 'account_number', 140)}{ef('Account name', 'account_name', 200)}</div>
                  {ef('Note', 'note', 300)}
                  {tick('No ABN, but they gave me a signed ATO Statement by a supplier', !!edit.supplier_statement, v => setEdit({ ...edit, supplier_statement: v }))}
                  {tick('They signed the creator agreement', !!edit.agreement_signed, v => setEdit({ ...edit, agreement_signed: v }))}
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Changing the % or months only affects payments from now on.</p>
                  <div><button style={buttonPrimary} disabled={busy} onClick={() => saveEdit(c.id)}>Save</button></div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
