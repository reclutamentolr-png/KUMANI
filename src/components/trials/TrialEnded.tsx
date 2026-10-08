'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { leaveTrial, trialSignupHref } from '@/app/actions/trials'

// Chiude l'accesso da ospite e propone la registrazione con l'invito giusto
export default function TrialEnded() {
  const t = useTranslations('trials')
  const [href, setHref] = useState<string | null>(null)
  useEffect(() => {
    // L'invito si legge prima di uscire (serve l'accesso da ospite)
    trialSignupHref()
      .then((h) => setHref(h))
      .catch(() => setHref('/register'))
      .finally(() => {
        void leaveTrial()
      })
  }, [])
  return (
    <div className="flex flex-col gap-3 pt-2">
      {href ? (
        <a href={href} className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3.5 font-bold text-[var(--ink)] shadow-md">
          {t('endSignup')}
        </a>
      ) : (
        <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-5 py-3.5 font-semibold text-gray-500">
          <LoaderCircle className="h-5 w-5 animate-spin" />
        </span>
      )}
      <Link href="/" className="rounded-xl border border-[var(--gold)]/40 px-5 py-3 font-semibold text-[var(--ink)]">
        {t('discover')}
      </Link>
    </div>
  )
}
