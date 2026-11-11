import { headers } from 'next/headers'
import PrivacyContent from '@/components/legal/PrivacyContent'
import { legalRegionForHost } from '@/lib/legalRegion'

export const metadata = { title: 'Privacy Policy | Reelezy' }

// The version shown depends on the domain: .co.uk is the UK version, .com.au the Australian one, anything else international
export default async function PrivacyPage() {
  const h = await headers()
  return <PrivacyContent region={legalRegionForHost(h.get('x-forwarded-host') || h.get('host'))} />
}
