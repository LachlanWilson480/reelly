'use client'

import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <Link href="/" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            Reelly
          </Link>
        </nav>

        <div style={{ padding: '24px 48px 80px', maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 600, marginBottom: 4 }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
            Reelly · ABN: 76 182 998 115 · Last updated: 16 August 2026
          </p>

          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: 24 }}>
              These Terms of Service ("Terms") govern access to and use of the Reelly platform, website, and related services (the "Service"), provided by Reelly (ABN 76 182 998 115) ("Reelly", "we", "us", "our"). By creating an account or using the Service, you ("Customer", "you", "your") agree to be bound by these Terms. If you do not agree, do not use the Service.
            </p>

            <h2 style={sectionStyle}>1. The Service</h2>
            <p style={pStyle}>Reelly is a subscription software product that helps small personal-service businesses generate AI-assisted social media content, including content ideas, filming instructions, video editing assistance, and scheduling (the "Service"). Features may be added, changed, or removed at our discretion, with reasonable notice for material reductions in functionality.</p>

            <h2 style={sectionStyle}>2. Eligibility & Accounts</h2>
            <ul style={ulStyle}>
              <li>You must be at least 18 years old and able to form a binding contract to use the Service.</li>
              <li>You are responsible for the accuracy of information provided when creating an account, and for maintaining the confidentiality of your login credentials.</li>
              <li>You are responsible for all activity that occurs under your account, whether or not authorised by you, except where caused by our breach of these Terms.</li>
              <li>You must notify us promptly at LachlanWilson480@gmail.com of any unauthorised use of your account.</li>
              <li>One free trial is provided per business profile, verified by email. Trials do not require payment details up front. We may take reasonable steps to prevent trial abuse.</li>
            </ul>

            <h2 style={sectionStyle}>3. Subscription Tiers & Fees</h2>
            <ul style={ulStyle}>
              <li><strong>Basic</strong>  -  approximately 2 render minutes/week  -  AUD $20–$30/month</li>
              <li><strong>Mid</strong>  -  approximately 10 render minutes/week  -  AUD $68–$79/month</li>
              <li><strong>Top</strong>  -  approximately 15 render minutes/week, including long-form video support  -  AUD $120–$140/month</li>
            </ul>
            <p style={pStyle}>Exact current pricing is displayed at signup and in your account dashboard. Fees are billed in advance monthly via Stripe and are non-refundable except as required by the Australian Consumer Law (ACL). Cancellation takes effect at the end of the current billing period. We may change pricing on at least 14 days' notice.</p>

            <h2 style={sectionStyle}>4. Overage Renders</h2>
            <p style={pStyle}>If you exceed your weekly render-minute allowance, additional minutes are billed at a 50% markup plus a flat processing fee. You'll always see a confirm-before-charge summary before any overage is billed. Unused minutes do not roll over.</p>

            <h2 style={sectionStyle}>5. AI-Generated Content  -  Important Disclaimers</h2>
            <p style={pStyle}>The Service uses third-party AI models (including Anthropic's Claude models) to generate content suggestions, captions, scripts, and related material ("Generated Content"). Generated Content is provided as a starting point only  -  you are solely responsible for reviewing, editing, and approving it before publishing. We do not guarantee Generated Content is accurate, original, non-infringing, or suitable for your purposes.</p>

            <h2 style={sectionStyle}>6. Your Content & Data</h2>
            <p style={pStyle}>You retain ownership of content you upload ("Your Content"). You grant Reelly a limited, non-exclusive licence to use, store, and process Your Content solely to provide the Service. Personal information is handled per our Privacy Policy and the Australian Privacy Act 1988 (Cth).</p>

            <h2 style={sectionStyle}>7. Data Retention & Deletion</h2>
            <p style={pStyle}>Account data is retained for 30 days after cancellation in case of reactivation, then permanently deleted other than data we're legally required to retain. You may request earlier deletion by emailing us.</p>

            <h2 style={sectionStyle}>8. Intellectual Property</h2>
            <p style={pStyle}>Reelly retains all rights in the Service itself. You own the Generated Content produced for your account. You must not copy, reverse-engineer, resell, or white-label the Service without our written consent.</p>

            <h2 style={sectionStyle}>9. Acceptable Use</h2>
            <p style={pStyle}>You must not use the Service unlawfully, attempt unauthorised access, disrupt the Service, send spam or misleading content, or share your account outside your own business. We may suspend accounts breaching this section without prior notice where urgent action is needed.</p>

            <h2 style={sectionStyle}>10. Third-Party Platforms</h2>
            <p style={pStyle}>You are solely responsible for complying with the terms of any third-party platform you connect to or publish through (Instagram, Facebook, TikTok). We are not responsible for actions taken by these platforms against your account.</p>

            <h2 style={sectionStyle}>11. Third-Party Service Providers</h2>
            <p style={pStyle}>The Service relies on providers including Anthropic, Supabase, Stripe, Resend, Shotstack, and Vercel. We are not responsible for outages or errors caused by these providers beyond our reasonable control.</p>

            <h2 style={sectionStyle}>12. Warranties & Disclaimers</h2>
            <p style={pStyle}>The Service is provided "as is," without warranties beyond those which cannot be excluded under the ACL. Where a non-excludable guarantee is breached, our liability is limited to re-supply of the Service or its cost.</p>

            <h2 style={sectionStyle}>13. Limitation of Liability</h2>
            <p style={pStyle}>Our total liability is limited to fees paid by you in the 3 months preceding a claim. We are not liable for indirect or consequential loss, except where liability cannot be excluded by law.</p>

            <h2 style={sectionStyle}>14. Indemnity</h2>
            <p style={pStyle}>You agree to indemnify Reelly against claims arising from Your Content, your breach of these Terms, or your misuse of Generated Content, except to the extent caused by our negligence.</p>

            <h2 style={sectionStyle}>15. Termination</h2>
            <p style={pStyle}>You may cancel anytime. We may suspend or terminate access for breach, non-payment, or as required by law. Provisions that should survive termination (IP, liability, indemnity, data retention) continue to apply.</p>

            <h2 style={sectionStyle}>16. Force Majeure</h2>
            <p style={pStyle}>Neither party is liable for delays caused by circumstances beyond reasonable control, including third-party provider outages, infrastructure failures, or government action.</p>

            <h2 style={sectionStyle}>17. Changes to These Terms</h2>
            <p style={pStyle}>We may update these Terms. Material changes are notified at least 14 days before taking effect. Continued use after changes take effect constitutes acceptance.</p>

            <h2 style={sectionStyle}>18. General</h2>
            <p style={pStyle}>If any provision is unenforceable, the remainder continues in force. These Terms and our Privacy Policy form the entire agreement. You may not assign your rights without our consent. Failure to enforce a provision is not a waiver.</p>

            <h2 style={sectionStyle}>19. Governing Law</h2>
            <p style={pStyle}>These Terms are governed by the laws of New South Wales, Australia.</p>

            <h2 style={sectionStyle}>20. Contact</h2>
            <p style={pStyle}>Reelly · Email: LachlanWilson480@gmail.com · ABN: 76 182 998 115</p>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 32, fontStyle: 'italic' }}>
              This document is a general template and does not constitute legal advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const sectionStyle = { fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginTop: 28, marginBottom: 10 }
const pStyle = { marginBottom: 16 }
const ulStyle = { marginBottom: 16, paddingLeft: 20, display: 'flex', flexDirection: 'column' as const, gap: 6 }
