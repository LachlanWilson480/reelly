export type Currency = 'AUD' | 'USD' | 'GBP'

const perMonth = (yearly: number) => (yearly / 12).toFixed(2)

// Yearly is always 10x monthly (two months free)
export const CURRENCY_PRICES = {
  AUD: { symbol: 'A$', basic: 35, pro: 69, basicYearly: 350, proYearly: 690, basicPerMonth: perMonth(350), proPerMonth: perMonth(690) },
  USD: { symbol: '$', basic: 23, pro: 45, basicYearly: 230, proYearly: 450, basicPerMonth: perMonth(230), proPerMonth: perMonth(450) },
  GBP: { symbol: '£', basic: 19, pro: 37, basicYearly: 190, proYearly: 370, basicPerMonth: perMonth(190), proPerMonth: perMonth(370) },
} as const

// What each plan includes. Matches the limits the app enforces (see lib/planLimits.ts and the API routes).
export const PLAN_COPY = {
  free: {
    name: 'Free',
    desc: 'Try Reelezy, no card needed',
    features: ['24 ideas a week (3 per batch)', '7 filming instructions', '3 scripts', '1 minute of video in total, with a Reelezy watermark'],
  },
  basic: {
    name: 'Basic',
    desc: 'About 40 reels a month',
    features: ['5 ideas per batch (95 a week)', '50 filming instructions a week', '20 scripts a week', 'AI Editor and video uploads', '1080p video', 'Sound library', 'Video scheduler', '5 GB of storage'],
  },
  pro: {
    name: 'Pro',
    desc: 'About 90 reels a month',
    features: ['7 ideas per batch (210 a week)', '98 filming instructions a week', '96 scripts a week', 'AI Editor and video uploads', '1080p and 4K video', 'Sound library', 'Full video scheduler', 'Higher capacity AI for better content', '10 GB of storage'],
  },
} as const
