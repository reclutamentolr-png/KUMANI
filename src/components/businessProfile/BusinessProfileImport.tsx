'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Building2, Check, Download } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { hasBusinessProfile, type BusinessProfile } from '@/lib/businessProfile'

// Riga «Usa i dati della Scheda attività» da mettere in cima ai moduli dei
// servizi: riempie i campi con i dati della Scheda (poi si controlla e si
// salva). Senza Scheda compilata invita a compilarla una volta sola.
export default function BusinessProfileImport({
  profile,
  onImport,
  className = '',
}: {
  profile: BusinessProfile | null
  onImport: (profile: BusinessProfile) => void
  className?: string
}) {
  const t = useTranslations('businessProfile')
  const pathname = usePathname()
  const [done, setDone] = useState(false)
  // Il percorso senza la lingua, per tornare qui dalla Scheda
  const from = pathname.replace(/^\/[a-z]{2}(?=\/)/, '')
  const editHref = `/scheda-attivita?from=${encodeURIComponent(from)}`

  if (!hasBusinessProfile(profile)) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/50 px-4 py-3 text-sm text-[var(--ink)] ${className}`}>
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('importEmpty')}
        </span>
        <Link href={editHref} className="shrink-0 font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
          {t('importFill')}
        </Link>
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/60 px-4 py-3 text-sm text-[var(--ink)] ${className}`}>
      <span className="flex min-w-0 items-center gap-2">
        <Building2 className="h-4 w-4 shrink-0 text-[var(--gold)]" />
        <span className="min-w-0">{done ? t('importDone') : t('importHint', { name: profile.companyName || '—' })}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <Link href={editHref} className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
          {t('importEdit')}
        </Link>
        <button
          type="button"
          onClick={() => {
            onImport(profile)
            setDone(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--ink-soft)]"
        >
          {done ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          {t('importButton')}
        </button>
      </span>
    </div>
  )
}
