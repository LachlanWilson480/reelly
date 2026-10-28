'use client'

import Link from 'next/link'
import { ReelezyLogo } from '@/components/ReelezyLogo'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (error) {
      setMessage(error.message)
    } else {
      setSent(true)
    }
  }

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 4, border: '1px solid var(--line)', background: '#FFFFFF', fontSize: 14, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' as const, color: 'var(--ink)' }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 4, padding: '48px 40px', maxWidth: 400, width: '100%', boxShadow: 'none' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: 24 }}><ReelezyLogo size={44} /></Link>
        <h1 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 26, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
          Reset your password
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 28 }}>
          {sent ? "Check your email for a reset link." : "Enter your email and we'll send you a reset link."}
        </p>

        {!sent ? (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ ...inputStyle, marginBottom: 20 }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '13px', borderRadius: 4, border: 'none', backgroundColor: 'var(--coral)', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            {message && <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink)', textAlign: 'center' }}>{message}</p>}
          </form>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Didn't get it? Check your spam folder or try again.</p>
            <button onClick={() => { setSent(false); setEmail('') }} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '10px 20px', color: 'var(--ink)', fontSize: 13, cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        )}

        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
          <Link href="/login" style={{ color: 'var(--coral)', fontWeight: 600 }}>Back to log in</Link>
        </p>
      </div>
    </div>
  )
}
