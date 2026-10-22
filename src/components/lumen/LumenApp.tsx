'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Clapperboard, FilePlus2, LoaderCircle, Play, Sparkles, Trash2 } from 'lucide-react'
import { deleteLumenScript, saveLumenScript } from '@/app/actions/lumen'
import { countWords, estimateSeconds, formatDuration, LUMEN_BODY_MAX, LUMEN_TITLE_MAX, type LumenScript } from '@/lib/lumen'
import LumenAiDialog from './LumenAiDialog'
import LumenPrompter from './LumenPrompter'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// KUMANI LUMEN: elenco dei copioni, editor con salvataggio automatico e
// durata stimata; «Avvia LUMEN» apre il teleprompter a tutto schermo.
export default function LumenApp({ initialScripts }: { initialScripts: LumenScript[] }) {
  const t = useTranslations('lumen')
  const locale = useLocale()
  const [scripts, setScripts] = useState(initialScripts)
  const [currentId, setCurrentId] = useState<string | null>(initialScripts[0]?.id ?? null)
  const [title, setTitle] = useState(initialScripts[0]?.title ?? '')
  const [body, setBody] = useState(initialScripts[0]?.body ?? '')
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [prompter, setPrompter] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  // Evita due creazioni dello stesso copione se si scrive mentre si salva
  const saving = useRef<Promise<unknown> | null>(null)
  const idRef = useRef(currentId)

  const save = async (nextTitle: string, nextBody: string) => {
    if (saving.current) await saving.current
    if (!idRef.current && !nextTitle.trim() && !nextBody.trim()) return
    setSaveState('saving')
    const run = saveLumenScript({ id: idRef.current ?? undefined, title: nextTitle, body: nextBody })
    saving.current = run
    const r = await run
    saving.current = null
    if (!r.success) {
      setSaveState('error')
      setError(t(`error_${r.message}` as 'error_saveError'))
      return
    }
    setError(null)
    setSaveState('saved')
    idRef.current = r.data.id
    setCurrentId(r.data.id)
    setScripts((list) => [r.data, ...list.filter((s) => s.id !== r.data.id)])
  }

  // Salvataggio automatico poco dopo l'ultima modifica
  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => {
      setDirty(false)
      void save(title, body)
    }, 1200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si salva solo al cambio del testo
  }, [dirty, title, body])

  const flush = async () => {
    if (!dirty) return
    setDirty(false)
    await save(title, body)
  }

  const open = async (script: LumenScript | null) => {
    await flush()
    idRef.current = script?.id ?? null
    setCurrentId(script?.id ?? null)
    setTitle(script?.title ?? '')
    setBody(script?.body ?? '')
    setSaveState('idle')
    setError(null)
  }

  const remove = async () => {
    if (!currentId || !window.confirm(t('deleteConfirm'))) return
    const id = currentId
    const r = await deleteLumenScript(id)
    if (!r.success) return setError(t('error_deleteError'))
    const rest = scripts.filter((s) => s.id !== id)
    setScripts(rest)
    setDirty(false)
    await open(rest[0] ?? null)
  }

  const start = async () => {
    await flush()
    setPrompter(true)
  }

  const words = countWords(body)
  const seconds = estimateSeconds(body)
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-[var(--gold)]/25 bg-white p-3">
        <button
          type="button"
          onClick={() => open(null)}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-3 text-sm font-bold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]"
        >
          <FilePlus2 className="h-4 w-4" /> {t('newScript')}
        </button>
        <button
          type="button"
          onClick={async () => {
            await flush()
            setAiOpen(true)
          }}
          className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-[var(--gold)]/10 px-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold)]/20"
        >
          <Sparkles className="h-4 w-4 text-[var(--gold)]" /> {t('aiOpen')}
        </button>
        <p className="mb-1 mt-3 px-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{t('myScripts')}</p>
        {scripts.length === 0 ? (
          <p className="px-1 text-sm text-[var(--muted)]">{t('noScripts')}</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto lg:max-h-[28rem]">
            {scripts.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => open(s)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-sm ${s.id === currentId ? 'bg-[var(--gold)]/15 font-bold text-[var(--ink)]' : 'text-[var(--ink)] hover:bg-gray-50'}`}
                >
                  <span className="block truncate">{s.title.trim() || s.body.trim().slice(0, 40) || t('untitled')}</span>
                  <span className="block text-xs font-normal text-[var(--muted)]">
                    {dateFmt.format(new Date(s.updated_at))} · {formatDuration(estimateSeconds(s.body))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value.slice(0, LUMEN_TITLE_MAX))
            setDirty(true)
          }}
          placeholder={t('titlePlaceholder')}
          aria-label={t('titleLabel')}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base font-bold text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none"
        />
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value.slice(0, LUMEN_BODY_MAX))
            setDirty(true)
          }}
          placeholder={t('bodyPlaceholder')}
          aria-label={t('bodyLabel')}
          rows={12}
          className="mt-3 w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-base leading-relaxed text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>
            {t('stats', { words, duration: formatDuration(seconds) })}
          </span>
          <span aria-live="polite" className={saveState === 'error' ? 'font-semibold text-red-700' : ''}>
            {saveState === 'saving' && (
              <span className="inline-flex items-center gap-1">
                <LoaderCircle className="h-3 w-3 animate-spin" /> {t('saving')}
              </span>
            )}
            {saveState === 'saved' && !dirty && t('saved')}
            {saveState === 'error' && error}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!body.trim()}
            onClick={start}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 text-base font-extrabold text-[var(--ink)] shadow-sm hover:brightness-105 disabled:opacity-40 sm:flex-none"
          >
            <Play className="h-5 w-5" fill="currentColor" /> {t('start')}
          </button>
          {currentId && (
            <button type="button" onClick={remove} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 hover:border-red-300 hover:text-red-700">
              <Trash2 className="h-4 w-4" /> {t('delete')}
            </button>
          )}
        </div>

        <div className="mt-5 rounded-xl bg-[var(--gold)]/10 p-4 text-sm text-[var(--ink)]">
          <p className="flex items-center gap-2 font-bold">
            <Clapperboard className="h-4 w-4 text-[var(--gold)]" /> {t('tipsTitle')}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
            <li>{t('tip1')}</li>
            <li>{t('tip2')}</li>
            <li>{t('tip3')}</li>
          </ul>
        </div>
      </section>

      {aiOpen && (
        <LumenAiDialog
          onClose={() => setAiOpen(false)}
          onCreated={(script) => {
            setAiOpen(false)
            setScripts((list) => [script, ...list.filter((x) => x.id !== script.id)])
            idRef.current = script.id
            setCurrentId(script.id)
            setTitle(script.title)
            setBody(script.body)
            setDirty(false)
            setSaveState('saved')
            setError(null)
          }}
        />
      )}
      {prompter && <LumenPrompter title={title} text={body} onClose={() => setPrompter(false)} />}
    </div>
  )
}
