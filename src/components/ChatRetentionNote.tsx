'use client'

import { useTranslations } from 'next-intl'
import { Clock } from 'lucide-react'

// Avviso comune a tutte le chat (Bacheca, Affinity, Kordata, Banca del
// Tempo): i messaggi si cancellano da soli dopo 30 giorni (pulizia notturna,
// vedi kumani_nightly_cleanup).
export default function ChatRetentionNote({ className = '' }: { className?: string }) {
  const t = useTranslations('chat')
  return (
    <p className={`flex items-center gap-2 rounded-lg bg-[var(--gold-pale)] px-3 py-2 text-xs font-semibold text-[var(--ink)] ${className}`}>
      <Clock className="h-4 w-4 shrink-0 text-[var(--gold)]" />
      {t('retention')}
    </p>
  )
}
