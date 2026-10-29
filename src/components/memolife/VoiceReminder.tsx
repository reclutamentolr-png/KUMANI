'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Mic, Square } from 'lucide-react'
import { parseVoiceReminder, type VoiceDraft } from '@/lib/voiceReminder'

// Agenda → «A voce»: si dice l'appuntamento o il promemoria, compare scritto
// (si può correggere) e sotto cosa ha capito KUMANI. «Continua» apre il
// modulo già compilato: si salva solo da lì, mai da soli. La voce la
// trascrive il telefono (riconoscimento vocale del browser); dove non c'è si
// detta con il microfono della tastiera.

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }

export default function VoiceReminder({ onContinue }: { onContinue: (draft: VoiceDraft) => void }) {
  const t = useTranslations('agenda')
  const locale = useLocale()
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [canSpeak, setCanSpeak] = useState(false)
  // Con la data che non torna con il giorno detto: quale tenere
  const [pick, setPick] = useState<'asSaid' | 'nearest' | null>(null)
  const recognition = useRef<Recognition | null>(null)

  useEffect(() => {
    const w = window as SpeechWindow
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dipende dal browser, si sa solo qui
    setCanSpeak(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => recognition.current?.stop()
  }, [])

  const draft = useMemo(() => (text.trim() ? parseVoiceReminder(text) : null), [text])

  const listen = () => {
    if (listening) {
      recognition.current?.stop()
      return
    }
    const w = window as SpeechWindow
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return
    const r = new Ctor()
    r.lang = 'it-IT'
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      let said = ''
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0]?.transcript ?? ''
      setText(said.trim())
      setPick(null)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recognition.current = r
    setText('')
    setListening(true)
    r.start()
  }

  const dateLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // La bozza da aprire, con la data scelta se c'era da scegliere
  const final = draft && draft.weekdayMismatch && pick ? { ...draft, date: pick === 'nearest' ? draft.weekdayMismatch.nearest : draft.weekdayMismatch.dateAsSaid } : draft
  const mustPick = !!draft?.weekdayMismatch && !pick

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">{t('voiceIntro')}</p>

      {canSpeak ? (
        <button
          type="button"
          onClick={listen}
          aria-pressed={listening}
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition ${listening ? 'animate-pulse bg-red-600 text-white' : 'bg-[var(--ink)] text-[var(--gold-bright)] hover:opacity-90'}`}
          aria-label={listening ? t('voiceStop') : t('voiceStart')}
        >
          {listening ? <Square className="h-8 w-8" /> : <Mic className="h-9 w-9" />}
        </button>
      ) : (
        <p className="rounded-xl bg-[var(--gold-pale)] p-3 text-sm text-[var(--ink)]">{t('voiceKeyboard')}</p>
      )}
      {canSpeak && <p className="text-center text-sm font-semibold text-[var(--ink)]">{listening ? t('voiceListening') : t('voiceTap')}</p>}

      <div>
        <label htmlFor="voice-text" className="mb-1 block text-sm font-semibold text-gray-700">
          {t('voiceSaid')}
        </label>
        <textarea
          id="voice-text"
          rows={2}
          value={text}
          maxLength={300}
          placeholder={t('voicePlaceholder')}
          onChange={(e) => {
            setText(e.target.value)
            setPick(null)
          }}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[16px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
        />
      </div>

      {draft && (
        <div className="space-y-3 rounded-2xl border border-[var(--gold)]/30 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{t('voiceUnderstood')}</p>
          <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
            {draft.kind === 'appointment' ? <CalendarClock className="h-5 w-5 text-sky-600" /> : <CheckCircle2 className="h-5 w-5 text-violet-600" />}
            {t(draft.kind === 'appointment' ? 'add_appointment' : 'add_task')}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-[var(--muted)]">{t('fieldTitle')}</dt>
            <dd className="font-semibold text-[var(--ink)]">{draft.title || <span className="font-normal text-[var(--muted)]">{t('voiceNoTitle')}</span>}</dd>
            <dt className="text-[var(--muted)]">{t('fieldDate')}</dt>
            <dd className="font-semibold text-[var(--ink)]">{final?.date ? dateLabel(final.date) : <span className="font-normal text-[var(--muted)]">{t('voiceNoDate')}</span>}</dd>
            {draft.time && (
              <>
                <dt className="text-[var(--muted)]">{t('fieldTime')}</dt>
                <dd className="font-semibold text-[var(--ink)]">{draft.time}</dd>
              </>
            )}
          </dl>
          {draft.weekdayMismatch && (
            <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {t('voiceMismatch', { date: dateLabel(draft.weekdayMismatch.dateAsSaid) })}
              </p>
              <div className="flex flex-wrap gap-2">
                {(['asSaid', 'nearest'] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPick(p)} aria-pressed={pick === p} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${pick === p ? 'border-amber-700 bg-amber-700 text-white' : 'border-amber-300 bg-white text-amber-900'}`}>
                    {dateLabel(p === 'asSaid' ? draft.weekdayMismatch!.dateAsSaid : draft.weekdayMismatch!.nearest)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {draft.movedToNextYear && !draft.weekdayMismatch && <p className="text-xs text-[var(--muted)]">{t('voiceNextYear')}</p>}
        </div>
      )}

      <button
        type="button"
        disabled={!final || mustPick}
        onClick={() => final && onContinue(final)}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 font-extrabold text-[var(--ink)] disabled:opacity-50"
      >
        {t('voiceContinue')} <ArrowRight className="h-5 w-5" />
      </button>
      <p className="text-xs text-[var(--muted)]">{t('voiceNote')}</p>
    </div>
  )
}
