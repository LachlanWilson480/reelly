'use client'

import { LEGAL_SITE, type LegalRegion } from '@/lib/legalRegion'
import { H2, UL, LI, P, LegalShell } from './shared'

export default function TermsContent({ region }: { region: LegalRegion }) {
  const uk = region === 'uk'
  const au = region === 'au'
  const site = LEGAL_SITE[region]

  return (
    <LegalShell title="Terms of Service" updated="15 November 2026">
      <p style={P}>These terms apply when you use Reelezy ({site}). By creating an account or using the service you agree to them. If you do not agree, please do not use Reelezy.</p>

      <h2 style={H2}>Who we are</h2>
      <p style={P}>Reelezy is an online service for planning, filming and editing social media videos. You can contact us at info@reelezy.com or through our <a href="/contact">contact page</a>.</p>

      <h2 style={H2}>What Reelezy does</h2>
      <p style={P}>Reelezy helps small businesses plan, film, edit and schedule short videos. It generates ideas, scripts, captions and filming instructions with AI, and can publish videos you have approved to social accounts you connect.</p>

      <h2 style={H2}>Your account</h2>
      <ul style={UL}>
        <li style={LI}>You must give accurate details and keep your password safe</li>
        <li style={LI}>You are responsible for what happens under your account</li>
        <li style={LI}>Tell us at info@reelezy.com if you think someone else has accessed your account</li>
      </ul>

      <h2 style={H2}>Plans and payments</h2>
      <p style={P}>
        Reelezy has a Free plan and two paid plans, Basic and Pro. Paid plans can be billed monthly or yearly. A yearly plan costs the same as 10 months, so you get 2 months free. Plans renew automatically at the end of each month or year until you cancel. Prices are shown on the <a href="/plans">plans page</a> in your local currency, and the price shown at checkout is the price you pay. If you change plans or cancel, the change is handled through our payment provider and takes effect as shown at the time. Discount codes apply only as described when you use them and cannot be exchanged for cash. Payments are handled by our payment provider, Stripe.{' '}
        {au && 'Nothing in these terms limits your rights under the Australian Consumer Law.'}
        {uk && 'Nothing in these terms limits your legal rights as a consumer in the UK.'}
        {region === 'intl' && 'Nothing in these terms limits any consumer rights you have under the law where you live that cannot be excluded.'}
      </p>

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
      {au && (
        <p style={P}>Our services come with guarantees that cannot be excluded under the Australian Consumer Law. If Reelezy has a major problem, you are entitled to cancel and receive a refund for the unused part of your plan, and to compensation for other reasonably foreseeable loss. You are also entitled to have the service fixed or re-supplied if it is not of acceptable quality and the failure does not amount to a major failure. Apart from these rights, subscription fees already paid are not refundable, and you can cancel at any time to stop future charges. To ask for a refund, contact us using the details below.</p>
      )}
      {uk && (
        <>
          <p style={P}>If you are a consumer in the UK, you have a legal right to cancel within 14 days of subscribing, without giving a reason. If you ask us to start the service straight away (which happens when you subscribe and start using Reelezy) and then cancel within those 14 days, you will pay for the service you have used up to the point you tell us you are cancelling, and we will refund the rest.</p>
          <p style={P}>Under the Consumer Rights Act 2015, we must provide the service with reasonable care and skill, and digital content must be of satisfactory quality, fit for purpose and as described. If it is not, you may be entitled to a repair, a replacement, a price reduction or a refund. After the 14 days, you can cancel at any time to stop future charges, and subscription fees already paid are not refundable except where the law says otherwise. To cancel or ask for a refund, contact us using the details below.</p>
        </>
      )}
      {region === 'intl' && (
        <>
          <p style={P}>If you are a consumer in the UK or the European Union, you have a legal right to cancel within 14 days of subscribing, without giving a reason. If you ask us to start the service straight away and then cancel within those 14 days, you will pay for the service you have used up to the point you tell us you are cancelling, and we will refund the rest.</p>
          <p style={P}>Wherever you live, you may have consumer rights under local law that cannot be excluded, such as the right to a refund or repair if the service is faulty. Nothing in these terms limits those rights. After any cancellation period, you can cancel at any time to stop future charges, and subscription fees already paid are not refundable except where the law says otherwise. To cancel or ask for a refund, contact us using the details below.</p>
        </>
      )}

      <h2 style={H2}>What each plan includes</h2>
      <p style={P}>These are the limits shown on the plans page. Weekly limits reset each week and render minutes reset each calendar month.</p>
      <ul style={UL}>
        <li style={LI}>Free: 24 ideas in total (3 per batch), 7 filming instructions, 3 scripts, 1 minute of edited video in total with a Reelezy watermark, and 500 MB of clip storage.</li>
        <li style={LI}>Basic (about 40 reels a month): 5 ideas per batch (95 a week), 50 filming instructions a week, 20 scripts a week, 25 render minutes a month, 1080p video, the AI Editor and sound library, and 5 GB of storage.</li>
        <li style={LI}>Pro (about 90 reels a month): 7 ideas per batch (210 a week), 98 filming instructions a week, 96 scripts a week, 60 render minutes a month, 1080p and 4K video, priority processing and longer scripts, the AI Editor and sound library, and 10 GB of storage.</li>
      </ul>
      <p style={P}>The number of reels per month is a guide based on typical video length, not a promise. If you use all your render minutes, you can keep rendering for the rest of the month at no extra cost, but very heavy use may be limited. If we ever start charging for extra use, we will tell you first and you will not be charged without agreeing.</p>

      <h2 style={H2}>Fair use</h2>
      <p style={P}>Reelezy is designed for normal business use. We may adjust plan limits over time and will show the current limits on the plans page. We may limit or suspend use that is automated, shared between businesses, or clearly outside normal use.</p>

      <h2 style={H2}>Our responsibility</h2>
      <p style={P}>
        We work hard to keep Reelezy running, but we cannot promise it will always be available or error free. Platforms such as YouTube, TikTok and Instagram can change their rules or reject posts, which is outside our control. To the extent the law allows, we are not liable for indirect losses, and our liability for any claim is limited to the amount you paid us in the 12 months before it.{' '}
        {au && 'Nothing here excludes rights that cannot be excluded under Australian law.'}
        {uk && 'Nothing here limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else the law does not allow us to limit, and it does not affect your legal rights as a consumer.'}
        {region === 'intl' && 'Nothing here limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else the law does not allow us to limit, and it does not affect consumer rights you have under the law where you live that cannot be excluded.'}
      </p>

      <h2 style={H2}>Changes to these terms</h2>
      <p style={P}>If we make important changes, we will update the date at the top of this page and let you know in the app or by email.</p>

      <h2 style={H2}>Contact</h2>
      <p style={P}>Questions about these terms: <a href="/contact">contact us</a> or email info@reelezy.com</p>

      <h2 style={H2}>General</h2>
      <p style={{ ...P, marginBottom: 48 }}>
        If any part of these terms cannot be enforced, the rest still applies. If we do not enforce a term straight away, we can still enforce it later. These terms are the whole agreement between you and Reelezy about the service.{' '}
        {au && 'These terms are governed by the laws of Australia and the courts of Australia have jurisdiction, without limiting any consumer rights you have under the law where you live.'}
        {uk && 'For customers in the UK, these terms are governed by the laws of England and Wales, and the courts of England and Wales have jurisdiction. If you live in Scotland or Northern Ireland, you can also rely on the law of that country and bring a claim in the courts there.'}
        {region === 'intl' && 'These terms are governed by the laws of Australia. If you are a consumer, you keep the mandatory consumer protections of the law of the country where you live, and you can bring a claim in the courts there.'}
      </p>
    </LegalShell>
  )
}
