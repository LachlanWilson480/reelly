'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'

const KEY = 'reelezy-ref'
const clean = (v: unknown) => {
  const c = typeof v === 'string' ? v.trim().toUpperCase() : ''
  return /^[A-Z0-9]{4,12}$/.test(c) ? c : ''
}

// Remembers a friend's referral link (?ref=CODE) and, once the new user is signed in, links them to that friend.
export default function ReferralTracker() {
  useEffect(() => {
    try {
      const fromUrl = clean(new URLSearchParams(window.location.search).get('ref'))
      if (fromUrl) localStorage.setItem(KEY, fromUrl)
    } catch {}

    const tryClaim = async (userId: string | undefined, metaCode: unknown) => {
      if (!userId) return
      const doneKey = `${KEY}-done:${userId}`
      let stored = ''
      try {
        if (localStorage.getItem(doneKey)) return
        stored = clean(localStorage.getItem(KEY))
      } catch {}
      const code = stored || clean(metaCode)
      if (!code) return
      try {
        if (sessionStorage.getItem(`${KEY}-tried`) === code) return
        sessionStorage.setItem(`${KEY}-tried`, code)
      } catch {}
      const res = await authFetch('/api/referral/claim', { method: 'POST', body: JSON.stringify({ code }) }).catch(() => null)
      if (res && res.status < 500) {
        try { localStorage.removeItem(KEY); localStorage.setItem(doneKey, '1') } catch {}
      }
    }

    supabase.auth.getSession().then(({ data }) => tryClaim(data.session?.user.id, data.session?.user.user_metadata?.referral_code)).catch(() => {})
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      tryClaim(session?.user.id, session?.user.user_metadata?.referral_code)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  return null
}
