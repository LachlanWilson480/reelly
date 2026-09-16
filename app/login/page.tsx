'use client'

import Link from 'next/link'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage(error.message)
      return
    }

    const user = signInData.user

    const { data: profile } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    localStorage.setItem('reelezy-has-logged-in', 'true')

    if (profile) {
      router.push('/dashboard')
    } else {
      router.push('/onboarding')
    }
  }

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', fontSize: 14, fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' as const, color: '#F1EFE8' }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <Link href="/" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            Reelezy
          </Link>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Sign up
            </Link>
          </div>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 24, padding: '48px 40px', maxWidth: 400, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 600, color: '#F1EFE8', marginBottom: 8 }}>
              Log in to Reelezy
            </h1>
            <p style={{ fontSize: 14, color: '#D3D1C7', marginBottom: 28 }}>
              Welcome back.
            </p>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 24, position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ ...inputStyle, padding: '12px 44px 12px 14px' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 12, color: '#D3D1C7', cursor: 'pointer' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <button type="submit" style={{ width: '100%', padding: '13px', borderRadius: 8, border: 'none', backgroundColor: 'var(--coral)', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}>
                Log in
              </button>
            </form>
            {message && (
              <p style={{ marginTop: 20, fontSize: 13, color: '#F1EFE8', textAlign: 'center' }}>
                {message}
              </p>
            )}
            <p style={{ marginTop: 20, fontSize: 13, color: '#D3D1C7', textAlign: 'center' }}>
              Don&apos;t have an account?{' '}
              <Link href="/signup" style={{ color: 'var(--coral)', fontWeight: 600 }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
