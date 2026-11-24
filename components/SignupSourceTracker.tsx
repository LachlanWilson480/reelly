'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { readSource, saveSource, cleanFrom, SOURCE_KEY } from '@/lib/signupSource'

// Remembers where a visitor first came from (?from=, ?utm_source= or another website), and once a NEW account
// signs in (Google sign-in skips the sign-up form's save), copies that and the "How did you hear" answer onto it.
export default function SignupSourceTracker() {
  useEffect(() => {
    try {
      if (!readSource().from) {
        const q = new URLSearchParams(window.location.search)
        let from = cleanFrom(q.get('from')) || (q.get('utm_source') ? cleanFrom(`utm:${q.get('utm_source')}`) : '')
        if (!from && document.referrer) {
          const host = new URL(document.referrer).hostname.replace(/^www\./, '')
          if (host && !/reelezy\./.test(host) && host !== window.location.hostname) from = cleanFrom(`site:${host}`)
        }
        if (from) saveSource({ from })
      }
    } catch {}

    const sync = async (user: { id: string; created_at?: string; user_metadata?: Record<string, unknown> } | undefined) => {
      if (!user) return
      const doneKey = `${SOURCE_KEY}-done:${user.id}`
      try { if (localStorage.getItem(doneKey)) return } catch { return }
      // Only accounts made in the last day, so existing customers are never tagged by a later visit
      const age = Date.now() - new Date(user.created_at || 0).getTime()
      const meta = user.user_metadata || {}
      const saved = readSource()
      const data: Record<string, string> = {}
      if (age < 24 * 60 * 60 * 1000) {
        if (!meta.heard_about && saved.heard) data.heard_about = saved.heard
        if (!meta.signup_from && saved.from) data.signup_from = saved.from
      }
      if (Object.keys(data).length) {
        const { error } = await supabase.auth.updateUser({ data })
        if (error) return
      }
      try { localStorage.setItem(doneKey, '1') } catch {}
    }

    supabase.auth.getSession().then(({ data }) => sync(data.session?.user)).catch(() => {})
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => { sync(session?.user) })
    return () => listener.subscription.unsubscribe()
  }, [])

  return null
}
