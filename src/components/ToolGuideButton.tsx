'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BookOpen } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { toolGuideFor } from '@/lib/guides/toolGuides'
import { locales } from '../../i18n'

// Pulsante "Come si usa" fisso in basso a sinistra nei servizi che hanno una
// guida (src/lib/guides/toolGuides.ts). Negli strumenti del marketplace sta
// sopra il pulsante "Condividi", altrove al suo posto.
export default function ToolGuideButton() {
  const pathname = usePathname()
  const t = useTranslations('guides')

  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && locales.includes(segments[0])) segments.shift()
  const barePath = '/' + segments.join('/')
  const slug = toolGuideFor(barePath)
  if (!slug) return null

  // Il Kumano del Giorno non ha il pulsante "Condividi"
  const aboveShare = barePath.startsWith('/marketplace/') && slug !== 'spotlight'

  return (
    <Link
      href={`/guida/${slug}`}
      className={`fixed left-4 z-40 flex items-center gap-2 rounded-full border border-[var(--gold)]/60 bg-[var(--gold-pale)] px-4 py-3 text-sm font-semibold text-[var(--ink)] shadow-[0_12px_35px_rgba(23,23,23,0.25)] transition-all hover:-translate-y-0.5 hover:border-[var(--gold)] print:hidden ${
        aboveShare ? 'bottom-[4.5rem]' : 'bottom-4'
      }`}
    >
      <BookOpen className="h-4 w-4 text-[var(--gold)]" />
      {t('howToUse')}
    </Link>
  )
}
