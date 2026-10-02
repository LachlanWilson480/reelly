import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '40px 24px' }}>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 96, fontWeight: 700, color: 'var(--coral)', lineHeight: 1, margin: '0 0 8px' }}>404</p>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Page not found</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 320, margin: '0 auto 32px' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
          Go home
        </Link>
      </div>
    </div>
  )
}
