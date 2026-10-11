'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileSpreadsheet, LoaderCircle } from 'lucide-react'
import { exportClienti } from '@/app/actions/clienti'
import { downloadCsv, toCsv } from '@/lib/magazzino'
import { EXPORT_KINDS, type ExportKind } from '@/lib/clienti'

// Esportazione per il commercialista: un file CSV (Excel) per tipo
export default function ExportBox() {
  const t = useTranslations('clienti')
  const [busy, setBusy] = useState<ExportKind | null>(null)
  const [error, setError] = useState(false)

  const download = async (kind: ExportKind) => {
    setBusy(kind)
    setError(false)
    const rows = await exportClienti(kind)
    setBusy(null)
    if (!rows) {
      setError(true)
      return
    }
    downloadCsv(`${t(`export.file.${kind}`)}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
  }

  return (
    <section className="rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--ink)]">
        <FileSpreadsheet className="h-4 w-4 text-[var(--gold)]" aria-hidden="true" />
        {t('export.title')}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('export.text')}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EXPORT_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={busy !== null}
            onClick={() => download(kind)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-white px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-60"
          >
            {busy === kind && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {t(`export.kinds.${kind}`)}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {t('errors.saveError')}
        </p>
      )}
    </section>
  )
}
