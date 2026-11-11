'use client'

import { useEffect, useState } from 'react'
import { CURRENCY_PRICES, currencyForHost, type Currency } from './pricing'

const valid = (c: unknown): c is Currency => typeof c === 'string' && c in CURRENCY_PRICES

// On the .co.uk site this is always GBP. Elsewhere it is null.
export function useDomainCurrency(): Currency | null {
  const [c, setC] = useState<Currency | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setC(currencyForHost(window.location.hostname)), 0)
    return () => clearTimeout(t)
  }, [])
  return c
}

// Currency follows where the visitor is, except on the .co.uk site, which is always GBP. Returns null until it is known,
// so a price is never shown in the wrong currency first. If location is unavailable it falls back to the domain.
export function useCurrency(): Currency | null {
  const [currency, setCurrency] = useState<Currency | null>(null)
  useEffect(() => {
    let cancelled = false
    if (currencyForHost(window.location.hostname)) { const t = setTimeout(() => setCurrency('GBP'), 0); return () => clearTimeout(t) }
    const byDomain = (): Currency => (window.location.hostname.endsWith('.co.uk') ? 'GBP' : 'AUD')
    fetch('/api/geo', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => { if (!cancelled) setCurrency(valid(g?.currency) ? g.currency : byDomain()) })
      .catch(() => { if (!cancelled) setCurrency(byDomain()) })
    return () => { cancelled = true }
  }, [])
  return currency
}
