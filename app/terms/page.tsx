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
            Reelly · ABN 76 182 998 115 · Last updated: 6 September 2026
          </p>

          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: 24 }}>
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Reelly platform, website,
              and related services (the &quot;Service&quot;), provided by Reelly (ABN 76 182 998 115) (&quot;Reelly&quot;,
              &quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an account, ticking the acceptance box at signup, or
              using the Service, you (&quot;you&quot;, &quot;your&quot;) agree to be bound by these Terms. If you do not agree,
              do not use the Service.
            </p>

            <h2 style={sectionStyle}>1. The Service</h2>
            <p style={pStyle}>
              Reelly is a subscription software product that helps small businesses and independent creators produce
              short-form social media content. It generates AI-assisted content ideas and filming instructions,
              provides tools to upload and automatically edit video clips (stitching, captions, trimming, music), and
              offers basic scheduling and planning features. Features may be added, changed, or removed at our
              discretion. We will give reasonable notice of any material reduction in functionality.
            </p>

            <h2 style={sectionStyle}>2. Eligibility &amp; Accounts</h2>
            <ul style={ulStyle}>
              <li>You must be at least 18 years old and able to form a binding contract to use the Service.</li>
              <li>You are responsible for the accuracy of the information you provide and for keeping your login credentials confidential.</li>
              <li>You are responsible for all activity under your account, except to the extent caused by our breach of these Terms.</li>
              <li>Notify us promptly at lachlanwilson480@gmail.com of any unauthorised use of your account.</li>
              <li>Accounts are for a single business or creator. Do not share your account outside your own business.</li>
            </ul>

            <h2 style={sectionStyle}>3. Plans &amp; Fees</h2>
            <p style={pStyle}>Reelly is offered on the following subscription plans:</p>
            <ul style={ulStyle}>
              <li><strong>Basic</strong> — approximately 2 render minutes per week — AUD $20/month.</li>
              <li><strong>Pro</strong> — approximately 10 render minutes per week, plus content calendar, idea refinement, and custom generation guidance — AUD $69/month.</li>
            </ul>
            <p style={pStyle}>
              Current pricing is always shown at signup and in your account. Fees are billed monthly in advance through
              Stripe and are non-refundable except where required by the Australian Consumer Law. You can cancel at any
              time; cancellation takes effect at the end of the current billing period. We may change pricing on at
              least 14 days&apos; notice.
            </p>

            <h2 style={sectionStyle}>4. Render Minutes &amp; Overage</h2>
            <p style={pStyle}>
              Each plan includes a weekly allowance of video render minutes. Unused minutes do not roll over. If you
              choose to render beyond your allowance, additional minutes are billed at a flat rate of AUD $5 per minute
              over, charged on the 1st of the following month. You will always see a confirmation of the extra cost
              before any overage render begins.
            </p>

            <h2 style={sectionStyle}>5. AI-Generated Content — Important Disclaimers</h2>
            <p style={pStyle}>
              The Service uses third-party AI models (including Anthropic&apos;s Claude models) to generate content
              ideas, hooks, filming instructions, captions, and related material (&quot;Generated Content&quot;).
              Generated Content is a starting point only. You are solely responsible for reviewing, editing, fact-checking,
              and approving it before publishing or acting on it. We do not warrant that Generated Content is accurate,
              current, original, non-infringing, or suitable for your purposes. You must not rely on Generated Content
              for professional, legal, safety, medical, or financial advice.
            </p>

            <h2 style={sectionStyle}>6. Your Content &amp; Media Rights</h2>
            <p style={pStyle}>
              You retain ownership of the videos, images, audio, business information, and other material you upload
              (&quot;Your Content&quot;). You grant Reelly a limited, non-exclusive licence to store, process, and
              transmit Your Content solely to operate and provide the Service (including sending it to our rendering
              provider). You are responsible for ensuring you hold all necessary rights to Your Content, including any
              music, footage, logos, or people appearing in it, and for obtaining consent from anyone shown on camera.
            </p>

            <h2 style={sectionStyle}>7. Ownership of Output</h2>
            <p style={pStyle}>
              As between you and Reelly, you own the final rendered videos and the Generated Content produced for your
              account, subject to any rights held by third parties in material you supplied. Reelly retains all rights
              in the Service itself, including its software, design, and underlying prompts and systems. You must not
              copy, reverse-engineer, resell, or white-label the Service without our written consent.
            </p>

            <h2 style={sectionStyle}>8. Acceptable Use</h2>
            <p style={pStyle}>You must not use the Service to:</p>
            <ul style={ulStyle}>
              <li>break any law or infringe anyone&apos;s intellectual property, privacy, or other rights;</li>
              <li>create misleading, deceptive, defamatory, hateful, or harassing content;</li>
              <li>upload content you do not have the rights to use;</li>
              <li>attempt to gain unauthorised access to, disrupt, overload, or reverse-engineer the Service;</li>
              <li>resell or share your account outside your own business.</li>
            </ul>
            <p style={pStyle}>We may suspend or terminate accounts that breach this section, without prior notice where urgent action is needed.</p>

            <h2 style={sectionStyle}>9. Third-Party Platforms &amp; Providers</h2>
            <p style={pStyle}>
              You are solely responsible for complying with the terms of any third-party platform you publish to,
              including Instagram, Facebook, and TikTok, and for any action those platforms take against your accounts.
              The Service also relies on providers including Anthropic, Supabase, Stripe, Resend, Shotstack, and Vercel.
              We are not responsible for outages, errors, or changes caused by these providers beyond our reasonable
              control.
            </p>

            <h2 style={sectionStyle}>10. Privacy &amp; Data</h2>
            <p style={pStyle}>
              We handle personal information in line with the Australian Privacy Act 1988 (Cth). We use your business
              profile and account data to personalise the Service and generate relevant content. We do not sell your
              information. Account and profile data is retained for 30 days after cancellation in case you reactivate,
              then permanently deleted, other than anything we are legally required to keep. You can request earlier
              deletion by emailing us, or delete your account directly from Settings.
            </p>

            <h2 style={sectionStyle}>11. Warranties &amp; Disclaimers</h2>
            <p style={pStyle}>
              The Service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties beyond those
              that cannot be excluded under the Australian Consumer Law. Where a non-excludable guarantee applies and is
              breached, our liability is limited, to the extent permitted by law, to re-supplying the Service or paying
              the cost of re-supply.
            </p>

            <h2 style={sectionStyle}>12. Limitation of Liability</h2>
            <p style={pStyle}>
              To the extent permitted by law, our total liability arising out of or in connection with the Service is
              limited to the fees you paid to Reelly in the 3 months before the event giving rise to the claim. We are
              not liable for indirect, incidental, or consequential loss, or for loss of profits, revenue, data, or
              goodwill.
            </p>

            <h2 style={sectionStyle}>13. Indemnity</h2>
            <p style={pStyle}>
              You agree to indemnify Reelly against claims, losses, and costs arising from Your Content, your use or
              publication of Generated Content, or your breach of these Terms, except to the extent caused by our
              negligence or breach.
            </p>

            <h2 style={sectionStyle}>14. Termination</h2>
            <p style={pStyle}>
              You may cancel at any time from your account. We may suspend or terminate access for breach of these
              Terms, non-payment, or where required by law. Sections that by their nature should survive termination
              (including ownership, disclaimers, liability, indemnity, and data retention) continue to apply.
            </p>

            <h2 style={sectionStyle}>15. Changes to These Terms</h2>
            <p style={pStyle}>
              We may update these Terms from time to time. For material changes we will give at least 14 days&apos;
              notice before they take effect. Continuing to use the Service after changes take effect means you accept
              the updated Terms.
            </p>

            <h2 style={sectionStyle}>16. General</h2>
            <p style={pStyle}>
              If any provision of these Terms is unenforceable, the rest continues in force. These Terms are the entire
              agreement between you and Reelly about the Service. You may not assign your rights without our consent.
              Our failure to enforce a provision is not a waiver of it. These Terms are governed by the laws of New
              South Wales, Australia, and the courts of New South Wales have non-exclusive jurisdiction.
            </p>

            <h2 style={sectionStyle}>17. Contact</h2>
            <p style={pStyle}>Reelly · Email: lachlanwilson480@gmail.com · ABN 76 182 998 115</p>

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
