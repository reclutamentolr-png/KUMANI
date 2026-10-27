import { Suspense } from 'react'
import InstallAppBanner from '@/components/InstallAppBanner'
import NavigationProgress from '@/components/nav/NavigationProgress'
import type { Metadata, Viewport } from 'next'
import { setRequestLocale } from 'next-intl/server'
import AppShell from '@/components/AppShell'
import MaintenanceGate from '@/components/MaintenanceGate'
import ProfileReminder from '@/components/ProfileReminder'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import ToolGuideButton from '@/components/ToolGuideButton'
import AppNav from '@/components/nav/AppNav'
import UpdateWatcher from '@/components/UpdateWatcher'
import KumiChat from '@/components/kumiChat/KumiChat'
import AppHeader from '@/components/nav/AppHeader'
import DesktopAppBar from '@/components/nav/DesktopAppBar'
import SessionTracker from '@/components/SessionTracker'
import PresencePing from '@/components/analytics/PresencePing'
import DailyKarmaPing from '@/components/DailyKarmaPing'
import RecentToolTracker from '@/components/nav/RecentToolTracker'
import CookieConsent from '@/components/consent/CookieConsent'
import { ConsentProvider } from '@/components/consent/ConsentGate'
import { getConsentConfig } from '@/lib/consentServer'
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
// Preparate in anticipo solo le lingue principali (pubblicazione più veloce):
// le altre si creano alla prima visita e poi restano pronte come queste.
const PREBUILT_LOCALES = ['it', 'en']
export function generateStaticParams() {
  return locales.filter((locale) => PREBUILT_LOCALES.includes(locale)).map((locale) => ({ locale }))
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
  // Banner cookie impostato da Admin → Impostazioni (oggi spento)
  const consentConfig = await getConsentConfig()

  return (
    <AppShell locale={locale}>
      <ConsentProvider config={consentConfig}>
      <MaintenanceGate>
        {/* Barra dorata in alto appena si tocca un link: il clic è arrivato */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {/* Fascia "stai impersonando": in cima a ogni pagina, solo per lo Staff */}
        <ImpersonationBanner />
        {/* Dal computer, la barra dell'app anche dentro i servizi */}
        <DesktopAppBar>
          <AppHeader inServices />
        </DesktopAppBar>
        {children}
        {/* "Come si usa" nei servizi che hanno una guida */}
        <ToolGuideButton />
        {/* Popup "completa il profilo" dopo 15 minuti sulla piattaforma */}
        <ProfileReminder />
        {/* Menu fisso delle pagine principali e servizi usati di recente */}
        <AppNav />
        <RecentToolTracker />
        {/* Sessioni d'uso (tempo medio per sessione nelle statistiche dell'Admin) */}
        <SessionTracker />
        {/* «In questo momento» in Admin → Uso reale */}
        <PresencePing />
        {/* KU Karma dell'accesso giornaliero anche per chi resta connesso */}
        <DailyKarmaPing />
        {/* Aggiornamenti senza chiudere l'app: versione di questa pagina (Vercel) */}
        <UpdateWatcher version={process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'dev'} />
        {/* «Porta KUMANI con te»: installare il sito come app (homepage e dashboard) */}
        <InstallAppBanner />
        {/* Chiedi a KUMI: per chi visita KUMANI, in tutte le pagine finché non entra con il suo account */}
        <KumiChat />
        {/* Banner dei cookie: solo se acceso dall'Admin (lib/consent.ts) */}
        <CookieConsent />
      </MaintenanceGate>
      </ConsentProvider>
    </AppShell>
  )
}
