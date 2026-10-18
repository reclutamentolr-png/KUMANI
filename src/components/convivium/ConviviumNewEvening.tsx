'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import ConviviumForm from '@/components/convivium/ConviviumForm'

// «Nuova serata»: aperta solo la prima volta (nessuna serata ancora); dopo
// resta chiusa con il pulsante «Crea una nuova serata», così l'elenco delle
// serate non si confonde con il modulo.
export default function ConviviumNewEvening({ startOpen }: { startOpen: boolean }) {
  const t = useTranslations('convivium')
  const [open, setOpen] = useState(startOpen)

  if (!open) {
    return (
      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-extrabold text-[var(--ink)]">{t('createAnother')}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('createAnotherHint')}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow"
        >
          <Plus className="h-5 w-5" aria-hidden /> {t('createAnother')}
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-xl font-extrabold text-[var(--ink)]">{t('newEvening')}</h2>
      {/* «Annulla» c'è sempre: richiude la scheda sul pulsante «Crea una nuova serata» */}
      <ConviviumForm onCancel={() => setOpen(false)} />
    </section>
  )
}
