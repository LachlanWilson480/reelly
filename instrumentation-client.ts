// Error tracking in the browser. Does nothing until NEXT_PUBLIC_SENTRY_DSN is set in Vercel.
import * as Sentry from '@sentry/nextjs'
import { SENTRY_DATA_COLLECTION } from '@/lib/sentryPrivacy'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    // Errors are always sent. Only 10% of page loads send speed data, to stay inside the free plan.
    tracesSampleRate: 0.1,
    // Don't send names, emails, cookies, request bodies or AI prompts.
    dataCollection: SENTRY_DATA_COLLECTION,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'AbortError',
      'The play() request was interrupted',
      'Load failed',
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
    ],
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
