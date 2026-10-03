'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BookOpen } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { toolGuideFor } from '@/lib/guides/toolGuides'
import { locales } from '../../i18n'

// Pulsante "Come si usa" fisso in basso a destra nei servizi che hanno una
// guida (src/lib/guides/toolGuides.ts); "Condividi" sta in basso a sinistra.
// Sul telefono solo l'icona. Se la pagina ha già un pulsante in basso a
// destra (data-fab, es. "Nuovo"), sale sopra di lui (globals.css).
export default function ToolGuideButton() {
  const pathname = usePathname()
  const t = useTranslations('guides')

  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && locales.includes(segments[0])) segments.shift()
  const barePath = '/' + segments.join('/')
  const slug = toolGuideFor(barePath)
  if (!slug) return null

  return (
    <Link
      // La guida sa da dove arrivi: in alto mostra "Torna a …" verso il servizio
      href={`/guida/${slug}?from=${encodeURIComponent(barePath)}`}
      aria-label={t('howToUse')}
      title={t('howToUse')}
      className="tool-guide-fab fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center gap-2 rounded-full border border-[var(--gold)]/60 bg-[var(--gold-pale)] text-sm font-semibold text-[var(--ink)] shadow-[0_12px_35px_rgba(23,23,23,0.25)] transition-all hover:-translate-y-0.5 hover:border-[var(--gold)] print:hidden sm:h-auto sm:w-auto sm:px-4 sm:py-3"
    >
      <BookOpen className="h-5 w-5 text-[var(--gold)] sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">{t('howToUse')}</span>
    </Link>
  )
}
