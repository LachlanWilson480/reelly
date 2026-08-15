'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

type Profile = {
  business_name: string
  industry: string
  suburb: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('business_profiles')
        .select('business_name, industry, suburb')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!data) {
        router.push('/onboarding')
        return
      }

      setProfile(data)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 56 }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <a href="/" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            Reelly
          </a>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ background: 'none', border: 'none', fontSize: 14, color: '#777', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          >
            Log out
          </button>
        </nav>

        <div style={{ padding: '0 48px 48px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 24, padding: '48px 36px', marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 600, color: '#F1EFE8', marginBottom: 4 }}>
              Welcome back, {profile?.business_name}
            </h1>
            <p style={{ fontSize: 15, color: '#D3D1C7' }}>
              {profile?.industry} · {profile?.suburb}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px' }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Content ideas
              </h3>
              <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>
                AI-generated video ideas, titles, and filming steps for {profile?.suburb} businesses. Coming soon.
              </p>
            </div>
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px' }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Upload & edit
              </h3>
              <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>
                Upload clips and get them stitched with captions and sound. Coming soon.
              </p>
            </div>
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px' }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Schedule
              </h3>
              <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>
                Plan and post across Instagram and Facebook. Coming soon.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
