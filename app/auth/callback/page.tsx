'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile) {
        router.push('/dashboard')
      } else {
        router.push('/onboarding')
      }
    }
    handleCallback()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />
  )
}
