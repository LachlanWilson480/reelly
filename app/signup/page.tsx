'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSigningUp) return

    if (!agreedToTerms) {
      setMessage('Please confirm you agree to the Terms of Service.')
      return
    }

    setMessage('')
    setIsSigningUp(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    })

    setIsSigningUp(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Check your email. We’ve sent you a confirmation link.')
  }

  const handleGoogleSignUp = async () => {
    if (!agreedToTerms) {
      setMessage('Please confirm you agree to the Terms of Service.')
      return
    }
    localStorage.setItem('reelezy-has-logged-in', 'true')
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.08)',
    fontSize: 14,
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    boxSizing: 'border-box' as const,
    color: '#F1EFE8',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        fontFamily: "'Inter', sans-serif",
        color: 'var(--ink)',
      }}
    >
      <Sidebar />

      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav
          className="site-nav"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '24px 48px',
          }}
        >
          <Link
            href="/"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--ink)',
              textDecoration: 'none',
            }}
          >
            Reelezy
          </Link>

          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <Link
              href="/login"
              style={{
                color: 'var(--ink)',
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Log in
            </Link>
          </div>
        </nav>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
          }}
        >
          <div
            className="auth-card"
            style={{
              background: 'linear-gradient(135deg, #26215C, #712B13)',
              borderRadius: 24,
              padding: '48px 40px',
              maxWidth: 400,
              width: '100%',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            }}
          >
            <h1
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 26,
                fontWeight: 600,
                color: '#F1EFE8',
                marginBottom: 8,
              }}
            >
              Sign up for Reelezy
            </h1>

            <p
              style={{
                fontSize: 14,
                color: '#D3D1C7',
                marginBottom: 28,
              }}
            >
              Create your account to get started.
            </p>

            <button
              type="button"
              onClick={handleGoogleSignUp}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)', color: '#F1EFE8', fontSize: 14, fontWeight: 600, fontFamily: "'Inter', sans-serif", cursor: 'pointer', marginBottom: 20 }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ fontSize: 12, color: '#D3D1C7' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
            </div>

            <form onSubmit={handleSignUp}>
              <div style={{ marginBottom: 16 }}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSigningUp}
                  style={{
                    ...inputStyle,
                    opacity: isSigningUp ? 0.7 : 1,
                  }}
                />
              </div>

              <div
                style={{
                  marginBottom: 24,
                  position: 'relative',
                }}
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSigningUp}
                  style={{
                    ...inputStyle,
                    padding: '12px 44px 12px 14px',
                    opacity: isSigningUp ? 0.7 : 1,
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSigningUp}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    fontSize: 12,
                    color: '#D3D1C7',
                    cursor: isSigningUp ? 'default' : 'pointer',
                    opacity: isSigningUp ? 0.5 : 1,
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginBottom: 20,
                  fontSize: 13,
                  color: '#D3D1C7',
                  lineHeight: 1.5,
                  cursor: isSigningUp ? 'default' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  disabled={isSigningUp}
                  style={{ marginTop: 2 }}
                />
                <span>
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--coral)', fontWeight: 600 }}
                  >
                    Terms of Service
                  </Link>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={isSigningUp || !agreedToTerms}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'var(--coral)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "'Outfit', sans-serif",
                  cursor: isSigningUp ? 'wait' : !agreedToTerms ? 'not-allowed' : 'pointer',
                  opacity: isSigningUp || !agreedToTerms ? 0.7 : 1,
                  transition: 'opacity 0.15s ease',
                }}
              >
                {isSigningUp ? 'Creating account...' : 'Sign up'}
              </button>
            </form>

            {message && (
              <p
                style={{
                  marginTop: 20,
                  fontSize: 13,
                  color: '#F1EFE8',
                  textAlign: 'center',
                  lineHeight: 1.5,
                }}
              >
                {message}
              </p>
            )}

            <p
              style={{
                marginTop: 20,
                fontSize: 13,
                color: '#D3D1C7',
                textAlign: 'center',
              }}
            >
              Already have an account?{' '}
              <Link
                href="/login"
                style={{
                  color: 'var(--coral)',
                  fontWeight: 600,
                }}
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
