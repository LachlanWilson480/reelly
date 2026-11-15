'use client'

// Shown only if the whole app crashes. Reports the crash to Sentry and gives the person a way back.
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fff', color: '#111' }}>
        <div style={{ maxWidth: 420, margin: '20vh auto', padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#555', marginBottom: 24 }}>We&apos;ve been told about it. Please try again.</p>
          <button onClick={() => reset()} style={{ padding: '10px 18px', borderRadius: 6, border: 'none', background: '#ff6b57', color: '#fff', fontWeight: 600, cursor: 'pointer', marginRight: 8 }}>Try again</button>
          <button onClick={() => { window.location.href = '/' }} style={{ padding: '10px 18px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', color: '#111', cursor: 'pointer' }}>Go home</button>
        </div>
      </body>
    </html>
  )
}
