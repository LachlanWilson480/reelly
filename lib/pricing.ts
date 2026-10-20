export type Currency = 'AUD' | 'NZD' | 'GBP' | 'EUR' | 'USD' | 'CAD' | 'SGD' | 'ZAR'

const perMonth = (yearly: number) => (yearly / 12).toFixed(2)

// Yearly is always 10x monthly (two months free)
const make = (symbol: string, basic: number, pro: number) => ({
  symbol, basic, pro,
  basicYearly: basic * 10, proYearly: pro * 10,
  basicPerMonth: perMonth(basic * 10), proPerMonth: perMonth(pro * 10),
})

// Edit prices here. The same amounts must exist on the Stripe prices (see the currency options on each price).
export const CURRENCY_PRICES: Record<Currency, ReturnType<typeof make>> = {
  AUD: make('A$', 35, 69),
  NZD: make('NZ$', 39, 79),
  GBP: make('£', 19, 37),
  EUR: make('€', 22, 42),
  USD: make('$', 23, 45),
  CAD: make('C$', 31, 61),
  SGD: make('S$', 30, 59),
  ZAR: make('R', 420, 820),
}

const EURO_COUNTRIES = ['IE', 'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK']
const COUNTRY_CURRENCY: Record<string, Currency> = {
  AU: 'AUD', NZ: 'NZD', UK: 'GBP', GB: 'GBP', GG: 'GBP', JE: 'GBP', IM: 'GBP', US: 'USD', CA: 'CAD', SG: 'SGD', ZA: 'ZAR',
}

// Works with the onboarding country list (AU, NZ, UK, IE, US, CA, ZA, SG, OTHER) and two-letter country codes from the visitor's location.
// Returns null when the country is unknown. Any other country is charged in USD.
export function currencyForCountry(country: string | null | undefined): Currency | null {
  const c = (country || '').trim().toUpperCase()
  if (!c) return null
  if (COUNTRY_CURRENCY[c]) return COUNTRY_CURRENCY[c]
  if (EURO_COUNTRIES.includes(c)) return 'EUR'
  return 'USD'
}

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
