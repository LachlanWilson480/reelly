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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSigningUp) return

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

      <div style={{ marginLeft: 56 }}>
        <nav
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
            Reelly
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
              Sign up for Reelly
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

              <button
                type="submit"
                disabled={isSigningUp}
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
                  cursor: isSigningUp ? 'wait' : 'pointer',
                  opacity: isSigningUp ? 0.7 : 1,
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
