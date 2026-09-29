'use client'

import { useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown, ClipboardPaste, FileUp, LoaderCircle, Lock, MailSearch, RotateCcw, ShieldAlert, ShieldCheck, Smartphone, Sparkles, TriangleAlert } from 'lucide-react'
import type { CheckMailResponse } from '@/lib/checkmail/types'

type Mode = 'file' | 'paste' | 'quick'
type OkResult = Extract<CheckMailResponse, { status: 'ok' }>

const LEVEL_STYLE = {
  high: { box: 'border-red-200 bg-red-50', bar: 'bg-red-500', text: 'text-red-700', Icon: ShieldAlert },
  medium: { box: 'border-amber-200 bg-amber-50', bar: 'bg-amber-500', text: 'text-amber-700', Icon: TriangleAlert },
  low: { box: 'border-emerald-200 bg-emerald-50', bar: 'bg-emerald-500', text: 'text-emerald-700', Icon: ShieldCheck },
} as const

// KUMANI CheckMail: l'utente carica il file dell'email, incolla il sorgente o
// (dal telefono) scrive mittente e testo; il server risponde con punteggio di
// rischio, segnali trovati e, se disponibile, il parere dell'IA.
export default function CheckMailTool({ leftToday: initialLeft, dailyLimit }: { leftToday: number; dailyLimit: number }) {
  const t = useTranslations('checkmail')
  const locale = useLocale()
  const [mode, setMode] = useState<Mode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [raw, setRaw] = useState('')
  const [sender, setSender] = useState('')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OkResult | null>(null)
  const [leftToday, setLeftToday] = useState(initialLeft)
  const fileInput = useRef<HTMLInputElement>(null)

  const canSubmit = !busy && leftToday > 0 && (mode === 'file' ? !!file : mode === 'paste' ? raw.trim().length > 0 : text.trim().length > 0)

  const submit = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    const form = new FormData()
    form.set('locale', locale)
    if (mode === 'file' && file) form.set('file', file)
    if (mode === 'paste') form.set('raw', raw)
    if (mode === 'quick') {
      form.set('sender', sender)
      form.set('subject', subject)
      form.set('text', text)
    }
    try {
      const response = await fetch('/api/checkmail', { method: 'POST', body: form })
      const data = (await response.json()) as CheckMailResponse
      if (typeof data.leftToday === 'number') setLeftToday(data.leftToday)
      if (data.status === 'ok') {
        setResult(data)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setError(t(`error_${data.status}`))
      }
    } catch {
      setError(t('error_error'))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setResult(null)
    setError(null)
    setFile(null)
    setRaw('')
    setSender('')
    setSubject('')
    setText('')
    if (fileInput.current) fileInput.current.value = ''
  }

  const tabs: { id: Mode; label: string; Icon: typeof FileUp }[] = [
    { id: 'file', label: t('tabFile'), Icon: FileUp },
    { id: 'paste', label: t('tabPaste'), Icon: ClipboardPaste },
    { id: 'quick', label: t('tabQuick'), Icon: Smartphone },
  ]
  const field = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'

  return (
    <div className="space-y-6">
      {/* Risultato */}
      {result && <CheckMailResult result={result} onNew={reset} />}

      {!result && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-gray-100 p-1">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:flex-row sm:text-sm ${
                  mode === id ? 'bg-[var(--ink)] text-[var(--gold-bright)] shadow' : 'text-gray-600 hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {mode === 'file' && (
            <div>
              <p className="mb-3 text-sm text-gray-600">{t('fileHint')}</p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/40 px-4 py-8 text-center hover:bg-[var(--gold-pale)]">
                <FileUp className="h-8 w-8 text-[var(--gold)]" />
                <span className="text-sm font-semibold text-[var(--ink)]">{file ? file.name : t('fileChoose')}</span>
                <span className="text-xs text-gray-500">.eml · .msg</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".eml,.msg,message/rfc822,application/vnd.ms-outlook"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <HowTo title={t('howToFileTitle')} items={[t('howToGmail'), t('howToOutlook'), t('howToOutlookWeb'), t('howToThunderbird')]} />
            </div>
          )}

          {mode === 'paste' && (
            <div>
              <p className="mb-3 text-sm text-gray-600">{t('pasteHint')}</p>
              <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} placeholder={t('pastePlaceholder')} className={`${field} font-mono text-xs`} />
              <HowTo title={t('howToPasteTitle')} items={[t('howToPasteGmail'), t('howToPasteOutlook')]} />
            </div>
          )}

          {mode === 'quick' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">{t('quickHint')}</p>
              <input value={sender} onChange={(e) => setSender(e.target.value)} maxLength={300} placeholder={t('quickSender')} className={field} />
              <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={500} placeholder={t('quickSubject')} className={field} />
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={t('quickText')} className={field} />
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t('quickNote')}</p>
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-[var(--gold-bright)] transition-colors hover:bg-[var(--ink-soft)] disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MailSearch className="h-4 w-4" />}
            {busy ? t('analyzing') : t('analyze')}
          </button>
          <p className="mt-2 text-center text-xs text-[var(--muted)]">
            {leftToday > 0 ? t('leftToday', { count: leftToday, limit: dailyLimit }) : t('error_user_limit')}
          </p>

          <p className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-xs leading-5 text-gray-600">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gold)]" /> {t('privacyNote')}
          </p>
        </div>
      )}

      <p className="text-center text-xs leading-5 text-[var(--muted)]">{t('disclaimer')}</p>
    </div>
  )
}

function HowTo({ title, items }: { title: string; items: string[] }) {
  return (
    <details className="group mt-3 rounded-xl border border-gray-200 px-3 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-[var(--ink)]">
        {title}
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2 space-y-1.5 text-gray-600">
        {items.map((item) => (
          <li key={item} className="leading-5">
            • {item}
          </li>
        ))}
      </ul>
    </details>
  )
}

export function CheckMailResult({ result, onNew }: { result: OkResult; onNew: () => void }) {
  const t = useTranslations('checkmail')
  const style = LEVEL_STYLE[result.level]
  const signals = result.findings.filter((f) => f.points > 0)
  const notes = result.findings.filter((f) => f.points === 0)

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-5 sm:p-6 ${style.box}`}>
        <div className="flex items-start gap-4">
          <style.Icon className={`h-10 w-10 shrink-0 ${style.text}`} />
          <div className="min-w-0 flex-1">
            <p className={`text-xl font-bold ${style.text}`}>{t(`level_${result.level}`)}</p>
            <p className="mt-1 text-sm text-gray-700">{t(`levelText_${result.level}`)}</p>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs font-semibold text-gray-600">
                <span>{t('riskLabel')}</span>
                <span>{result.score}/100</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white">
                <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.max(3, result.score)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Segnali trovati dai controlli */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 font-bold text-[var(--ink)]">{t('signalsTitle')}</p>
        {signals.length === 0 ? (
          <p className="text-sm text-gray-600">{t('noSignals')}</p>
        ) : (
          <ul className="space-y-2">
            {signals.map((finding, index) => (
              <li key={`${finding.key}-${index}`} className="flex items-start gap-2 text-sm text-gray-800">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${finding.severity === 'high' ? 'bg-red-500' : finding.severity === 'medium' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                <span>{t(`f_${finding.key}`, finding.params ?? {})}</span>
              </li>
            ))}
          </ul>
        )}
        {notes.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3">
            {notes.map((finding, index) => (
              <li key={`${finding.key}-${index}`} className="text-xs text-gray-500">
                {t(`f_${finding.key}`, finding.params ?? {})}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Parere dell'IA */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-2 flex items-center gap-2 font-bold text-[var(--ink)]">
          <Sparkles className="h-4 w-4 text-[var(--gold)]" /> {t('aiTitle')}
        </p>
        {result.ai ? (
          <>
            <p className="text-sm font-semibold text-gray-800">
              {t(`cat_${result.ai.category}`)} · {t('aiRisk', { risk: result.ai.risk })}
            </p>
            {result.ai.reasons.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {result.ai.reasons.map((reason, index) => (
                  <li key={index} className="text-sm text-gray-700">
                    • {reason}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-600">{t('aiUnavailable')}</p>
        )}
      </div>

      {/* Cosa fare */}
      <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/50 p-5">
        <p className="mb-2 font-bold text-[var(--ink)]">{t('adviceTitle')}</p>
        <p className="text-sm leading-6 text-gray-800">{t(`advice_${result.level}`)}</p>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-gray-50"
      >
        <RotateCcw className="h-4 w-4" /> {t('newCheck')}
      </button>
    </div>
  )
}
