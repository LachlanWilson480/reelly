// Small inline SVG icons (replace text symbols such as arrows, ticks and stars). They take the surrounding text colour and size.
export type IconName = 'close' | 'back' | 'forward' | 'star' | 'starOutline' | 'play' | 'pause' | 'check' | 'redo' | 'up' | 'down' | 'grip' | 'menu' | 'dot' | 'home' | 'dollar' | 'clock' | 'megaphone' | 'privacy' | 'terms' | 'cog' | 'download' | 'upload' | 'copy'

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
  home: <path d="M3 11l9-8 9 8M5 9.5V20h14V9.5M10 20v-6h4v6" fill="none" />,
  dollar: <path d="M12 2.5v3M12 18.5v3M16.5 8c-.6-1.4-2.4-2.5-4.5-2.500-2.500 0-4.200 1.300-4.200 3.100 0 4.5 8.700 2.2 8.700 6.600 0 1.900-1.900 3.2-4.5 3.2-2.2 0-4-.9-4.700-2.600" fill="none" />,
  clock: <><circle cx="12" cy="12" r="9" fill="none" /><path d="M12 7v5l3.500 2" fill="none" /></>,
  megaphone: <path d="M3 10.500v3a1 1 0 0 0 1 1h3l9 4.5V5L7 9.500H4a1 1 0 0 0-1 1zM19.500 9a4.5 4.5 0 0 1 0 6M7.500 14.5l1.500 5h2.500l-1.300-4.8" fill="none" />,
  privacy: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2.2 2.2L15.5 10" fill="none" />,
  terms: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6" fill="none" />,
  cog: <><path d="M12.220 2h-.440a2 2 0 0 0-2 2v.180a2 2 0 0 1-1 1.730l-.430.250a2 2 0 0 1-2 0l-.150-.080a2 2 0 0 0-2.730.730l-.220.380a2 2 0 0 0 .730 2.730l.150.100a2 2 0 0 1 1 1.720v.510a2 2 0 0 1-1 1.740l-.150.090a2 2 0 0 0-.730 2.730l.220.380a2 2 0 0 0 2.730.730l.150-.080a2 2 0 0 1 2 0l.430.250a2 2 0 0 1 1 1.730V20a2 2 0 0 0 2 2h.440a2 2 0 0 0 2-2v-.180a2 2 0 0 1 1-1.730l.430-.250a2 2 0 0 1 2 0l.150.080a2 2 0 0 0 2.730-.730l.220-.390a2 2 0 0 0-.730-2.730l-.150-.080a2 2 0 0 1-1-1.740v-.500a2 2 0 0 1 1-1.740l.150-.090a2 2 0 0 0 .730-2.730l-.220-.380a2 2 0 0 0-2.730-.730l-.150.080a2 2 0 0 1-2 0l-.430-.250a2 2 0 0 1-1-1.730V4a2 2 0 0 0-2-2z" fill="none" /><circle cx="12" cy="12" r="3" fill="none" /></>,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" fill="none" />,
  upload: <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14" fill="none" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" fill="none" /><path d="M5 15V5a1 1 0 0 1 1-1h10" fill="none" /></>,
  dot: <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
}

export default function Icon({ n, size = '1em' }: { n: IconName; size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-0.14em', flexShrink: 0 }}>
      {PATHS[n]}
    </svg>
  )
}
