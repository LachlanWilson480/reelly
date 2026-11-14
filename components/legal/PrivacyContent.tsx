'use client'

import { LEGAL_SITE, type LegalRegion } from '@/lib/legalRegion'
import { H2, UL, LI, P, LegalShell } from './shared'

export default function PrivacyContent({ region }: { region: LegalRegion }) {
  const uk = region === 'uk'
  const au = region === 'au'
  const gdpr = !au // UK GDPR for the UK version, GDPR-style rights for the international version
  const site = LEGAL_SITE[region]

  return (
    <LegalShell title="Privacy Policy" updated="14 November 2026">
      <p style={P}>
        Reelezy ({site}) helps small businesses plan, film and edit social media videos. This policy explains what personal information we collect, how we use it, who we share it with and the choices you have.{' '}
        {au && 'We handle your information in line with the Australian Privacy Act 1988 and the Australian Privacy Principles.'}
        {uk && 'We handle your personal data in line with the UK General Data Protection Regulation (UK GDPR), the Data Protection Act 2018 and the Privacy and Electronic Communications Regulations (PECR).'}
        {region === 'intl' && 'We handle your personal information in line with the privacy laws that apply to us and, where they apply to you, the data protection laws of your country, including the EU and UK GDPR.'}
      </p>

      {gdpr && (
        <>
          <h2 style={H2}>Who is responsible for your data</h2>
          <p style={P}>Reelezy is the controller of your personal data. You can contact us at info@reelezy.com or through our <a href="/contact">contact page</a>.</p>
        </>
      )}

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

      {gdpr && (
        <>
          <h2 style={H2}>Our legal basis for using your data</h2>
          <ul style={UL}>
            <li style={LI}><b>Contract:</b> to create your account, provide Reelezy and take payments</li>
            <li style={LI}><b>Legitimate interests:</b> to keep the service secure, prevent misuse, fix problems and understand how Reelezy is used so we can improve it. We balance this against your rights</li>
            <li style={LI}><b>Legal obligation:</b> to keep billing and tax records</li>
            <li style={LI}><b>Consent:</b> where we ask for it, such as when you connect a social account. You can withdraw consent at any time</li>
          </ul>
        </>
      )}

      <h2 style={H2}>Who we share it with</h2>
      <p style={P}>We do not sell your personal information. We only share it with trusted service providers who help us run Reelezy, and only as much as they need to do their job. These fall into a few groups:</p>
      <ul style={UL}>
        <li style={LI}>Payment providers, to process payments and manage subscriptions</li>
        <li style={LI}>AI providers, so we can generate ideas, scripts and filming instructions from your business details and prompts</li>
        <li style={LI}>Hosting, storage and video processing providers, to run the app and store and render your files</li>
        <li style={LI}>Email providers, to deliver the emails we send you</li>
      </ul>
      {au ? (
        <p style={P}>Some of these providers are based or store data outside Australia, including in the United States. We take reasonable steps to make sure they handle your information with care. We may also disclose information where the law requires it.</p>
      ) : (
        <p style={P}>
          We and some of our providers handle or store data in other countries, including the United States and Australia. Where your data is sent outside {uk ? 'the UK' : 'your country'}, we make sure it is protected by appropriate safeguards, such as the provider&apos;s standard contractual clauses{uk ? ' and the UK International Data Transfer Addendum' : ''}, or another lawful transfer mechanism. Contact us if you would like more detail. We may also disclose information where the law requires it.
        </p>
      )}

      <h2 style={H2}>Connected accounts and Google</h2>
      <p style={P}>When you connect a social account such as YouTube, Instagram, Facebook or TikTok, we store the access token the platform gives us (encrypted), plus your account name, so we can post the videos you schedule and show how they performed. We only use that access to do what you ask, on your own account. We do not sell it, use it for advertising, or give it to anyone else.</p>
      <p style={P}>Reelezy uses YouTube API Services. By connecting YouTube you also agree to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>. Our use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. Google handles your information under the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</p>
      <p style={P}>You can disconnect any account from the Publish page at any time, which deletes the stored connection. You can also remove access for Reelezy to your Google account at <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer">security.google.com/settings/security/permissions</a>. If you delete your Reelezy account, your connections are deleted with it.</p>

      <h2 style={H2}>Referrals</h2>
      <p style={P}>If you use a friend referral code, we tell that friend only that someone signed up and subscribed using their code so they can receive their reward. We do not share your name, email or other details with them.</p>

      <h2 style={H2}>How long we keep it</h2>
      <p style={P}>
        We keep your information while your account is active. If you delete your account, your profile, uploaded files and generated content are permanently deleted within 24 hours.{' '}
        {au ? 'We keep billing records for 7 years because tax law requires it.' : 'We keep billing and tax records for as long as the law requires, which can be up to 7 years.'}
      </p>

      <h2 style={H2}>Your rights</h2>
      {gdpr ? (
        <>
          <p style={P}>{uk ? 'Under UK data protection law' : 'Depending on where you live, including under the EU and UK GDPR'}, you have the right to:</p>
          <ul style={UL}>
            <li style={LI}>Access the personal data we hold about you</li>
            <li style={LI}>Have inaccurate data corrected</li>
            <li style={LI}>Have your data erased. You can delete your account and data at any time from Settings</li>
            <li style={LI}>Restrict how we use your data</li>
            <li style={LI}>Receive your data in a portable format (data portability)</li>
            <li style={LI}>Object to us using your data where we rely on legitimate interests</li>
            <li style={LI}>Withdraw your consent at any time, where we rely on consent</li>
          </ul>
          <p style={P}>To use any of these rights, contact us at info@reelezy.com. We will reply within one month. You also have the right to complain to your data protection authority.{' '}
            {uk
              ? <>In the UK that is the Information Commissioner&apos;s Office (<a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a>, 0303 123 1113). We would appreciate the chance to put things right first, so please contact us before you complain.</>
              : <>You can also contact the Office of the Australian Information Commissioner (<a href="https://oaic.gov.au" target="_blank" rel="noopener noreferrer">oaic.gov.au</a>). We would appreciate the chance to put things right first, so please contact us before you complain.</>}
          </p>
        </>
      ) : (
        <ul style={UL}>
          <li style={LI}>Ask for a copy of the personal information we hold about you</li>
          <li style={LI}>Ask us to correct information that is wrong</li>
          <li style={LI}>Delete your account and your data at any time from Settings</li>
          <li style={LI}>Make a complaint. Contact us first and we will respond promptly. If you are not satisfied, you can contact the Office of the Australian Information Commissioner (oaic.gov.au)</li>
        </ul>
      )}

      <h2 style={H2}>Security</h2>
      <p style={P}>We protect your information with encryption in transit, access controls and rate limiting. No online service is completely risk free, so if you think your account has been accessed without your permission, tell us straight away and change your password.</p>

      <h2 style={H2}>Cookies</h2>
      <p style={P}>
        Reelezy uses only the cookies it needs to keep you signed in and your session working. We do not use advertising or cross-site tracking cookies.
        {uk && ' Because these cookies are strictly necessary, we do not need to ask for your consent to use them. If we add other cookies later, we will ask you first.'}
      </p>

      <h2 style={H2}>Changes to this policy</h2>
      <p style={P}>If we make important changes, we will update the date at the top of this page and let you know in the app or by email.</p>

      <h2 style={H2}>Contact</h2>
      <p style={{ marginBottom: 48 }}>Questions or requests about your information: info@reelezy.com</p>
    </LegalShell>
  )
}
