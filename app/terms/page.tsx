import { headers } from 'next/headers'
import TermsContent from '@/components/legal/TermsContent'
import { legalRegionForHost } from '@/lib/legalRegion'

// The version shown depends on the domain: .co.uk is the UK version, .com.au the Australian one, anything else international
export default async function TermsPage() {
  const h = await headers()
  return <TermsContent region={legalRegionForHost(h.get('x-forwarded-host') || h.get('host'))} />
}
