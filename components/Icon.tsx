// Small inline SVG icons (replace text symbols such as arrows, ticks and stars). They take the surrounding text colour and size.
export type IconName = 'close' | 'back' | 'forward' | 'star' | 'starOutline' | 'play' | 'pause' | 'check' | 'redo' | 'up' | 'down' | 'grip' | 'menu' | 'dot'

const PATHS: Record<IconName, React.ReactNode> = {
  close: <path d="M6 6l12 12M18 6L6 18" fill="none" />,
  back: <path d="M15 5l-7 7 7 7" fill="none" />,
  forward: <path d="M9 5l7 7-7 7" fill="none" />,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" fill="currentColor" />,
  starOutline: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" fill="none" />,
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" />,
  redo: <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5" fill="none" />,
  up: <path d="M6 15l6-6 6 6" fill="none" />,
  down: <path d="M6 9l6 6 6-6" fill="none" />,
  grip: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" fill="none" strokeWidth={3} />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" fill="none" />,
  dot: <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
}

export default function Icon({ n, size = '1em' }: { n: IconName; size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-0.14em', flexShrink: 0 }}>
      {PATHS[n]}
    </svg>
  )
}
