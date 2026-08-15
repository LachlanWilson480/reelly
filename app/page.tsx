'use client'

import Sidebar from '@/components/Sidebar'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 56 }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600 }}>
            Reelly
          </span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <a href="/login" style={{ color: 'var(--ink)', fontSize: 14, textDecoration: 'none' }}>
              Log in
            </a>
            <a href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Sign up
            </a>
          </div>
        </nav>

        <section style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 24, margin: '24px 48px', padding: '80px 48px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20 }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 44, fontWeight: 600, color: '#F1EFE8', maxWidth: 600, lineHeight: 1.2 }}>
            Content ideas, filmed and posted in minutes.
          </h1>
          <p style={{ fontSize: 17, color: '#D3D1C7', maxWidth: 480 }}>
            Reelly gives Sydney salons, studios, and small businesses AI-powered content ideas, filming steps, and scheduling — built for your suburb, your audience, your brand.
          </p>
          <div style={{ width: '100%', maxWidth: 600, height: 220, borderRadius: 12, background: 'rgba(127,119,221,0.2)', border: '1px dashed rgba(127,119,221,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 13, color: '#AFA9EC' }}>3D animation coming soon</span>
          </div>
          <a href="/signup" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '14px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none', marginTop: 8 }}>
            Get started free
          </a>
        </section>

        <section style={{ padding: '64px 48px', maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 40, textAlign: 'center' }}>
            Everything you need to post consistently
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {[
              { title: 'AI content ideas', desc: 'Hyperlocal video ideas, titles, hashtags, and step-by-step filming checklists built for your business.' },
              { title: 'Automatic editing', desc: 'Upload your clips and get them stitched together with captions, pause removal, and sound.' },
              { title: 'Scheduling built in', desc: 'Plan and post across Instagram, Facebook, and soon TikTok — all from one place.' },
            ].map((f) => (
              <div key={f.title} style={{ background: 'var(--sand)', borderRadius: 16, padding: '28px 24px' }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <footer style={{ padding: '32px 48px', textAlign: 'center', fontSize: 13, color: '#999' }}>
          © 2026 Reelly. Built in Sydney.
        </footer>
      </div>
    </div>
  )
}
