'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Gauge, LoaderCircle, RefreshCw } from 'lucide-react'
import { adminTranslatorAudit, type AuditFlag, type LocaleCoverage, type TranslatorAudit } from '@/app/actions/translations'
import { LOCALE_LABELS } from '@/lib/translationLocales'

const FLAG_LABEL: Record<AuditFlag, { text: string; cls: string }> = {
  italian: { text: 'Uguale all’italiano', cls: 'bg-red-100 text-red-700' },
  english: { text: 'Copiato dall’inglese', cls: 'bg-orange-100 text-orange-700' },
  stale: { text: 'Da ricontrollare (italiano cambiato)', cls: 'bg-amber-100 text-amber-800' },
}
// Oltre questa velocità i salvataggi sono troppo rapidi per essere lettura vera
const BURST_LIMIT = 15

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0)

function Stat({ label, value, hint, tone = 'gray' }: { label: string; value: string | number; hint?: string; tone?: 'gray' | 'green' | 'red' | 'amber' }) {
  const toneCls = { gray: 'text-gray-900', green: 'text-emerald-700', red: 'text-red-700', amber: 'text-amber-700' }[tone]
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2" title={hint}>
      <p className={`text-xl font-bold ${toneCls}`}>{value}</p>
      <p className="text-[11px] leading-4 text-gray-500">{label}</p>
    </div>
  )
}

function TranslatorCard({ a }: { a: TranslatorAudit }) {
  const suspicious = a.copiedItalian + a.copiedEnglish
  const burst = a.maxPerMinute >= BURST_LIMIT
  const alarm = suspicious > 0 || burst
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${alarm ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-gray-900">
          {alarm ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          {a.name}
          <span className="text-xs font-normal text-gray-500">{a.locales.map((l) => LOCALE_LABELS[l] ?? l).join(', ') || 'nessuna lingua'}</span>
        </p>
        <p className="text-xs text-gray-500">
          Attivo dal {day(a.firstAt)} al {day(a.lastAt)} · {a.activeDays} {a.activeDays === 1 ? 'giorno' : 'giorni'} di lavoro
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Testi salvati" value={a.saved} hint="Testi che oggi risultano salvati da questo traduttore" />
        <Stat label="Tradotti davvero (cambiati)" value={a.changed} tone="green" hint="Il testo salvato è diverso da quello che c'era già" />
        <Stat label="Parole tradotte" value={a.words} tone="green" />
        <Stat label="Confermati senza modifiche" value={a.confirmed} hint="Ha premuto «va bene così»: è una revisione, non una traduzione" />
        <Stat label="Uguali all’italiano" value={a.copiedItalian} tone={a.copiedItalian ? 'red' : 'gray'} hint="Ha salvato il testo italiano senza tradurlo" />
        <Stat label="Copiati dall’inglese" value={a.copiedEnglish} tone={a.copiedEnglish ? 'red' : 'gray'} hint="Nella sua lingua ha messo il testo inglese" />
        <Stat label="Da ricontrollare" value={a.stale} tone={a.stale ? 'amber' : 'gray'} hint="L'italiano è cambiato dopo la sua traduzione" />
        <Stat label="Max testi in 1 minuto" value={a.maxPerMinute} tone={burst ? 'red' : 'gray'} hint={`Oltre ${BURST_LIMIT} al minuto è difficile aver letto davvero i testi`} />
      </div>

      {a.perLocale.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {a.perLocale.map((l) => (
            <div key={l.locale} className="text-xs text-gray-600">
              <div className="flex justify-between">
                <span className="font-semibold">{LOCALE_LABELS[l.locale] ?? l.locale}</span>
                <span>
                  {l.changed} tradotti ({pct(l.changed, l.total)}%) · {l.confirmed} confermati · su {l.total} testi del sito
                </span>
              </div>
              <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="bg-emerald-500" style={{ width: `${pct(l.changed, l.total)}%` }} />
                <div className="bg-gray-300" style={{ width: `${pct(l.confirmed, l.total)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {burst && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          In un minuto ha salvato {a.maxPerMinute} testi: controlla nelle «Ultime modifiche» se sono traduzioni vere o salvataggi a raffica.
        </p>
      )}

      {a.samples.length > 0 && (
        <details className="group mt-3 rounded-lg border border-gray-200">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-semibold text-gray-700 [&::-webkit-details-marker]:hidden">
            Testi da guardare ({a.samples.length}
            {a.samples.length >= 60 ? '+' : ''})
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-gray-100 border-t border-gray-200">
            {a.samples.map((s) => (
              <li key={`${s.locale}:${s.key}`} className="space-y-1 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${FLAG_LABEL[s.flag].cls}`}>{FLAG_LABEL[s.flag].text}</span>
                  <span className="font-mono text-gray-500">
                    {s.locale} · {s.key}
                  </span>
                </div>
                <p className="text-gray-500">IT: {s.italian}</p>
                <p className="text-gray-900">Salvato: {s.value}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

// Admin → Traduttori → Controllo lavoro: quanto ha tradotto davvero ogni
// traduttore (non solo quante volte ha premuto «salva»)
export default function TranslatorAuditTab() {
  const [data, setData] = useState<{ translators: TranslatorAudit[]; coverage: LocaleCoverage[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    const result = await adminTranslatorAudit()
    setBusy(false)
    if ('error' in result) setError(result.error)
    else {
      setError(null)
      setData(result)
    }
  }, [])

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono, come gli altri pannelli)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl space-y-1 text-sm text-gray-600">
          <p className="flex items-center gap-2 font-semibold text-gray-900">
            <Gauge className="h-5 w-5 text-[var(--gold)]" /> Quanto hanno tradotto davvero
          </p>
          <p>
            «Tradotti davvero» conta solo i testi cambiati rispetto a quelli che c’erano già. I testi confermati senza modifiche, quelli
            lasciati in italiano o copiati dall’inglese non sono traduzioni. Una velocità troppo alta (molti testi in un minuto) fa pensare a
            salvataggi senza lettura.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Aggiorna
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!data && !error && (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {data && (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-semibold text-gray-900">Stato delle lingue</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.coverage.map((c) => (
                <div key={c.locale} className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-900">{LOCALE_LABELS[c.locale] ?? c.locale}</p>
                  <p>
                    {c.overridden} testi corretti dai traduttori su {c.total}
                  </p>
                  <p className={c.stillItalian ? 'text-amber-700' : 'text-emerald-700'}>
                    {c.stillItalian ? `${c.stillItalian} testi ancora in italiano` : 'Nessun testo rimasto in italiano'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {data.translators.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nessun traduttore.</p>
          ) : (
            <div className="space-y-3">
              {data.translators.map((a) => (
                <TranslatorCard key={a.id} a={a} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
