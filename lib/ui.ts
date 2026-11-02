// Shared styles, so every page looks the same. Change a value here and it changes everywhere it is used.
// Text sizes: 11 caption, 12 small, 13 compact body, 14 body, 16 large, 18, 20 section title, 24, 28 page title, 32.
import type { CSSProperties } from 'react'

export const FONT = "var(--font-geist-sans), 'Inter', sans-serif"

export const pageTitle: CSSProperties = { fontSize: 28, fontWeight: 500, color: 'var(--ink)', margin: 0 }
export const sectionTitle: CSSProperties = { fontSize: 20, fontWeight: 500, color: 'var(--ink)', margin: 0 }
export const fieldLabel: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, display: 'block' }
export const smallLabel: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)' }

export const input: CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', fontSize: 14, fontFamily: FONT, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }
export const inputCompact: CSSProperties = { ...input, padding: '10px 12px', fontSize: 13 }

export const panel: CSSProperties = { background: 'var(--sand)', borderRadius: 4, padding: 24 }
export const card: CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: 24 }

export const buttonPrimary: CSSProperties = { background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }
export const buttonSecondary: CSSProperties = { background: 'var(--card-bg)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 4, padding: '10px 20px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }
export const buttonDark: CSSProperties = { background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }
