'use client'

import { useEffect, useState } from 'react'
import type { Currency } from './pricing'

const valid = (c: unknown): c is Currency => c === 'AUD' || c === 'USD' || c === 'GBP'

// Currency follows where the visitor is, not which domain they opened. Returns null until it is known,
// so a price is never shown in the wrong currency first. If location is unavailable it falls back to the domain.
export function useCurrency(): Currency | null {
  const [currency, setCurrency] = useState<Currency | null>(null)
  useEffect(() => {
    let cancelled = false
    const byDomain = (): Currency => (window.location.hostname.endsWith('.co.uk') ? 'GBP' : 'AUD')
    fetch('/api/geo', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => { if (!cancelled) setCurrency(valid(g?.currency) ? g.currency : byDomain()) })
      .catch(() => { if (!cancelled) setCurrency(byDomain()) })
    return () => { cancelled = true }
  }, [])
  return currency
}
