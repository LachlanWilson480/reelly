'use client'

import { useState } from 'react'
import { buttonPrimary, buttonSecondary, card, sectionTitle } from '@/lib/ui'
import { useAdminApi, Notice, Field, Pick, Stat, Tick, row, small, pill, shortDate } from './shared'

type Account = {
  id: string; code: string; name: string | null; note: string | null; plan: 'basic' | 'top'; months: number; active: boolean
  redeemed_by: string | null; redeemed_at: string | null; ends_at: string | null; created_at: string
  email: string | null; business: string | null; state: 'waiting' | 'running' | 'ended' | 'off'
}

const STATE: Record<Account['state'], [string, string, string]> = {
  waiting: ['Not used yet', 'var(--sand)', 'var(--ink)'],
  running: ['Running', 'var(--coral)', '#fff'],
  ended: ['Ended', 'var(--line)', 'var(--text-secondary)'],
  off: ['Turned off', 'var(--line)', 'var(--text-secondary)'],
}
const blank = { code: '', name: '', note: '', plan: 'top', months: '3', randomEnding: true }

export default function CreatorAccountsPanel() {
  const api = useAdminApi<{ accounts: Account[] }>('/api/admin/creator-accounts')
  const [form, setForm] = useState(blank)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'all' | Account['state']>('all')
  const accounts = api.data?.accounts || []
  const count = (s: Account['state']) => accounts.filter(a => a.state === s).length
  const shown = filter === 'all' ? accounts : accounts.filter(a => a.state === filter)

  async function create() {
    const d = await api.post({ action: 'create', ...form })
    if (d) { api.setMessage({ text: `Code ${d.code} is ready. Send it to them: they make a free account, go to Plans and type it in the Code box.` }); setForm(blank); setAdding(false) }
  }

  const copy = (text: string) => { try { navigator.clipboard.writeText(text); api.setMessage({ text: 'Copied.' }) } catch {} }
  const inviteText = (a: Account) => `Hi${a.name ? ` ${a.name}` : ''}! Here's your Reelezy creator account: ${a.months} month${a.months === 1 ? '' : 's'} of ${a.plan === 'top' ? 'Pro' : 'Basic'} free. 1. Make a free account at reelezy.com 2. Go to Plans 3. Type ${a.code} in the Code box. The code works once, only for you.`

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h2 style={sectionTitle}>Creator accounts</h2>
        <button style={buttonPrimary} disabled={api.busy} onClick={() => { setAdding(!adding); api.setMessage(null) }}>{adding ? 'Close' : 'Make a creator code'}</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        A small business gets Reelezy free for the months you set, in return for posting content. They make a free account, go to Plans and type their code in the Code box. Each code works once, then belongs to that account. The Made with Reelezy badge stays on all their videos while it runs.
      </p>

      <Notice message={api.message} />
      {api.error && <Notice message={{ text: api.error, bad: true }} />}

      {adding && (
        <div style={{ ...card, marginBottom: 24, display: 'grid', gap: 16 }}>
          <div style={row}>
            <Field label="Code" value={form.code} onChange={v => setForm({ ...form, code: v })} placeholder="DAVEYSBARBER" hint="Their handle works well. Letters and numbers only." />
            <Field label="Who it's for" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Davey's Barber" />
          </div>
          <div style={row}>
            <Pick label="Plan" value={form.plan} onChange={v => setForm({ ...form, plan: v })} options={[['top', 'Pro'], ['basic', 'Basic']]} />
            <Field label="Months free" type="number" value={form.months} onChange={v => setForm({ ...form, months: v })} width={120} />
            <Field label="Note" value={form.note} onChange={v => setForm({ ...form, note: v })} placeholder="@daveysbarber, 2 reels a month" width={260} />
          </div>
          <Tick label="Add a random ending, like DAVEYSBARBER-K7Q2, so nobody can guess it from their handle (recommended)" checked={form.randomEnding} onChange={v => setForm({ ...form, randomEnding: v })} />
          <div><button style={buttonPrimary} disabled={api.busy || !form.code.trim()} onClick={create}>Make code</button></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>
        <Stat label="Running" value={count('running')} />
        <Stat label="Not used yet" value={count('waiting')} />
        <Stat label="Ended" value={count('ended')} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['all', 'running', 'waiting', 'ended', 'off'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...buttonSecondary, ...small, padding: '5px 12px', background: filter === f ? 'var(--ink)' : 'var(--card-bg)', color: filter === f ? 'var(--background)' : 'var(--ink)' }}>
            {f === 'all' ? 'All' : STATE[f][0]}
          </button>
        ))}
      </div>

      {!api.data && !api.error && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading…</p>}
      {api.data && shown.length === 0 && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{accounts.length ? 'Nothing here.' : 'No creator codes yet. Make your first one above.'}</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {shown.map(a => {
          const [label, bg, fg] = STATE[a.state]
          const isEditing = editing === a.id
          return (
            <div key={a.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, background: 'var(--sand)', padding: '2px 8px', borderRadius: 4 }}>{a.code}</span>
                    <span style={pill(bg, fg)}>{label}</span>
                    {a.name && <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{a.name}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                    {a.plan === 'top' ? 'Pro' : 'Basic'} for {a.months} month{a.months === 1 ? '' : 's'}.
                    {a.redeemed_at ? ` Used by ${a.business || a.email || 'an account'}${a.business && a.email ? ` (${a.email})` : ''} on ${shortDate(a.redeemed_at)}. ${a.state === 'running' ? 'Runs until' : 'Ended'} ${shortDate(a.ends_at)}.` : ` Made ${shortDate(a.created_at)}.`}
                    {a.note ? ` ${a.note}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {a.state === 'waiting' && <button style={{ ...buttonSecondary, ...small }} onClick={() => copy(inviteText(a))}>Copy invite</button>}
                  <button style={{ ...buttonSecondary, ...small }} onClick={() => { if (isEditing) { setEditing(null); return } setEditing(a.id); setEdit({ code: a.code, name: a.name || '', note: a.note || '', plan: a.plan, months: String(a.months), extra: '1' }) }}>{isEditing ? 'Cancel' : 'Edit'}</button>
                  {a.state === 'running' && <button style={{ ...buttonSecondary, ...small }} disabled={api.busy} onClick={() => { if (confirm(`End ${a.name || a.code}'s creator account now? They go back to the Free plan.`)) api.post({ action: 'end', id: a.id }, 'Creator account ended.') }}>End now</button>}
                  {(a.state === 'waiting' || a.state === 'off') && <button style={{ ...buttonSecondary, ...small }} disabled={api.busy} onClick={() => api.post({ action: 'update', id: a.id, fields: { active: !a.active } }, a.active ? 'Code turned off. Nobody can use it until you turn it back on.' : 'Code turned back on.')}>{a.active ? 'Turn off' : 'Turn on'}</button>}
                  {!a.redeemed_by && <button style={{ ...buttonSecondary, ...small }} disabled={api.busy} onClick={() => { if (confirm(`Delete the code ${a.code}?`)) api.post({ action: 'delete', id: a.id }, 'Code deleted.') }}>Delete</button>}
                </div>
              </div>
              {isEditing && (
                <div style={{ display: 'grid', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                  <div style={row}>
                    {!a.redeemed_by && <Field label="Code" value={edit.code} onChange={v => setEdit({ ...edit, code: v })} />}
                    <Field label="Who it's for" value={edit.name} onChange={v => setEdit({ ...edit, name: v })} />
                    <Field label="Note" value={edit.note} onChange={v => setEdit({ ...edit, note: v })} width={240} />
                  </div>
                  {!a.redeemed_by && (
                    <div style={row}>
                      <Pick label="Plan" value={edit.plan} onChange={v => setEdit({ ...edit, plan: v })} options={[['top', 'Pro'], ['basic', 'Basic']]} />
                      <Field label="Months free" type="number" value={edit.months} onChange={v => setEdit({ ...edit, months: v })} width={120} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <button style={buttonPrimary} disabled={api.busy} onClick={async () => { if (await api.post({ action: 'update', id: a.id, fields: edit }, 'Saved.')) setEditing(null) }}>Save</button>
                    {a.redeemed_by && (
                      <>
                        <div style={{ width: 120 }}><Field label="Add months" type="number" value={edit.extra} onChange={v => setEdit({ ...edit, extra: v })} width={100} /></div>
                        <button style={buttonSecondary} disabled={api.busy} onClick={async () => { if (await api.post({ action: 'extend', id: a.id, months: edit.extra }, 'Months added.')) setEditing(null) }}>Add months</button>
                      </>
                    )}
                  </div>
                  {a.redeemed_by && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>This code has been used, so its code, plan and months stay as they were. Add months to give them more time.</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
