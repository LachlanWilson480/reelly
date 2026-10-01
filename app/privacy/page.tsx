'use client'

import Sidebar from '@/components/Sidebar'

export default function PrivacyPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px', fontFamily: "'Inter', sans-serif", color: 'var(--ink)', lineHeight: 1.7 }}>
      <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 48 }}>Last updated: 1 October 2026</p>

      <p style={{ marginBottom: 24 }}>Reelezy (ABN 76 182 998 115) operates reelezy.com. This policy explains how we collect, use and protect your personal information in accordance with the Australian Privacy Act 1988.</p>

      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>What we collect</h2>
      <ul style={{ paddingLeft: 24, marginBottom: 24 }}>
        <li style={{ marginBottom: 8 }}>Your email address and password</li>
        <li style={{ marginBottom: 8 }}>Business profile information you provide (name, industry, location, services)</li>
        <li style={{ marginBottom: 8 }}>Video and audio files you upload for editing</li>
        <li style={{ marginBottom: 8 }}>Content ideas, scripts and filming instructions we generate for you</li>
        <li style={{ marginBottom: 8 }}>Payment information (processed by Stripe — we never see your card details)</li>
        <li style={{ marginBottom: 8 }}>Usage data (how many ideas and videos you generate each month)</li>
      </ul>

      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>Why we collect it</h2>
      <ul style={{ paddingLeft: 24, marginBottom: 24 }}>
        <li style={{ marginBottom: 8 }}>To provide the Reelezy service</li>
        <li style={{ marginBottom: 8 }}>To manage your subscription and process payments</li>
        <li style={{ marginBottom: 8 }}>To send account-related emails</li>
        <li style={{ marginBottom: 8 }}>To improve the product</li>
      </ul>

      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>Who we share it with</h2>
      <ul style={{ paddingLeft: 24, marginBottom: 24 }}>
        <li style={{ marginBottom: 8 }}><strong>Supabase</strong> — database and file storage</li>
        <li style={{ marginBottom: 8 }}><strong>Anthropic</strong> — AI content generation (your business profile is sent to generate content; Anthropic does not train on your data by default)</li>
        <li style={{ marginBottom: 8 }}><strong>Shotstack</strong> — video rendering</li>
        <li style={{ marginBottom: 8 }}><strong>Stripe</strong> — payment processing</li>
        <li style={{ marginBottom: 8 }}><strong>Resend</strong> — transactional email</li>
        <li style={{ marginBottom: 8 }}><strong>Vercel</strong> — hosting</li>
      </ul>
      <p style={{ marginBottom: 24 }}>We do not sell your data to any third party.</p>

      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>How long we keep it</h2>
      <p style={{ marginBottom: 24 }}>We keep your data for as long as your account is active. If you delete your account, all your data including uploaded files and generated content is permanently deleted within 24 hours. Payment records are retained for 7 years as required by Australian tax law.</p>

      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>Your rights</h2>
      <ul style={{ paddingLeft: 24, marginBottom: 24 }}>
        <li style={{ marginBottom: 8 }}>Access the personal information we hold about you</li>
        <li style={{ marginBottom: 8 }}>Correct inaccurate information</li>
        <li style={{ marginBottom: 8 }}>Delete your account and all associated data (via Settings in the dashboard)</li>
        <li style={{ marginBottom: 8 }}>Complain to the Office of the Australian Information Commissioner (OAIC)</li>
      </ul>

      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>Security</h2>
      <p style={{ marginBottom: 24 }}>We use HTTPS, row-level database security, rate limiting and encrypted storage of sensitive credentials. If you believe your account has been compromised, contact us immediately.</p>

      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>Cookies</h2>
      <p style={{ marginBottom: 24 }}>Reelezy uses essential cookies only for authentication and session management. We do not use tracking or advertising cookies.</p>

      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>Contact</h2>
      <p style={{ marginBottom: 8 }}>Reelezy — ABN 76 182 998 115</p>
      <p style={{ marginBottom: 48 }}>Email: privacy@reelezy.com</p>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid rgba(128,128,128,0.2)', paddingTop: 24 }}>
        This privacy policy is intended to comply with the Australian Privacy Act 1988 and the Australian Privacy Principles.
      </p>
    </div>
      </div>
    </div>
  )
}
