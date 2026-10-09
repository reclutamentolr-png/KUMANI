import type { Metadata, Viewport } from 'next'
import { setRequestLocale } from 'next-intl/server'
import AppShell from '@/components/AppShell'
import MaintenanceGate from '@/components/MaintenanceGate'
import ProfileReminder from '@/components/ProfileReminder'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import ToolGuideButton from '@/components/ToolGuideButton'
import AppNav from '@/components/nav/AppNav'
import RecentToolTracker from '@/components/nav/RecentToolTracker'
import CookieConsent from '@/components/consent/CookieConsent'
import { ROOT_VIEWPORT, rootMetadata } from '@/lib/rootMetadata'
import { defaultLocale, locales } from '../../../i18n'

type LocaleLayoutProps = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

// Layout principale delle pagine con lingua: <html>, <body>, testi e menu.
// La lingua arriva dall'indirizzo (setRequestLocale), non dalla richiesta:
// le pagine pubbliche senza dati personali (Home, Chi siamo, pagine dei
// servizi, ...) possono così essere preparate in anticipo per ogni lingua e
// tenute in memoria. Le pagine personali restano calcolate a ogni richiesta
// (leggono la sessione, oppure dichiarano dynamic = 'force-dynamic').
// La manutenzione la applica il proxy a ogni richiesta, anche alle pagine in
// memoria; qui il MaintenanceGate la mostra a schermo.
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

const validLocale = (locale: string) => (locales.includes(locale) ? locale : defaultLocale)

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const locale = validLocale((await params).locale)
  setRequestLocale(locale)
  return rootMetadata(locale)
}

export const viewport: Viewport = ROOT_VIEWPORT

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const locale = validLocale((await params).locale)
  setRequestLocale(locale)

  return (
    <AppShell locale={locale}>
      <MaintenanceGate>
        {/* Fascia "stai impersonando": in cima a ogni pagina, solo per lo Staff */}
        <ImpersonationBanner />
        {children}
        {/* "Come si usa" nei servizi che hanno una guida */}
        <ToolGuideButton />
        {/* Popup "completa il profilo" dopo 15 minuti sulla piattaforma */}
        <ProfileReminder />
        {/* Menu fisso delle pagine principali e servizi usati di recente */}
        <AppNav />
        <RecentToolTracker />
        {/* Cookie facoltativi: oggi nessuno, il banner resta spento (lib/consent.ts) */}
        <CookieConsent />
      </MaintenanceGate>
    </AppShell>
  )
}
