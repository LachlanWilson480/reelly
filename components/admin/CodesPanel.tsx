'use client'

import { useState } from 'react'
import { buttonPrimary, buttonSecondary, card, sectionTitle, smallLabel } from '@/lib/ui'
import { useAdminApi, Notice, Field, Pick, Tick, row, small, pill, shortDate } from './shared'

type Code = {
  code: string; percent_off: number; months: number | null; monthly_only: boolean; plans: string[] | null; new_customers_only: boolean
  uses: number; max_uses: number | null; expires_at: string | null; active: boolean; note: string | null; creator: string | null
}
const blank = { code: '', percent_off: '20', months: '1', monthly_only: true, new_customers_only: true, plans: 'any', max_uses: '', expires_at: '', note: '' }
const planWord = (p: string[] | null) => (!p || !p.length ? 'any plan' : p.includes('top') ? 'Pro only' : 'Basic only')
const dayOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }) : '')

export default function CodesPanel() {
  const api = useAdminApi<{ codes: Code[] }>('/api/admin/codes')
  const [form, setForm] = useState(blank)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [edit, setEdit] = useState<typeof blank>(blank)
  const [search, setSearch] = useState('')
  const codes = (api.data?.codes || []).filter(c => !search || c.code.includes(search.toUpperCase()) || (c.note || '').toLowerCase().includes(search.toLowerCase()))

  const expired = (c: Code) => !!c.expires_at && new Date(c.expires_at) < new Date()
  const usedUp = (c: Code) => c.max_uses != null && c.uses >= c.max_uses
  const status = (c: Code): [string, string, string] =>
    !c.active ? ['Off', 'var(--line)', 'var(--text-secondary)'] : expired(c) ? ['Expired', 'var(--line)', 'var(--text-secondary)'] : usedUp(c) ? ['Used up', 'var(--line)', 'var(--text-secondary)'] : ['Live', 'var(--coral)', '#fff']

  const formFields = (f: typeof blank, set: (v: typeof blank) => void, isNew: boolean) => (
    <>
      <div style={row}>
        {isNew && <Field label="Code" value={f.code} onChange={v => set({ ...f, code: v })} placeholder="LAUNCH20" />}
        <Field label="% off" type="number" value={f.percent_off} onChange={v => set({ ...f, percent_off: v })} width={90} />
        <Field label="For how many months" type="number" value={f.months} onChange={v => set({ ...f, months: v })} width={140} />
        <Pick label="Plans" value={f.plans} onChange={v => set({ ...f, plans: v })} options={[['any', 'Any plan'], ['top', 'Pro only'], ['basic', 'Basic only']]} />
      </div>
      <div style={row}>
        <Field label="Most uses (blank = no limit)" type="number" value={f.max_uses} onChange={v => set({ ...f, max_uses: v })} width={180} />
        <Field label="Last day it works (blank = never ends)" type="date" value={f.expires_at} onChange={v => set({ ...f, expires_at: v })} width={200} />
        <Field label="Note" value={f.note} onChange={v => set({ ...f, note: v })} placeholder="Black Friday" width={220} />
      </div>
      <Tick label="Monthly billing only (stops a big discount giving a cheap year)" checked={f.monthly_only} onChange={v => set({ ...f, monthly_only: v })} />
      <Tick label="New customers only (people who have paid before cannot use it)" checked={f.new_customers_only} onChange={v => set({ ...f, new_customers_only: v })} />
    </>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h2 style={sectionTitle}>Discount codes</h2>
        <button style={buttonPrimary} disabled={api.busy} onClick={() => { setAdding(!adding); api.setMessage(null) }}>{adding ? 'Close' : 'Make a code'}</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Money off at checkout. People type these in the Code box on Plans. Creators&apos; commission codes show here too: change their discount here, and their commission on the Creators tab.
      </p>
      <Notice message={api.message} />
      {api.error && <Notice message={{ text: api.error, bad: true }} />}

      {adding && (
        <div style={{ ...card, marginBottom: 24, display: 'grid', gap: 14 }}>
          {formFields(form, setForm, true)}
          <div><button style={buttonPrimary} disabled={api.busy || !form.code.trim()} onClick={async () => { const d = await api.post({ action: 'create', fields: form }); if (d) { api.setMessage({ text: `${d.code} works now.` }); setForm(blank); setAdding(false) } }}>Save code</button></div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search codes or notes" aria-label="Search codes"
        style={{ width: '100%', maxWidth: 320, padding: '9px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />

      {!api.data && !api.error && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading…</p>}
      {api.data && codes.length === 0 && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No codes found.</p>}

      <div style={{ display: 'grid', gap: 10 }}>
        {codes.map(c => {
          const [label, bg, fg] = status(c)
          const isEditing = editing === c.code
          return (
            <div key={c.code} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, background: 'var(--sand)', padding: '2px 8px', borderRadius: 4 }}>{c.code}</span>
                    <span style={pill(bg, fg)}>{label}</span>
                    {c.creator && <span style={pill('var(--sand)', 'var(--ink)')}>Creator: {c.creator}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                    {c.percent_off}% off {c.months && c.months > 1 ? `the first ${c.months} months` : 'the first month'}, {planWord(c.plans)}
                    {c.monthly_only ? ', monthly billing only' : ''}{c.new_customers_only ? ', new customers only' : ''}.
                    {c.expires_at ? ` Works until ${shortDate(c.expires_at)}.` : ''}{c.note && !c.creator ? ` ${c.note}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}><div style={smallLabel}>Used</div><div style={{ fontSize: 16, fontWeight: 600 }}>{c.uses}{c.max_uses != null ? ` of ${c.max_uses}` : ''}</div></div>
                  <button style={{ ...buttonSecondary, ...small }} onClick={() => {
                    if (isEditing) { setEditing(null); return }
                    setEditing(c.code)
                    setEdit({ code: c.code, percent_off: String(c.percent_off), months: String(c.months || 1), monthly_only: c.monthly_only, new_customers_only: c.new_customers_only, plans: !c.plans || !c.plans.length ? 'any' : c.plans[0], max_uses: c.max_uses != null ? String(c.max_uses) : '', expires_at: dayOf(c.expires_at), note: c.note || '' })
                  }}>{isEditing ? 'Cancel' : 'Edit'}</button>
                  <button style={{ ...buttonSecondary, ...small }} disabled={api.busy} onClick={() => api.post({ action: 'update', code: c.code, fields: { active: !c.active } }, c.active ? `${c.code} turned off.` : `${c.code} turned on.`)}>{c.active ? 'Turn off' : 'Turn on'}</button>
                </div>
              </div>
              {isEditing && (
                <div style={{ display: 'grid', gap: 14, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                  {formFields(edit, setEdit, false)}
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Changes apply to people who use the code from now on.</p>
                  <div><button style={buttonPrimary} disabled={api.busy} onClick={async () => { const { code: _code, ...fields } = edit; void _code; if (await api.post({ action: 'update', code: c.code, fields }, 'Saved.')) setEditing(null) }}>Save</button></div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
