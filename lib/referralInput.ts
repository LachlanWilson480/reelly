export function cleanReferralInput(value: string): string {
  const fromLink = value.match(/[?&]ref=([A-Za-z0-9]+)/)
  const raw = fromLink ? fromLink[1] : value
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}
