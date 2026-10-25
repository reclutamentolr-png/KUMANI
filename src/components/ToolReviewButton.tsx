'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Star } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { locales } from '../../i18n'

// Pulsante «Recensisci» fisso in basso a sinistra dentro ogni servizio, sopra
// «Condividi» (globals.css). Compare solo a chi può recensire quel servizio
// (abbonamento, Pass o licenza omaggio da almeno 7 giorni); chi l'ha già
// recensito vede «La tua recensione» per modificarla. Mai nell'Angolo Bambini.
export default function ToolReviewButton({ subjects }: { subjects: Record<string, boolean> }) {
  const pathname = usePathname()
  const t = useTranslations('reviews')

  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && locales.includes(segments[0])) segments.shift()
  const tool = segments[0] === 'app' ? segments[1] : undefined
  if (!tool || tool === 'angolo-bambini' || !(tool in subjects)) return null
  const label = subjects[tool] ? t('toolButtonEdit') : t('toolButton')

  return (
    <Link
      href={`/recensioni/scrivi?s=${encodeURIComponent(tool)}`}
      className="tool-review-fab fixed bottom-4 left-4 z-40 flex h-10 items-center gap-1.5 rounded-full border border-[var(--gold)]/60 bg-white px-3.5 text-sm font-semibold text-[var(--ink)] shadow-[0_10px_30px_rgba(23,23,23,0.22)] transition-all hover:-translate-y-0.5 hover:border-[var(--gold)] print:hidden"
    >
      <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden />
      {label}
    </Link>
  )
}
