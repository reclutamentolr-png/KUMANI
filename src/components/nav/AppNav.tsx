'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { House, LayoutGrid, UserRound, Users, Wallet } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { defaultLocale, locales } from '../../../i18n'

// Menu fisso delle pagine principali: barra in basso sul telefono, piccolo
// dock centrato sul computer. Solo sulle pagine "di casa" (non dentro i
// servizi, che hanno già "Torna alla Dashboard", Condividi e Come si usa).
const HUB_PATHS = ['/dashboard', '/dashboard/rete', '/servizi', '/community', '/wallet', '/documenti', '/marketplace/preferiti']

const TABS = [
  { key: 'home', href: '/dashboard', Icon: House, match: ['/dashboard'] },
  { key: 'services', href: '/servizi', Icon: LayoutGrid, match: ['/servizi', '/marketplace/preferiti'] },
  { key: 'community', href: '/community', Icon: Users, match: ['/community', '/dashboard/rete'] },
  { key: 'wallet', href: '/wallet', Icon: Wallet, match: ['/wallet'] },
] as const

// Evento con cui "Profilo" apre la finestra del profilo quando si è già in
// Home (DashboardHeaderActions lo ascolta); altrove si va in Home con ?profilo=1.
export const OPEN_PROFILE_EVENT = 'kumani:open-profile'

export function barePathOf(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && locales.includes(segments[0])) segments.shift()
  return '/' + segments.join('/')
}

export default function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('hub')
  const path = barePathOf(pathname)
  if (!HUB_PATHS.includes(path)) return null

  const openProfile = () => {
    if (path === '/dashboard') {
      window.dispatchEvent(new Event(OPEN_PROFILE_EVENT))
      return
    }
    router.push(`${locale === defaultLocale ? '' : `/${locale}`}/dashboard?profilo=1`)
  }

  const itemClass = (active: boolean) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-bold transition-colors sm:flex-none sm:flex-row sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
      active ? 'text-[var(--gold-bright)] sm:bg-white/10' : 'text-white/70 hover:text-white'
    }`

  return (
    <>
      {/* Spazio in fondo alla pagina, così il menu non copre l'ultimo contenuto */}
      <div aria-hidden className="h-20 print:hidden sm:h-24" />
      <nav
        data-app-nav
        data-tour="app-nav"
        aria-label={t('navLabel')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--gold)]/30 bg-[var(--ink)]/95 px-2 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 shadow-[0_-10px_30px_rgba(23,23,23,0.25)] backdrop-blur print:hidden sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:p-1.5"
      >
        <div className="mx-auto flex max-w-md items-stretch gap-1 sm:max-w-none">
          {TABS.map(({ key, href, Icon, match }) => {
            const active = (match as readonly string[]).includes(path)
            return (
              <Link key={key} href={href} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.4 : 1.9} />
                <span className="truncate">{t(`nav_${key}`)}</span>
              </Link>
            )
          })}
          <button type="button" onClick={openProfile} className={itemClass(false)}>
            <UserRound className="h-5 w-5 shrink-0" strokeWidth={1.9} />
            <span className="truncate">{t('nav_profile')}</span>
          </button>
        </div>
      </nav>
    </>
  )
}
