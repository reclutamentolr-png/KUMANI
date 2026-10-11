'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { limitTextOf } from '@/lib/limitText'
import { importClients, listImportCandidates } from '@/app/actions/clienti'
import { IMPORT_SOURCES, type ImportCandidate, type ImportSource } from '@/lib/clienti'

// Importa clienti dalla Kumi Card o dalla Rubrica di MemoLife, scegliendo chi
export default function ImportPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations('clienti')
  const router = useRouter()
  const [source, setSource] = useState<ImportSource>('kumi')
  const [rows, setRows] = useState<ImportCandidate[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let alive = true
    listImportCandidates(source).then((list) => {
      if (!alive) return
      setRows(list)
      setPicked([])
    })
    return () => {
      alive = false
    }
  }, [source])

  const available = (rows ?? []).filter((r) => !r.already)
  const allPicked = available.length > 0 && available.every((r) => picked.includes(r.id))
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const run = async () => {
    setBusy(true)
    setMessage(null)
    const result = await importClients(source, picked)
    setBusy(false)
    if (!result.success) {
      setMessage({ ok: false, text: limitTextOf(result) ?? t('errors.saveError') })
      return
    }
    setMessage({ ok: true, text: t('import.done', { count: result.data.imported }) })
    setRows((prev) => (prev ?? []).map((r) => (picked.includes(r.id) ? { ...r, already: true } : r)))
    setPicked([])
    router.refresh()
  }

  return (
    <section className="rounded-3xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-[var(--ink)]">{t('import.title')}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('import.text')}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('import.sourceLabel')}>
        {IMPORT_SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={source === s}
            onClick={() => {
              setRows(null)
              setMessage(null)
              setSource(s)
            }}
            className={`min-h-10 rounded-full px-4 text-sm font-bold ${source === s ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-[var(--gold)]/35 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]'}`}
          >
            {t(`import.sources.${s}`)}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {rows === null ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" aria-label={t('import.loading')} />
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t(`import.empty.${source}`)}</p>
        ) : (
          <>
            {available.length > 0 && (
              <label className="flex min-h-11 items-center gap-3 border-b border-[var(--gold)]/15 text-sm font-bold text-[var(--ink)]">
                <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? [] : available.map((r) => r.id))} className="h-5 w-5 accent-[var(--ink)]" />
                {t('import.selectAll', { count: available.length })}
              </label>
            )}
            <ul className="max-h-80 overflow-y-auto">
              {rows.map((r) => (
                <li key={r.id}>
                  <label className={`flex min-h-12 items-center gap-3 py-1 text-sm ${r.already ? 'opacity-55' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      disabled={r.already}
                      checked={r.already || picked.includes(r.id)}
                      onChange={() => toggle(r.id)}
                      className="h-5 w-5 shrink-0 accent-[var(--ink)]"
                    />
                    <span className="min-w-0">
                      <span className="block break-words font-semibold text-[var(--ink)]">{r.name}</span>
                      <span className="block break-words text-xs text-[var(--muted)]">
                        {[r.phone, r.email, r.detail, r.already ? t('import.already') : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {message && (
        <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${message.ok ? 'bg-[#e7f4ea] text-[#1d6b34]' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy || picked.length === 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {t('import.run', { count: picked.length })}
        </button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[var(--gold)]/40 bg-white px-5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
          {t('import.close')}
        </button>
      </div>
    </section>
  )
}
