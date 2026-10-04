import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { Star } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import DashboardHeaderActions from '@/components/DashboardHeaderActions'
import { createClient } from '@/lib/supabase/server'
import { hasAdminRole } from '@/lib/admin-auth'
import type { MyProfile } from '@/lib/myProfile'

// Intestazione delle pagine principali (Home, Servizi, Community, Wallet,
// Rete, Documenti, Preferiti, Donazioni): la stessa barra della Home con
// preferiti, lingua, profilo, documenti, Wallet ed esci, così da ogni pagina
// si va subito nelle altre. Sotto, se c'è, il titolo della pagina.
// Senza accesso non mostra nulla (la pagina usa la sua intestazione pubblica).
export default async function AppHeader({
  title,
  subtitle,
  icon,
  loaded,
}: {
  title?: string
  subtitle?: string
  icon?: ReactNode
  // Già letti dalla pagina (es. la Home): non si rileggono
  loaded?: { user: User; profile: MyProfile | null; isAdmin: boolean }
}) {
  const t = await getTranslations('dashboard')
  let session = loaded
  if (!session) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const [adminRole, { data: profile }] = await Promise.all([
      hasAdminRole(supabase, user.id),
      supabase.rpc('get_my_profile').maybeSingle<MyProfile>(),
    ])
    session = { user, profile, isAdmin: adminRole || profile?.is_admin === true }
  }

  return (
    <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-[0_8px_30px_rgba(23,23,23,0.18)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/dashboard" className="min-w-0">
            <span className="hidden text-2xl font-bold tracking-tight text-white sm:block">{t('programTitle')}</span>
            <span className="text-xl font-bold tracking-tight text-white sm:hidden">Kumani</span>
          </Link>
          {/* Stella oro: i servizi preferiti */}
          <Link
            href="/marketplace/preferiti?from=dashboard"
            aria-label={t('goToFavorites')}
            title={t('goToFavorites')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--gold-bright)] transition-transform hover:scale-110"
          >
            <Star className="h-7 w-7 drop-shadow-[0_0_8px_rgba(231,197,106,0.75)]" fill="currentColor" strokeWidth={1.5} />
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sul telefono la lingua è nel menu ☰ */}
          <span className="hidden sm:block">
            <LanguageSwitcher dark compact />
          </span>
          <DashboardHeaderActions user={session.user} profile={session.profile} isAdmin={session.isAdmin} />
        </div>
      </div>
      {title && (
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-4 py-3 sm:px-6 lg:px-8">
            {icon && <span className="shrink-0 text-[var(--gold-bright)]">{icon}</span>}
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h1>
              {subtitle && <p className="text-sm text-white/65">{subtitle}</p>}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
