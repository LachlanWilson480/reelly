import type { ReactNode } from 'react'
import LegalLogo from '@/components/LegalLogo'
import Sidebar from '@/components/Sidebar'

export const H2 = { fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 } as const
export const UL = { paddingLeft: 24, marginBottom: 24 } as const
export const LI = { marginBottom: 8 } as const
export const P = { marginBottom: 24 } as const

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)', lineHeight: 1.7 }}>
          <div><LegalLogo /></div>
          <h1 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 48 }}>Last updated: {updated}</p>
          {children}
        </div>
      </div>
    </div>
  )
}
