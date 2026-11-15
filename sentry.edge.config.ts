// Error tracking for anything that runs on the edge runtime. Does nothing until NEXT_PUBLIC_SENTRY_DSN is set.
import * as Sentry from '@sentry/nextjs'
import { SENTRY_DATA_COLLECTION } from '@/lib/sentryPrivacy'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Don't send names, emails, cookies, request bodies or AI prompts.
    dataCollection: SENTRY_DATA_COLLECTION,
  })
}
