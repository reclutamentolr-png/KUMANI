'use client'

import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { SCAM_CARDS } from '@/lib/scamCards/cards'
import type { CapturedCard } from '@/lib/scamCards/capture'
import ScamCardView from './ScamCardView'

// Sotto il risultato di un controllo che ha fermato una truffa: la carta di
// quella truffa, appena catturata (o già nell'album)
export default function ScamCardCaptured({ card }: { card: CapturedCard | null | undefined }) {
  const t = useTranslations('scamCards')
  const full = card ? SCAM_CARDS.find((c) => c.no === card.no) : null
  if (!card || !full) return null
  return (
    <section className="flex items-center gap-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4" role="status">
      <div className="shrink-0">
        <ScamCardView card={full} width={84} rarity="catturata" uid={`cap${full.no}`} />
      </div>
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">{t('deckName')}</p>
        <p className="text-base font-extrabold leading-snug text-emerald-950">{card.isNew ? t('capturedNew', { name: full.name }) : t('capturedAgain', { name: full.name })}</p>
        <p className="text-sm text-emerald-900">{full.move}</p>
        <Link href="/app/carte-antitruffa" className="inline-flex min-h-9 items-center gap-1 text-sm font-bold text-emerald-800 underline-offset-2 hover:underline">
          {t('openAlbum')} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}
