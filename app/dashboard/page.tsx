import { redirect } from 'next/navigation'

const TABS = ['overview', 'ideas', 'myideas', 'filming', 'film', 'script', 'uploads', 'aiuploads', 'carousel', 'scheduler', 'library']

export default async function DashboardIndex({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams
  const t = Array.isArray(tab) ? tab[0] : tab
  redirect(`/dashboard/${t && TABS.includes(t) ? t : 'overview'}`)
}
