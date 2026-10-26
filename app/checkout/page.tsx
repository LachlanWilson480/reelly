import { Suspense } from 'react'
import type { Metadata } from 'next'
import CheckoutClient from './CheckoutClient'

export const metadata: Metadata = { title: 'Checkout - Reelezy' }

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--background)' }} />}>
      <CheckoutClient />
    </Suspense>
  )
}
