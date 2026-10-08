'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/client'
import { defaultLocale } from '../../i18n'

// Pulsanti della pagina 404: «Torna indietro» (la schermata di prima, se è
// dentro KUMANI) e poi la Dashboard per chi è collegato, la Home per gli
// altri. Così chi ha l'accesso non finisce sulla homepage pubblica.
export default function NotFoundActions({ backLabel, homeLabel, dashboardLabel }: { backLabel: string; homeLabel: string; dashboardLabel: string }) {
  const router = useRouter()
  const locale = useLocale()
  const [loggedIn, setLoggedIn] = useState(false)
  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setLoggedIn(!!data.session))
      .catch(() => {})
  }, [])

  const back = () => {
    const sameSite = document.referrer.startsWith(window.location.origin)
    if (sameSite && window.history.length > 1) return router.back()
    const target = loggedIn ? '/dashboard' : '/'
    router.push(locale === defaultLocale ? target : `/${locale}${target === '/' ? '' : target}`)
  }

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <button type="button" onClick={back} className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)]">
        {backLabel}
      </button>
      <Link href={loggedIn ? '/dashboard' : '/'} className="rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">
        {loggedIn ? dashboardLabel : homeLabel}
      </Link>
    </div>
  )
}
