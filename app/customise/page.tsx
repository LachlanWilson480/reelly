'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function CustomisePage() {
  const router = useRouter()
  const [guidance, setGuidance] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [plan, setPlan] = useState<'basic' | 'mid'>('mid')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      const user = sessionData.user

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('business_profiles')
        .select('custom_guidance')
        .eq('user_id', user.id)
        .maybeSingle()

      setGuidance(data?.custom_guidance || '')

      const { data: subData } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (subData && subData.status === 'active' && subData.plan === 'basic') {
        setPlan('basic')
      } else {
        setPlan('mid')
      }

      setLoading(false)
    }
    load()
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    const { data: sessionData } = await supabase.auth.getUser()
    const user = sessionData.user
    if (!user) return

    const { error } = await supabase
      .from('business_profiles')
      .update({ custom_guidance: guidance })
      .eq('user_id', user.id)

    setSaving(false)
    setMessage(error ? 'Something went wrong saving your guidance.' : 'Saved.')
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)', padding: '48px', maxWidth: 700, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
          Customise generation
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
          Add pointers for how Reelezy should generate your ideas and filming instructions  -  things you like, things to avoid, specific angles or phrases you prefer. This is applied on top of your business profile and Reelezy's core safety and realism guidelines, which always stay in place.
        </p>

        {plan === 'basic' ? (
          <div style={{ background: 'var(--sand)', borderRadius: 12, padding: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🔒</p>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 10 }}>
              Custom guidance is a Pro plan feature
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              Upgrade to Pro to give Reelezy your own style pointers  -  preferred tone, filming preferences, and things to avoid  -  applied to every idea and checklist it generates for you.
            </p>
            
            <a href="/plans"
              style={{ display: 'inline-block', backgroundColor: 'var(--coral)', color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
            >
              Upgrade to Pro
            </a>
          </div>
        ) : (
          <>
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              rows={10}
              placeholder="e.g. I prefer filming outside near the van. Avoid suggesting anything involving client faces. I like a cheeky, confident tone."
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 8,
                border: '1px solid rgba(128,128,128,0.25)',
                background: 'var(--sand)',
                fontSize: 14,
                fontFamily: "'Inter', sans-serif",
                color: 'var(--ink)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                marginBottom: 16,
              }}
            />

            <button
              onClick={handleSave}
              disabled={saving}
              style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Save guidance'}
            </button>
            {message && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>{message}</p>}
          </>
        )}
      </div>
    </div>
  )
}
