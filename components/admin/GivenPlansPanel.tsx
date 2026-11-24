'use client'

import { useState } from 'react'
import { buttonPrimary, buttonSecondary, card, sectionTitle } from '@/lib/ui'
import { useAdminApi, Notice, Field, Pick, row, small, pill, shortDate } from './shared'

type Given = { user_id: string; email: string; business: string | null; plan: string; until: string; running: boolean; creator: boolean }

export default function GivenPlansPanel() {
  const api = useAdminApi<{ plans: Given[] }>('/api/admin/given-plans')
  const [form, setForm] = useState({ email: '', plan: 'pro', months: '1' })
  const [showEnded, setShowEnded] = useState(false)
  const plans = (api.data?.plans || []).filter(p => showEnded || p.running)

  return (
    <div>
      <h2 style={{ ...sectionTitle, marginBottom: 8 }}>Given plans</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Give someone Basic or Pro for free, for example a pilot tester or a friend. They need a Reelezy account first. Months count from today, and giving again replaces the end date. Nothing is charged, and when it ends they go back to the Free plan.
      </p>
      <Notice message={api.message} />
      {api.error && <Notice message={{ text: api.error, bad: true }} />}

      <div style={{ ...card, marginBottom: 24, display: 'grid', gap: 14 }}>
        <div style={row}>
          <Field label="Their account email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="name@business.com" width={260} />
          <Pick label="Plan" value={form.plan} onChange={v => setForm({ ...form, plan: v })} options={[['pro', 'Pro'], ['basic', 'Basic']]} />
          <Field label="Months" type="number" value={form.months} onChange={v => setForm({ ...form, months: v })} width={100} />
        </div>
        <div><button style={buttonPrimary} disabled={api.busy || !form.email.includes('@')} onClick={async () => { if (await api.post({ action: 'give', ...form })) setForm({ ...form, email: '' }) }}>Give plan</button></div>
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showEnded} onChange={e => setShowEnded(e.target.checked)} style={{ accentColor: 'var(--coral)' }} /> Show ended plans too
      </label>
      {!api.data && !api.error && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading…</p>}
      {api.data && plans.length === 0 && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No given plans running.</p>}

      <div style={{ display: 'grid', gap: 10 }}>
        {plans.map(p => (
          <div key={p.user_id} style={{ ...card, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', opacity: p.running ? 1 : 0.6 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{p.business || p.email}</span>
                <span style={pill(p.running ? 'var(--coral)' : 'var(--line)', p.running ? '#fff' : 'var(--text-secondary)')}>{p.plan}</span>
                {p.creator && <span style={pill('var(--sand)', 'var(--ink)')}>Creator account</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{p.business ? `${p.email}. ` : ''}{p.running ? 'Until' : 'Ended'} {shortDate(p.until)}.</div>
            </div>
            {p.running && (
              <button style={{ ...buttonSecondary, ...small }} disabled={api.busy} onClick={() => { if (confirm(`End ${p.business || p.email}'s free plan now? They go back to the Free plan.`)) api.post({ action: 'end', email: p.email }) }}>End now</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
