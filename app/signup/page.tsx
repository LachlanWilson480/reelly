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
  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
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
        data: { email_confirm: true },
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

            {message !== 'check-email' && <>
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
            </>}

            {message !== 'check-email' && <form onSubmit={handleSignUp}>
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
            </form>}

            {message === 'check-email' ? (
              <div style={{ padding: '8px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>📬</div>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#F1EFE8', textAlign: 'center' }}>Check your email</h2>
                <p style={{ fontSize: 14, color: 'rgba(241,239,232,0.75)', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
                  We sent a 6-digit code to <strong>{email}</strong>
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
                  {[0,1,2,3,4,5].map((i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otp[i] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        const newOtp = otp.split('')
                        newOtp[i] = val
                        const joined = newOtp.join('').slice(0, 6)
                        setOtp(joined)
                        if (val && i < 5) {
                          const next = document.getElementById(`otp-${i+1}`)
                          if (next) (next as HTMLInputElement).focus()
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otp[i] && i > 0) {
                          const prev = document.getElementById(`otp-${i-1}`)
                          if (prev) (prev as HTMLInputElement).focus()
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault()
                        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                        setOtp(pasted)
                        const next = document.getElementById(`otp-${Math.min(pasted.length, 5)}`)
                        if (next) (next as HTMLInputElement).focus()
                      }}
                      style={{ width: 44, height: 56, borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', fontSize: 24, fontFamily: "'Inter', sans-serif", outline: 'none', color: '#F1EFE8', textAlign: 'center', fontWeight: 700 }}
                    />
                  ))}
                </div>
                <button
                  onClick={async () => {
                    if (otp.length !== 6) return
                    setVerifying(true)
                    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' })
                    setVerifying(false)
                    if (error) {
                      setMessage(error.message)
                    } else {
                      window.location.href = '/onboarding'
                    }
                  }}
                  disabled={otp.length !== 6 || verifying}
                  style={{ width: '100%', padding: '13px', borderRadius: 8, border: 'none', backgroundColor: 'var(--coral)', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: otp.length !== 6 || verifying ? 'not-allowed' : 'pointer', opacity: otp.length !== 6 || verifying ? 0.6 : 1 }}
                >
                  {verifying ? 'Verifying...' : 'Confirm account'}
                </button>
                <p style={{ fontSize: 12, color: 'rgba(241,239,232,0.4)', textAlign: 'center', marginTop: 12 }}>
                  Didn&apos;t get it? Check your spam folder.
                </p>
                <button
                  type="button"
                  onClick={() => { setMessage(''); setOtp('') }}
                  style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: 'var(--coral)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  ← Back to email options
                </button>
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
