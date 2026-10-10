'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { House, LayoutGrid, UserRound, Users, Wallet } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { defaultLocale, locales } from '../../../i18n'

// Menu fisso in basso: barra sul telefono, piccolo dock centrato sul
// computer. In tutta l'area riservata (anche dentro i servizi), solo per chi
// ha fatto l'accesso; mai sulle pagine pubbliche, nell'Admin, nelle aree di
// agenti e traduttori.
const MEMBER_AREAS = [
  '/dashboard',
  '/servizi',
  '/community',
  '/wallet',
  '/regali',
  '/sorprese',
  '/documenti',
  '/marketplace',
  '/donazioni',
  '/recensioni',
  '/catalogo',
  '/guida',
  '/events',
  '/viaggi',
  '/pro',
  '/billing',
  '/pass',
  '/rewards',
  '/offerte',
  '/convivio',
  '/spotlight',
  '/affinity',
  '/veritas',
]

const TABS = [
  { key: 'home', href: '/dashboard', Icon: House, match: ['/dashboard'] },
  { key: 'services', href: '/servizi', Icon: LayoutGrid, match: ['/servizi', '/marketplace'] },
  {
    key: 'community',
    href: '/community',
    Icon: Users,
    match: ['/community', '/dashboard/rete', '/donazioni', '/events', '/convivio', '/spotlight', '/marketplace/listings', '/marketplace/chat', '/marketplace/spotlight', '/marketplace/convivio', '/marketplace/timebank'],
  },
  { key: 'wallet', href: '/wallet', Icon: Wallet, match: ['/wallet', '/regali', '/sorprese'] },
] as const

// Evento con cui "Profilo" apre la finestra del profilo quando la pagina ha
// l'intestazione dell'app (DashboardHeaderActions lo ascolta); altrimenti si
// va in Home con ?profilo=1.
export const OPEN_PROFILE_EVENT = 'kumani:open-profile'

export function barePathOf(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && locales.includes(segments[0])) segments.shift()
  return '/' + segments.join('/')
}

const under = (path: string, area: string) => path === area || path.startsWith(`${area}/`)

// Scheda attiva: quella con il prefisso più lungo (/dashboard/rete è Community)
function activeTab(path: string) {
  let best: { key: string; length: number } | null = null
  for (const tab of TABS)
    for (const area of tab.match) if (under(path, area) && (!best || area.length > best.length)) best = { key: tab.key, length: area.length }
  return best?.key ?? null
}

export default function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('hub')
  // Solo per i soci collegati (letto dalla sessione nel browser, senza rete)
  const [member, setMember] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const update = (user: User | null | undefined) => {
      const role = (user?.app_metadata as { role?: string } | undefined)?.role
      setMember(!!user && role !== 'agent' && role !== 'translator' && role !== 'guest')
    }
    supabase.auth.getSession().then(({ data }) => update(data.session?.user))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => update(session?.user))
    return () => data.subscription.unsubscribe()
  }, [])

  const path = barePathOf(pathname)
  // Anteprima di una sorpresa: a schermo intero, come la vede chi la riceve
  if (!member || !MEMBER_AREAS.some((area) => under(path, area)) || path.endsWith('/anteprima') || under(path, '/marketplace/nexus')) return null
  const current = activeTab(path)

  const openProfile = () => {
    if (document.querySelector('[data-profile-button]')) {
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
      <div aria-hidden className="h-20 shrink-0 print:hidden sm:h-24" />
      {/* Su iPhone niente sfocatura dello sfondo e un proprio livello grafico
          (app-nav in globals.css): con la sfocatura Safari sposta la barra
          mentre la pagina scorre */}
      <nav
        data-app-nav
        data-tour="app-nav"
        aria-label={t('navLabel')}
        className="app-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--gold)]/30 bg-[var(--ink)] px-2 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 shadow-[0_-10px_30px_rgba(23,23,23,0.25)] print:hidden sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:p-1.5"
      >
        <div className="mx-auto flex max-w-md items-stretch gap-1 sm:max-w-none">
          {TABS.map(({ key, href, Icon }) => {
            const active = current === key
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
