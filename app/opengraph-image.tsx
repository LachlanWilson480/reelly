import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Reelezy - AI-powered social media content for small businesses'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #26215C, #712B13)',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 160,
            height: 160,
            borderRadius: 40,
            background: 'linear-gradient(135deg, #4A3F8C, #A8451F)',
            border: '2px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            marginRight: 48,
          }}
        >
          <svg width="70" height="90" viewBox="0 0 70 90" style={{ marginLeft: 16 }}>
            <polygon points="0,0 70,45 0,90" fill="#F1EFE8" />
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: '#F1EFE8',
              letterSpacing: -2,
            }}
          >
            Reelezy
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#D3D1C7',
              marginTop: 8,
            }}
          >
            AI-powered content for small businesses
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
