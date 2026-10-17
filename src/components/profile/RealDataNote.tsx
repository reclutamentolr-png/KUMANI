'use client'

import { useTranslations } from 'next-intl'
import { ChevronDown, Handshake } from 'lucide-react'
import Link from '@/components/LocalizedLink'

// Iscrizione e profilo: invito a usare i dati veri, spiegato col perché
// (persone vere che si danno una mano) e con chi vede cosa, a richiesta.
// «Chi vede cosa» rispecchia quello che l'app mostra davvero agli altri:
// nome (o nome e iniziale del cognome), a volte la città; email, telefono,
// data di nascita e indirizzo solo se si sceglie di mostrarli; chi ti ha
// invitato vede nome, cognome e telefono.
export default function RealDataNote({ className = '' }: { className?: string }) {
  const t = useTranslations('realData')
  return (
    <div className={`rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/60 px-4 py-3 text-sm text-[var(--ink)] ${className}`}>
      <p className="flex items-start gap-2 font-bold">
        <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" aria-hidden /> {t('title')}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-gray-700">{t('text')}</p>
      <details className="group mt-1.5">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-[var(--ink)] underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
          {t('whoSees')} <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-snug text-gray-700">
          <li>{t('seeName')}</li>
          <li>{t('seePrivate')}</li>
          <li>{t('seeSponsor')}</li>
          <li>
            {t('seeNoSale')}{' '}
            <Link href="/privacy" className="font-semibold text-[var(--ink)] underline">
              {t('privacyLink')}
            </Link>
          </li>
        </ul>
      </details>
    </div>
  )
}
