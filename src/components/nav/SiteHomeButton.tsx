'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Home } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/client'

// Pagine pubbliche di KUMANI (schede dei servizi, Manuale, regali, inviti…):
// oltre al logo, un pulsante chiaro per tornare. A chi non è iscritto «Torna
// alla home» (/), a chi ha fatto l'accesso «La mia Home» (/dashboard). La
// sessione si legge nel browser, così la pagina resta uguale per tutti.
export default function SiteHomeButton({ tone = 'dark', className = '' }: { tone?: 'dark' | 'light'; className?: string }) {
  const t = useTranslations('common')
  const [member, setMember] = useState(false)
  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setMember(!!data.session))
      .catch(() => {})
  }, [])
  const style =
    tone === 'dark'
      ? 'border-white/25 text-white hover:bg-white/10'
      : 'border-[var(--ink)]/20 bg-white text-[var(--ink)] hover:bg-[var(--paper)]'
  return (
    <Link
      href={member ? '/dashboard' : '/'}
      className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${style} ${className}`}
    >
      <Home className="h-4 w-4" aria-hidden /> {member ? t('siteMyHome') : t('siteBackHome')}
    </Link>
  )
}
