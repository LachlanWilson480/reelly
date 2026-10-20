import { track } from '@vercel/analytics'

// Small wrapper so a blocked or failing analytics call can never break the page
export const trackEvent = (name: string, props?: Record<string, string | number | boolean>) => {
  try { track(name, props) } catch {}
}
