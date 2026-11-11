'use client'

import LegalLogo from '@/components/LegalLogo'
import Sidebar from '@/components/Sidebar'

const H2 = { fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 } as const
const UL = { paddingLeft: 24, marginBottom: 24 } as const
const LI = { marginBottom: 8 } as const
const P = { marginBottom: 24 } as const

export default function TermsPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)', lineHeight: 1.7 }}>
        <div><LegalLogo /></div>
          <h1 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 48 }}>Last updated: 8 November 2026</p>

        <p style={P}>These terms apply when you use Reelezy (reelezy.com). By creating an account or using the service you agree to them. If you do not agree, please do not use Reelezy.</p>

        <h2 style={H2}>What Reelezy does</h2>
        <p style={P}>Reelezy helps small businesses plan, film, edit and schedule short videos. It generates ideas, scripts, captions and filming instructions with AI, and can publish videos you have approved to social accounts you connect.</p>

        <h2 style={H2}>Your account</h2>
        <ul style={UL}>
          <li style={LI}>You must give accurate details and keep your password safe</li>
          <li style={LI}>You are responsible for what happens under your account</li>
          <li style={LI}>Tell us at info@reelezy.com if you think someone else has accessed your account</li>
        </ul>

        <h2 style={H2}>Plans and payments</h2>
        <p style={P}>Paid plans are subscriptions that renew until you cancel. Prices and what each plan includes are shown on the plans page and at checkout. Payments are handled by our payment provider. Nothing in these terms limits your rights under the Australian Consumer Law.</p>

        <h2 style={H2}>Your content</h2>
        <ul style={UL}>
          <li style={LI}>You keep ownership of the videos, files and business details you add to Reelezy</li>
          <li style={LI}>You give us permission to store, process and display that content only to run the service for you, including rendering videos and publishing them to the accounts you choose</li>
          <li style={LI}>You are responsible for your content and must have the right to use everything in it, including music, images and people shown</li>
          <li style={LI}>AI generated ideas, scripts and captions can contain mistakes. Check them before you post</li>
        </ul>

        <h2 style={H2}>Connected social accounts</h2>
        <p style={P}>You can connect accounts such as YouTube, TikTok, Instagram and Facebook so Reelezy can post the videos you schedule. We only post content you have approved, to the accounts you connect. You must follow each platform&apos;s own rules, and you can disconnect an account at any time from the Publish page.</p>
        <p style={P}>If you connect YouTube, you also agree to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>. Information we receive from Google is handled under our <a href="/privacy">Privacy Policy</a> and the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>. You can remove Reelezy&apos;s access to your Google account at any time at <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer">security.google.com/settings/security/permissions</a>.</p>

        <h2 style={H2}>What you must not do</h2>
        <ul style={UL}>
          <li style={LI}>Break the law or post content that is unlawful, misleading, hateful or infringes someone else&apos;s rights</li>
          <li style={LI}>Try to break, overload or get around the limits of the service</li>
          <li style={LI}>Share your account or resell access to Reelezy</li>
        </ul>
        <p style={P}>We may suspend or close accounts that break these terms.</p>

        <h2 style={H2}>Cancelling and deleting your account</h2>
        <p style={P}>You can cancel your subscription or delete your account at any time from Settings. If you delete your account, your data is deleted as described in our <a href="/privacy">Privacy Policy</a>.</p>

        <h2 style={H2}>Refunds and your consumer rights</h2>
        <p style={P}>Our services come with guarantees that cannot be excluded under the Australian Consumer Law. If Reelezy has a major problem, you are entitled to cancel and receive a refund for the unused part of your plan, and to compensation for other reasonably foreseeable loss. You are also entitled to have the service fixed or re-supplied if it is not of acceptable quality and the failure does not amount to a major failure. Apart from these rights, subscription fees already paid are not refundable, and you can cancel at any time to stop future charges. To ask for a refund, contact us using the details below.</p>

        <h2 style={H2}>Fair use</h2>
        <p style={P}>Reelezy is designed for normal business use. To keep the service fast for everyone, these limits apply and may be adjusted over time:</p>
        <ul style={UL}>
          <li style={LI}>Free: 24 ideas in total (3 per batch), 7 filming instructions, 3 scripts, and 1 minute of video in total.</li>
          <li style={LI}>Basic: 5 ideas per batch (95 a week), 50 filming instructions a week, 20 scripts a week, and 5 GB of storage.</li>
          <li style={LI}>Pro: 7 ideas per batch (210 a week), 98 filming instructions a week, 96 scripts a week, and 10 GB of storage.</li>
        </ul>
        <p style={P}>We may limit or suspend use that is automated, shared between businesses, or clearly outside normal use.</p>

        <h2 style={H2}>Who we are</h2>
        <p style={P}>Reelezy is operated from Australia (ABN 76 182 998 115).</p>

        <h2 style={H2}>Our responsibility</h2>
        <p style={P}>We work hard to keep Reelezy running, but we cannot promise it will always be available or error free. Platforms such as YouTube, TikTok and Instagram can change their rules or reject posts, which is outside our control. To the extent the law allows, we are not liable for indirect losses, and our liability for any claim is limited to the amount you paid us in the 12 months before it. Nothing here excludes rights that cannot be excluded under Australian law.</p>

        <h2 style={H2}>Changes to these terms</h2>
        <p style={P}>If we make important changes, we will update the date at the top of this page and let you know in the app or by email.</p>

        <h2 style={H2}>Governing law</h2>
        <p style={P}>These terms are governed by the laws of Australia and the courts of Australia have jurisdiction, without limiting any consumer rights you have under the law where you live.</p>

        <h2 style={H2}>Contact</h2>
        <p style={{ marginBottom: 48 }}>Questions about these terms: <a href="/contact">contact us</a> or email info@reelezy.com</p>
      </div>
      </div>
    </div>
  )
}
