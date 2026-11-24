import { redirect } from 'next/navigation'

// The creator page moved into the one Admin page
export default function OldCreatorsPage() {
  redirect('/admin?tab=creators')
}
