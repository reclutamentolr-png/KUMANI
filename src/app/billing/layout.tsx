import type { Metadata, Viewport } from 'next'
import { getLocale } from 'next-intl/server'
import AppShell from '@/components/AppShell'
import { ROOT_VIEWPORT, rootMetadata } from '@/lib/rootMetadata'

// /billing sta fuori dalle lingue (il proxy non la riscrive: ritorno da
// Stripe), quindi ha il suo <html> e <body>, come prima col layout di
// partenza. Pagina personale: sempre calcolata a ogni richiesta.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return rootMetadata(await getLocale())
}

export const viewport: Viewport = ROOT_VIEWPORT

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return <AppShell locale={locale}>{children}</AppShell>
}
