'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, LayoutGrid, LayoutList, type LucideIcon } from 'lucide-react'
import { setHomeView } from '@/app/actions/homeView'
import { FROM_ICONS_KEY, HOME_VIEW_COOKIE, type HomeView } from '@/lib/homeView'

// Interruttore in cima alla Home: Lite · Completa · Icone. Tiene anche il
// cookie allineato alla scelta salvata nel profilo (es. scelta fatta da un
// altro dispositivo), così i servizi sanno dove riporta «‹ Home».
const OPTIONS: { view: HomeView; Icon: LucideIcon }[] = [
  { view: 'lite', Icon: LayoutList },
  { view: 'full', Icon: LayoutDashboard },
  { view: 'icons', Icon: LayoutGrid },
]

export default function HomeViewSwitch({ current, dark = false }: { current: HomeView; dark?: boolean }) {
  const t = useTranslations('homeView')
  const router = useRouter()
  const [selected, setSelected] = useState(current)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    try {
      document.cookie = `${HOME_VIEW_COOKIE}=${current}; path=/; max-age=31536000; samesite=lax`
      // Fuori dalla vista Icone i servizi tornano a «Torna ai servizi»
      if (current !== 'icons') sessionStorage.removeItem(FROM_ICONS_KEY)
    } catch {
      // facoltativo
    }
  }, [current])

  const choose = (view: HomeView) => {
    if (view === selected || pending) return
    setSelected(view)
    startTransition(async () => {
      if (await setHomeView(view)) router.refresh()
      else setSelected(current)
    })
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className={`grid grid-cols-3 gap-1 rounded-xl border p-1 ${dark ? 'border-white/15 bg-white/[0.06]' : 'border-[var(--gold)]/25 bg-white'}`}
    >
      {OPTIONS.map(({ view, Icon }) => {
        const on = selected === view
        return (
          <button
            key={view}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => choose(view)}
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors sm:text-sm ${
              on ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : dark ? 'text-white/70 hover:text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {t(view)}
          </button>
        )
      })}
    </div>
  )
}
