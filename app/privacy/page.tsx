'use client'

import Sidebar from '@/components/Sidebar'

const H2 = { fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 } as const
const UL = { paddingLeft: 24, marginBottom: 24 } as const
const LI = { marginBottom: 8 } as const
const P = { marginBottom: 24 } as const

export default function PrivacyPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)', lineHeight: 1.7 }}>
          <h1 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 48 }}>Last updated: 26 October 2026</p>

          <p style={P}>Reelezy (reelezy.com) helps small businesses plan, film and edit social media videos. This policy explains what personal information we collect, how we use it, who we share it with and the choices you have. We handle your information in line with the Australian Privacy Act 1988 and the Australian Privacy Principles.</p>

          <h2 style={H2}>What we collect</h2>
          <ul style={UL}>
            <li style={LI}>Account details: your email address and password (we store your password securely, never in plain text)</li>
            <li style={LI}>Business details you give us, such as your business name, industry, location, services and tone of voice</li>
            <li style={LI}>Videos, audio and other files you upload or record in Reelezy</li>
            <li style={LI}>Ideas, scripts, captions and filming instructions created for you</li>
            <li style={LI}>Subscription and billing details. Card payments are handled by our payment provider, so we never see or store your full card number</li>
            <li style={LI}>Referral activity, including your referral code and whether a friend you referred signed up</li>
            <li style={LI}>Usage information, such as how many ideas and videos you create and which features you use</li>
          </ul>

          <h2 style={H2}>How we use it</h2>
          <ul style={UL}>
            <li style={LI}>To run Reelezy and create the content you ask for</li>
            <li style={LI}>To manage your subscription, take payments and apply referral rewards and discounts</li>
            <li style={LI}>To send account and billing emails, and to reply when you contact us</li>
            <li style={LI}>To keep the service secure, prevent misuse and fix problems</li>
            <li style={LI}>To understand how Reelezy is used so we can improve it</li>
          </ul>

          <h2 style={H2}>Who we share it with</h2>
          <p style={P}>We do not sell your personal information. We only share it with trusted service providers who help us run Reelezy, and only as much as they need to do their job. These fall into a few groups:</p>
          <ul style={UL}>
            <li style={LI}>Payment providers, to process payments and manage subscriptions</li>
            <li style={LI}>AI providers, so we can generate ideas, scripts and filming instructions from your business details and prompts</li>
            <li style={LI}>Hosting, storage and video processing providers, to run the app and store and render your files</li>
            <li style={LI}>Email providers, to deliver the emails we send you</li>
          </ul>
          <p style={P}>Some of these providers are based or store data outside Australia, including in the United States. We take reasonable steps to make sure they handle your information with care. We may also disclose information where the law requires it.</p>

          <h2 style={H2}>Referrals</h2>
          <p style={P}>If you use a friend referral code, we tell that friend only that someone signed up and subscribed using their code so they can receive their reward. We do not share your name, email or other details with them.</p>

          <h2 style={H2}>How long we keep it</h2>
          <p style={P}>We keep your information while your account is active. If you delete your account, your profile, uploaded files and generated content are permanently deleted within 24 hours. We keep billing records for 7 years because tax law requires it.</p>

          <h2 style={H2}>Your rights</h2>
          <ul style={UL}>
            <li style={LI}>Ask for a copy of the personal information we hold about you</li>
            <li style={LI}>Ask us to correct information that is wrong</li>
            <li style={LI}>Delete your account and your data at any time from Settings</li>
            <li style={LI}>Make a complaint. Contact us first and we will respond promptly. If you are not satisfied, you can contact the Office of the Australian Information Commissioner (oaic.gov.au)</li>
          </ul>

          <h2 style={H2}>Security</h2>
          <p style={P}>We protect your information with encryption in transit, access controls and rate limiting. No online service is completely risk free, so if you think your account has been accessed without your permission, tell us straight away and change your password.</p>

          <h2 style={H2}>Cookies</h2>
          <p style={P}>Reelezy uses only the cookies it needs to keep you signed in and your session working. We do not use advertising or cross-site tracking cookies.</p>

          <h2 style={H2}>Changes to this policy</h2>
          <p style={P}>If we make important changes, we will update the date at the top of this page and let you know in the app or by email.</p>

          <h2 style={H2}>Contact</h2>
          <p style={{ marginBottom: 48 }}>Questions or requests about your information: lachlan@reelezy.com</p>
        </div>
      </div>
    </div>
  )
}
