'use client'

import { useEffect, useState } from 'react'
import { Globe2, Lock, LoaderCircle } from 'lucide-react'
import { adminGetEnabledLocales, adminSetEnabledLocales } from '@/app/actions/languages'

// Admin → Generale → Lingue del sito: quali lingue il pubblico può scegliere.
// Le lingue spente restano complete (ogni testo è sempre in tutte e 7) e si
// possono vedere in anteprima dallo Staff e dai traduttori.
const LANGUAGES = [
  { code: 'it', name: 'Italiano', note: 'Lingua base: sempre attiva' },
  { code: 'en', name: 'Inglese (English)' },
  { code: 'fr', name: 'Francese (Français)' },
  { code: 'es', name: 'Spagnolo (Español)' },
  { code: 'pt', name: 'Portoghese (Português)' },
  { code: 'de', name: 'Tedesco (Deutsch)' },
  { code: 'ru', name: 'Russo (Русский)' },
]

export default function LanguagesPanel({ canWrite }: { canWrite: boolean }) {
  const [enabled, setEnabled] = useState<string[] | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    adminGetEnabledLocales().then((result) => {
      if (cancelled) return
      if (result.success) {
        setEnabled(result.locales)
        setSaved(result.locales)
      } else {
        setMessage({ ok: false, text: result.error })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = (code: string) => {
    if (code === 'it' || !enabled) return
    setMessage(null)
    setEnabled(enabled.includes(code) ? enabled.filter((c) => c !== code) : [...enabled, code])
  }

  const changed = enabled !== null && [...enabled].sort().join() !== [...saved].sort().join()

  const save = async () => {
    if (!enabled) return
    setSaving(true)
    const result = await adminSetEnabledLocales(enabled)
    setSaving(false)
    if (result.success) {
      setEnabled(result.locales)
      setSaved(result.locales)
      setMessage({ ok: true, text: 'Salvato: le lingue cambiano sul sito entro un minuto.' })
    } else {
      setMessage({ ok: false, text: result.error })
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[var(--ink)] p-6 text-white shadow-lg">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Globe2 className="h-6 w-6 text-[var(--gold-bright)]" /> Lingue del sito
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/75">
          Scegli quali lingue il pubblico può usare. Una lingua spenta sparisce dal menu delle lingue e chi prova ad aprirla
          (dalla lingua del telefono, da un link o da Google) vede la stessa pagina in italiano. I testi restano sempre
          aggiornati in tutte le lingue: lo Staff e i traduttori possono vedere quelle spente in anteprima (per esempio
          aprendo l&apos;indirizzo con /de davanti).
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        {enabled === null ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Caricamento…
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {LANGUAGES.map((lang) => {
              const on = lang.code === 'it' || enabled.includes(lang.code)
              const locked = lang.code === 'it' || !canWrite
              return (
                <li key={lang.code} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-900">{lang.name}</p>
                    <p className="text-xs text-gray-500">
                      {lang.note ?? (on ? 'Attiva: visibile a tutti' : 'Spenta: nascosta al pubblico')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${lang.name}: ${on ? 'attiva' : 'spenta'}`}
                    disabled={locked}
                    onClick={() => toggle(lang.code)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
                      on ? 'bg-[var(--gold)]' : 'bg-gray-300'
                    } ${lang.code === 'it' ? 'opacity-70' : ''}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                    {lang.code === 'it' && <Lock className="absolute -right-5 h-3.5 w-3.5 text-gray-400" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {message && (
          <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>
        )}

        {canWrite ? (
          <button
            type="button"
            onClick={save}
            disabled={!changed || saving}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--ink-soft)] disabled:opacity-40"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Salva
          </button>
        ) : (
          <p className="mt-4 text-xs text-gray-500">Puoi vedere le lingue attive, ma per cambiarle serve il permesso Impostazioni (modifica).</p>
        )}
      </div>
    </div>
  )
}
