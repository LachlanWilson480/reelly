'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { mountGoogleButton } from '@/lib/googleSignIn'

export default function SignUpPage() {
  const router = useRouter()
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

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setIsSigningUp(false)

    if (signUpError) {
      setMessage(signUpError.message)
      return
    }

    setMessage('check-email')
  }

  const googleButtonRef = useRef<HTMLDivElement>(null)
  const agreedRef = useRef(false)

  useEffect(() => {
    agreedRef.current = agreedToTerms
  }, [agreedToTerms])

  useEffect(() => {
    const container = googleButtonRef.current
    if (!container) return
    mountGoogleButton({
      container,
      onCredential: async (idToken, rawNonce) => {
        if (!agreedRef.current) {
          setMessage('Please confirm you agree to the Terms of Service.')
          return
        }
        setMessage('')
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          nonce: rawNonce,
        })
        if (error || !data.user) {
          setMessage(error?.message || 'Google sign-in failed. Please try again.')
          return
        }
        const { data: profile } = await supabase
          .from('business_profiles')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle()
        localStorage.setItem('reelezy-has-logged-in', 'true')
        router.push(profile ? '/dashboard' : '/onboarding')
      },
    }).catch((err) => setMessage(err instanceof Error ? err.message : 'Could not load Google sign-in.'))
  }, [router])

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

            <div style={{ position: 'relative', marginBottom: 8, minHeight: 44 }}>
              <div ref={googleButtonRef} style={{ display: 'flex', justifyContent: 'center', opacity: agreedToTerms ? 1 : 0.5, transition: 'opacity 0.15s ease' }} />
              {!agreedToTerms && (
                <div
                  onClick={() => setMessage('Please confirm you agree to the Terms of Service.')}
                  style={{ position: 'absolute', inset: 0, cursor: 'not-allowed' }}
                />
              )}
            </div>
            <p style={{ fontSize: 13, color: '#D3D1C7', textAlign: 'center', lineHeight: 1.5, marginBottom: 20 }}>
              {agreedToTerms
                ? 'Continue with Google, or use your email below.'
                : 'Agree to the Terms of Service below to continue with Google.'}
            </p>
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
                  {' '}and{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--coral)', fontWeight: 600 }}
                  >
                    Privacy Policy
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

            {message === 'check-email' ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10, color: '#F1EFE8' }}>Check your email</h2>
                <p style={{ fontSize: 14, color: 'rgba(241,239,232,0.75)', lineHeight: 1.6, marginBottom: 6 }}>
                  We sent a confirmation link to <strong>{email}</strong>
                </p>
                <p style={{ fontSize: 12, color: 'rgba(241,239,232,0.5)' }}>
                  Click the link to confirm your account and get started.
                </p>
              </div>
            ) : message ? (
              <p style={{ marginTop: 20, fontSize: 13, color: '#F1EFE8', textAlign: 'center', lineHeight: 1.5 }}>
                {message}
              </p>
            ) : null}

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
