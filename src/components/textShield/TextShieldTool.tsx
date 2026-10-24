'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, Check, ClipboardCopy, Download, EyeOff, FileUp, Loader2, Plus, RotateCcw, ShieldCheck, Sparkles, Trash2, Undo2, X } from 'lucide-react'
import { PII_TYPES, detect, leftovers, protect, restore, type Finding, type PiiType } from '@/lib/textShield/detect'
import { readTextFile } from '@/lib/textShield/files'
import { loadSessions, saveSessions, type ShieldSession } from '@/lib/textShield/sessions'

// TESTO PROTETTO (Proteggi, piano Plus): prima di dare un testo a ChatGPT,
// Gemini o un'altra IA, KUMANI trova e sostituisce i dati personali con
// etichette neutre ([PERSONA 1], [IBAN 1]…). Dopo, nella risposta dell'IA,
// rimette i dati veri. Tutto nel browser: il testo non va mai al server.

// Colori per tipo di dato (evidenziatore)
const TONE: Record<PiiType, string> = {
  person: 'bg-[#fde2c8] text-[#7a3e0b]',
  email: 'bg-[#dbeafe] text-[#1e3a8a]',
  phone: 'bg-[#dbeafe] text-[#1e3a8a]',
  cf: 'bg-[#fce7f3] text-[#831843]',
  vat: 'bg-[#fce7f3] text-[#831843]',
  iban: 'bg-[#dcfce7] text-[#14532d]',
  card: 'bg-[#dcfce7] text-[#14532d]',
  birth: 'bg-[#ede9fe] text-[#4c1d95]',
  date: 'bg-[#ede9fe] text-[#4c1d95]',
  address: 'bg-[#fef9c3] text-[#713f12]',
  plate: 'bg-[#e0f2fe] text-[#0c4a6e]',
  docnum: 'bg-[#e0f2fe] text-[#0c4a6e]',
  custom: 'bg-[#e5e7eb] text-[#111827]',
}

const MAX_CHARS = 200_000
const now = () => Date.now()
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${now()}-${Math.random().toString(36).slice(2)}`)

export default function TextShieldTool({ owner }: { owner: string }) {
  const t = useTranslations('textShield')
  const locale = useLocale()
  const [text, setText] = useState('')
  const [allDates, setAllDates] = useState(false)
  const [custom, setCustom] = useState<string[]>([])
  const [customDraft, setCustomDraft] = useState('')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [offTypes, setOffTypes] = useState<Set<PiiType>>(new Set())
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [sessions, setSessions] = useState<ShieldSession[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const list = loadSessions(owner)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chiavi salvate in questo browser, lette dopo il primo disegno
    setSessions(list)
    setSessionId(list[0]?.id ?? null)
  }, [owner])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const labels = useMemo(() => Object.fromEntries(PII_TYPES.map((p) => [p, t(`labels.${p}`)])) as Record<PiiType, string>, [t])
  const findings = useMemo(() => (text.trim() ? detect(text, { allDates, custom }) : []), [text, allDates, custom])
  const active = useMemo(() => findings.filter((f) => !excluded.has(f.key) && !offTypes.has(f.type)), [findings, excluded, offTypes])
  const result = useMemo(() => protect(text, active, labels), [text, active, labels])
  const left = useMemo(() => leftovers(result.text), [result.text])
  const countByType = useMemo(() => {
    const c: Partial<Record<PiiType, Set<string>>> = {}
    for (const f of findings) (c[f.type] ??= new Set()).add(f.key)
    return c
  }, [findings])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setLoading(true)
    const read = await readTextFile(file)
    setLoading(false)
    if ('error' in read) return setNotice({ kind: 'error', text: t(`fileError.${read.error}`) })
    setText(read.text.slice(0, MAX_CHARS))
    setExcluded(new Set())
    setNotice({ kind: 'ok', text: t('fileRead', { name: file.name }) })
  }

  const toggleKey = (key: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const toggleType = (type: PiiType) =>
    setOffTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })

  const addCustom = (value: string) => {
    const w = value.replace(/\s+/g, ' ').trim()
    if (w.length < 2 || custom.some((c) => c.toLowerCase() === w.toLowerCase())) return
    setCustom((c) => [...c, w])
    setCustomDraft('')
  }

  // La chiave per rimettere i dati si salva quando il testo protetto esce dalla pagina
  const remember = () => {
    if (!Object.keys(result.map).length) return
    const title = text.replace(/\s+/g, ' ').trim().slice(0, 60)
    const session: ShieldSession = { id: newId(), title, createdAt: now(), map: result.map }
    const same = sessions.find((s) => JSON.stringify(s.map) === JSON.stringify(result.map))
    if (same) return setSessionId(same.id)
    const list = [session, ...sessions]
    setSessions(list.slice(0, 10))
    setSessionId(session.id)
    saveSessions(owner, list)
  }

  const copy = async (value: string, done: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setNotice({ kind: 'ok', text: done })
    } catch {
      setNotice({ kind: 'error', text: t('copyError') })
    }
  }
  const download = () => {
    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = t('fileName')
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const session = sessions.find((s) => s.id === sessionId) ?? null
  const restored = useMemo(() => (session && answer.trim() ? restore(answer, session.map) : null), [session, answer])
  const deleteSessions = () => {
    setSessions([])
    setSessionId(null)
    saveSessions(owner, [])
    setNotice({ kind: 'ok', text: t('sessionsDeleted') })
  }
  const dateLabel = (ms: number) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ms)

  // Testo con gli evidenziatori (toccando un dato lo si lascia visibile o lo si nasconde)
  const highlighted = useMemo(() => {
    const parts: React.ReactNode[] = []
    let last = 0
    findings.forEach((f: Finding, i) => {
      if (f.start > last) parts.push(text.slice(last, f.start))
      const on = !excluded.has(f.key) && !offTypes.has(f.type)
      parts.push(
        <button
          key={i}
          type="button"
          onClick={() => toggleKey(f.key)}
          title={on ? t('tapToKeep') : t('tapToHide')}
          className={`rounded px-0.5 font-semibold ${on ? TONE[f.type] : 'bg-transparent text-[var(--ink)] line-through decoration-2 opacity-60'}`}
        >
          {text.slice(f.start, f.end)}
        </button>
      )
      last = f.end
    })
    parts.push(text.slice(last))
    return parts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findings, excluded, offTypes, text])

  const card = 'rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm sm:p-6'
  const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-50'
  const btnDark = `${btn} bg-[var(--ink)] text-[var(--gold-bright)] hover:brightness-110`
  const btnLight = `${btn} border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)]`

  return (
    <div className="space-y-6">
      {notice && (
        <div role="status" className={`fixed inset-x-0 bottom-6 z-40 mx-auto w-fit max-w-[90%] rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${notice.kind === 'ok' ? 'bg-[var(--ink)]' : 'bg-red-700'}`}>
          {notice.text}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> {t('privacyNote')}
      </p>

      {/* 1. Il testo */}
      <section className={card}>
        <h2 className="mb-1 text-lg font-bold text-[var(--ink)]">{t('step1Title')}</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">{t('step1Text')}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className={btnLight} onClick={() => fileRef.current?.click()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} {t('loadFile')}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.csv,text/plain,application/pdf" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
          <button type="button" className={btnLight} onClick={() => setText(t('example'))}>
            <Sparkles className="h-4 w-4" /> {t('tryExample')}
          </button>
          {text && (
            <button type="button" className={btnLight} onClick={() => (setText(''), setExcluded(new Set()), setAnswer(''))}>
              <RotateCcw className="h-4 w-4" /> {t('clear')}
            </button>
          )}
        </div>
        <label htmlFor="ts-input" className="sr-only">
          {t('inputLabel')}
        </label>
        <textarea
          id="ts-input"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          placeholder={t('inputPlaceholder')}
          rows={9}
          className="w-full rounded-xl border border-[var(--gold)]/30 bg-[var(--background)] p-3 text-sm text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">{t('formats')}</p>
      </section>

      {text.trim() && (
        <>
          {/* 2. Cosa ho trovato */}
          <section className={card}>
            <h2 className="mb-1 text-lg font-bold text-[var(--ink)]">{t('step2Title')}</h2>
            <p className="mb-4 text-sm text-[var(--muted)]">{findings.length ? t('step2Text') : t('nothingFound')}</p>

            <div className="mb-4 flex flex-wrap gap-2">
              {PII_TYPES.filter((p) => countByType[p]?.size).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleType(p)}
                  aria-pressed={!offTypes.has(p)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${offTypes.has(p) ? 'bg-gray-100 text-gray-500 line-through' : TONE[p]}`}
                >
                  {offTypes.has(p) ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  {t(`types.${p}`)} · {countByType[p]!.size}
                </button>
              ))}
            </div>

            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--gold)]/20 bg-[var(--background)] p-3 text-sm leading-relaxed text-[var(--ink)]">{highlighted}</div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  addCustom(customDraft)
                }}
              >
                <label htmlFor="ts-custom" className="sr-only">
                  {t('addWord')}
                </label>
                <input
                  id="ts-custom"
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  placeholder={t('addWordPlaceholder')}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--gold)]/30 bg-white px-3 text-sm focus:border-[var(--gold)] focus:outline-none"
                />
                <button type="submit" className={btnLight} disabled={customDraft.trim().length < 2}>
                  <Plus className="h-4 w-4" /> {t('addWord')}
                </button>
              </form>
              <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
                <input type="checkbox" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
                {t('allDates')}
              </label>
            </div>
            {custom.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {custom.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">
                    <EyeOff className="h-3.5 w-3.5" /> {c}
                    <button type="button" aria-label={t('removeWord', { word: c })} onClick={() => setCustom((list) => list.filter((x) => x !== c))} className="ml-1 rounded-full p-0.5 hover:bg-gray-200">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {excluded.size > 0 && (
              <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--ink)] underline" onClick={() => setExcluded(new Set())}>
                <Undo2 className="h-4 w-4" /> {t('hideAllAgain')}
              </button>
            )}
          </section>

          {/* 3. Testo protetto */}
          <section className={card}>
            <h2 className="mb-1 text-lg font-bold text-[var(--ink)]">{t('step3Title')}</h2>
            <p className="mb-4 text-sm text-[var(--muted)]">{t('step3Text', { count: Object.keys(result.map).length })}</p>
            {(left.longNumbers.length > 0 || left.emails.length > 0) && (
              <p className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t('leftoverWarning', { items: [...left.longNumbers, ...left.emails].slice(0, 3).join(', ') })}
              </p>
            )}
            <textarea readOnly value={result.text} rows={9} aria-label={t('step3Title')} className="w-full rounded-xl border border-[var(--gold)]/30 bg-[var(--background)] p-3 text-sm text-[var(--ink)]" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={btnDark}
                onClick={() => {
                  remember()
                  void copy(result.text, t('copied'))
                }}
              >
                <ClipboardCopy className="h-4 w-4" /> {t('copy')}
              </button>
              <button
                type="button"
                className={btnLight}
                onClick={() => {
                  remember()
                  download()
                }}
              >
                <Download className="h-4 w-4" /> {t('download')}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">{t('reviewNote')}</p>
          </section>
        </>
      )}

      {/* 4. Rimetti i dati nella risposta dell'IA */}
      <section className={card}>
        <h2 className="mb-1 text-lg font-bold text-[var(--ink)]">{t('step4Title')}</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">{t('step4Text')}</p>
        {sessions.length === 0 ? (
          <p className="rounded-xl bg-[var(--background)] p-3 text-sm text-[var(--muted)]">{t('noSessions')}</p>
        ) : (
          <>
            <label htmlFor="ts-session" className="mb-1 block text-sm font-medium text-[var(--ink)]">
              {t('whichText')}
            </label>
            <select
              id="ts-session"
              value={sessionId ?? ''}
              onChange={(e) => setSessionId(e.target.value)}
              className="mb-3 min-h-11 w-full rounded-xl border border-[var(--gold)]/30 bg-white px-3 text-sm"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {dateLabel(s.createdAt)} · {s.title}
                </option>
              ))}
            </select>
            <label htmlFor="ts-answer" className="sr-only">
              {t('answerLabel')}
            </label>
            <textarea
              id="ts-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value.slice(0, MAX_CHARS))}
              placeholder={t('answerPlaceholder')}
              rows={6}
              className="w-full rounded-xl border border-[var(--gold)]/30 bg-[var(--background)] p-3 text-sm text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none"
            />
            {restored && (
              <div className="mt-3">
                <p className="mb-1 text-sm font-semibold text-[var(--ink)]">{t('restoredTitle', { count: restored.replaced })}</p>
                <textarea readOnly value={restored.text} rows={6} aria-label={t('restoredTitle', { count: restored.replaced })} className="w-full rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-[var(--ink)]" />
                <button type="button" className={`${btnDark} mt-2`} onClick={() => void copy(restored.text, t('copied'))}>
                  <ClipboardCopy className="h-4 w-4" /> {t('copy')}
                </button>
              </div>
            )}
            <button type="button" onClick={deleteSessions} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-red-700 underline">
              <Trash2 className="h-4 w-4" /> {t('deleteSessions')}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
