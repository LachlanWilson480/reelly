export function cleanReferralInput(value: string): string {
  const fromLink = value.match(/[?&]ref=([A-Za-z0-9]+)/)
  const raw = fromLink ? fromLink[1] : value
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

// For a box that takes either a discount code or a referral code. Discount codes can include dashes or be longer, so only spaces are removed.
export function cleanCodeInput(value: string): string {
  const fromLink = value.match(/[?&]ref=([A-Za-z0-9]+)/)
  return (fromLink ? fromLink[1] : value).toUpperCase().replace(/\s/g, '').slice(0, 40)
}
