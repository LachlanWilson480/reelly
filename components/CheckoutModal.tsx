'use client'

import { useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function PaymentForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError('')

    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (result.error) {
      setError(result.error.message || 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    if (result.paymentIntent && result.paymentIntent.status !== 'succeeded' && result.paymentIntent.status !== 'processing') {
      setError(`Payment status: ${result.paymentIntent.status}. Please try again.`)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p style={{ fontSize: 13, color: 'var(--coral)', marginTop: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          type="button"
          onClick={onClose}
          style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'none', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || submitting}
          style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', backgroundColor: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Processing...' : 'Subscribe'}
        </button>
      </div>
    </form>
  )
}

export default function CheckoutModal({ plan, planLabel, billingInterval, discountCode, discountPercent, onClose, onSuccess }: { plan: string; planLabel: string; billingInterval?: 'monthly' | 'yearly'; discountCode?: string; discountPercent?: number | null; onClose: () => void; onSuccess: () => void }) {
  const [clientSecret, setClientSecret] = useState('')
  const [error, setError] = useState('')
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const start = async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      const user = sessionData.user
      if (!user) {
        setError('You must be logged in.')
        return
      }

      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email, plan, billingInterval: billingInterval || 'monthly', discountCode: discountCode || null }),
      })

      const data = await res.json()
      if (!res.ok || !data.clientSecret) {
        setError(data.error || 'Failed to start checkout.')
        return
      }

      setClientSecret(data.clientSecret)
    }
    start()
  }, [plan, billingInterval])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--card-bg)', borderRadius: 20, padding: '32px', maxWidth: 440, width: '100%' }}
      >
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          Subscribe to {planLabel}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Enter your payment details to start your subscription.
        </p>
        <div style={{ background: 'var(--sand)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{planLabel} plan · {billingInterval === 'yearly' ? 'billed annually' : 'billed monthly'}</p>
            {discountCode && <p style={{ fontSize: 11, color: 'var(--coral)' }}>Discount applied</p>}
          </div>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
            {(() => {
              const base = planLabel === 'Pro'
                ? (billingInterval === 'yearly' ? 57.50 : 69)
                : (billingInterval === 'yearly' ? 29.17 : 35)
              const final = discountPercent ? base * (1 - discountPercent / 100) : base
              return `$${final.toFixed(2)}`
            })()}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
          </p>
        </div>

        {error && (
          <>
            <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: error === 'You must be logged in.' ? 12 : 0 }}>{error}</p>
            {error === 'You must be logged in.' && (
              <a
                href="/login"
                style={{ display: 'inline-block', fontSize: 13, color: '#fff', background: 'var(--coral)', padding: '10px 18px', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}
              >
                Go to login →
              </a>
            )}
          </>
        )}

        {!error && !clientSecret && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading payment form...</p>
        )}

        {clientSecret && (
          <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm onSuccess={onSuccess} onClose={onClose} />
          </Elements>
        )}
      </div>
    </div>
  )
}
