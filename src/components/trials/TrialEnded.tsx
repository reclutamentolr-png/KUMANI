'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { leaveTrial } from '@/app/actions/trials'

// Chiude l'accesso da ospite (una volta sola) e propone la registrazione con
// l'invito giusto (link calcolato dal server prima dell'uscita)
export default function TrialEnded({ signupHref }: { signupHref: string }) {
  const t = useTranslations('trials')
  // Il primo link resta: dopo l'uscita la pagina si ricarica senza più l'ospite
  const [href] = useState(signupHref)
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    void leaveTrial()
  }, [])
  return (
    <div className="flex flex-col gap-3 pt-2">
      <a href={href} className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3.5 font-bold text-[var(--ink)] shadow-md">
        {t('endSignup')}
      </a>
      <Link href="/" className="rounded-xl border border-[var(--gold)]/40 px-5 py-3 font-semibold text-[var(--ink)]">
        {t('discover')}
      </Link>
    </div>
  )
}
