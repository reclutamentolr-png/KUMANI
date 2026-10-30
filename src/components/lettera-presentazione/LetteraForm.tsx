'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle, Eye, FileUser, LoaderCircle, Pencil, Plus, XCircle } from 'lucide-react'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { createCoverLetter, updateCoverLetter } from '@/app/actions/letteraPresentazione'
import { limitTextOf } from '@/lib/limitText'
import { askConfirm } from '@/lib/confirm'
import CvTemplatePicker from '@/components/cv/CvTemplatePicker'
import LetteraPreview from './LetteraPreview'
import LetteraPdfButtons from './LetteraPdfButtons'
import {
  LETTER_LANGS,
  LETTER_LANG_NAMES,
  LETTER_LIMITS,
  autoSubject,
  fillPhrase,
  letterLabels,
  type CoverLetterForm,
  type LetterLang,
  type LetterSender,
} from '@/lib/letteraPresentazione'
import { LETTER_PHRASES, PHRASE_GROUPS, type PhraseGroup } from '@/lib/letteraPresentazioneFrasi'

type Props = {
  mode: 'create' | 'edit'
  id?: string
  initial: CoverLetterForm
  cvSender: LetterSender | null // dati del CV, per «Riprendi dal mio CV»
}

const inputClass =
  'w-full px-3 py-2.5 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-base sm:text-sm bg-white'
const labelClass = 'block text-sm font-medium text-[var(--ink)] mb-1'
const chipClass =
  'rounded-full border border-[var(--gold)]/40 bg-white px-3 py-1.5 text-left text-xs text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)]'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--gold)]/15 pt-6 first:border-t-0 first:pt-0">
      <h3 className="font-bold text-[var(--ink)]">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

export default function LetteraForm({ mode, id, initial, cvSender }: Props) {
  const t = useTranslations('letteraPresentazione')
  const router = useRouter()
  const [form, setForm] = useState<CoverLetterForm>(initial)
  const [saved, setSaved] = useState<CoverLetterForm>(initial)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [group, setGroup] = useState<PhraseGroup>('opening')
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const caret = useRef<number | null>(null)
  const leaving = useRef(false)
  // Lettera nuova già creata: il pulsante resta fermo mentre si apre la
  // pagina della lettera (un secondo tocco ne creerebbe un'altra uguale)
  const [created, setCreated] = useState(false)

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const phrases = LETTER_PHRASES[form.language]
  const set = <K extends keyof CoverLetterForm>(key: K, value: CoverLetterForm[K]) => setForm((p) => ({ ...p, [key]: value }))

  // Uscendo con modifiche non salvate il browser chiede conferma
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      if (!leaving.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Anche i collegamenti dentro il sito («Le mie lettere», barra in alto…):
  // il browser non chiede niente, quindi si chiede qui prima di uscire
  useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return
      e.preventDefault()
      e.stopPropagation()
      void askConfirm(t.has('leaveConfirm') ? t('leaveConfirm') : t('unsaved'), { tone: 'warning' }).then((ok) => {
        if (!ok) return
        leaving.current = true
        window.location.assign(url.href)
      })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [dirty, t])

  // Ruolo cercato: l'oggetto lo segue finché non lo si cambia a mano
  const setPosition = (position: string) =>
    setForm((p) => ({ ...p, position, subject: !p.subject.trim() || p.subject === autoSubject(p.language, p.position) ? autoSubject(p.language, position) : p.subject }))

  // Lingua della lettera: saluto, chiusura e oggetto proposti passano nella nuova lingua
  const setLanguage = (language: LetterLang) =>
    setForm((p) => {
      const old = LETTER_PHRASES[p.language]
      const next = LETTER_PHRASES[language]
      const gi = old.greetings.findIndex((g) => fillPhrase(g, p) === p.greeting || g === p.greeting)
      const ci = old.closings.indexOf(p.closing)
      const moved = { ...p, language }
      return {
        ...moved,
        greeting: gi >= 0 ? fillPhrase(next.greetings[gi], moved) : p.greeting,
        closing: ci >= 0 ? next.closings[ci] : p.closing,
        subject: p.subject === autoSubject(p.language, p.position) ? autoSubject(language, p.position) : p.subject,
      }
    })

  const fromCv = () => {
    if (!cvSender) return
    setForm((p) => ({
      ...p,
      senderName: cvSender.name,
      senderRole: cvSender.role,
      senderEmail: cvSender.email,
      senderPhone: cvSender.phone,
      senderCity: cvSender.city,
      signature: p.signature.trim() && p.signature !== p.senderName ? p.signature : cvSender.name,
    }))
  }

  // Frase pronta: va nel punto in cui si stava scrivendo (o in fondo), come paragrafo a sé
  const insertPhrase = (raw: string) => {
    const text = fillPhrase(raw, form)
    setForm((p) => {
      const pos = caret.current === null ? p.body.length : Math.min(caret.current, p.body.length)
      const before = p.body.slice(0, pos)
      const after = p.body.slice(pos)
      const lead = before && !before.endsWith('\n') ? '\n' : ''
      const tail = after && !after.startsWith('\n') ? '\n' : ''
      const body = (before + lead + text + tail + after).slice(0, LETTER_LIMITS.body)
      caret.current = (before + lead + text).length
      return { ...p, body }
    })
    setJustAdded(raw)
    setTimeout(() => setJustAdded((x) => (x === raw ? null : x)), 1500)
  }

  const isValid = form.title.trim().length > 0

  const handleSave = async () => {
    if (!isValid || saving || created) return
    setSaving(true)
    setError(null)
    try {
      if (mode === 'create') {
        const result = await createCoverLetter(form)
        if (!result.success) {
          setError(limitTextOf(result) ?? (t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError')))
          return
        }
        setCreated(true)
        setSaved(form)
        router.replace(`/app/lettera-presentazione/${result.data.id}`)
      } else {
        const result = await updateCoverLetter(id!, form)
        if (!result.success) {
          setError(t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError'))
          return
        }
        setSaved(form)
        setSavedNote(true)
        // Titolo nuovo anche nell'intestazione della pagina
        router.refresh()
        setTimeout(() => setSavedNote(false), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  const counter = (value: string, max: number) => (value.length > max * 0.8 ? <span className="text-xs text-[var(--muted)]">{t('charCount', { n: value.length, max })}</span> : null)

  const editor = (
    <div className="space-y-6 rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:p-8">
      <Section title={t('sectionLetter')}>
        <div>
          <label className={labelClass} htmlFor="lp-title">{t('titleField')}</label>
          <input id="lp-title" value={form.title} maxLength={LETTER_LIMITS.title} onChange={(e) => set('title', e.target.value)} placeholder={t('titlePlaceholder')} className={inputClass} />
          <p className="mt-1 text-xs text-[var(--muted)]">{t('titleHint')}</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="lp-lang">{t('languageField')}</label>
          <select id="lp-lang" value={form.language} onChange={(e) => setLanguage(e.target.value as LetterLang)} className={inputClass}>
            {LETTER_LANGS.map((l) => (
              <option key={l} value={l}>{LETTER_LANG_NAMES[l]}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">{t('languageHint')}</p>
        </div>
        <div>
          <p className={labelClass}>{t('templateField')}</p>
          <CvTemplatePicker value={form.template} onChange={(v) => set('template', v)} />
          <p className="mt-2 text-xs text-[var(--muted)]">{t('templateHint')}</p>
        </div>
      </Section>

      <Section title={t('sectionJob')} hint={t('sectionJobHint')}>
        <div>
          <label className={labelClass} htmlFor="lp-position">{t('positionField')}</label>
          <input id="lp-position" value={form.position} maxLength={LETTER_LIMITS.position} onChange={(e) => setPosition(e.target.value)} placeholder={t('positionPlaceholder')} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="lp-company">{t('companyField')}</label>
            <input id="lp-company" value={form.recipientCompany} maxLength={LETTER_LIMITS.recipientCompany} onChange={(e) => set('recipientCompany', e.target.value)} placeholder={t('companyPlaceholder')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lp-recipient">{t('recipientField')}</label>
            <input id="lp-recipient" value={form.recipientName} maxLength={LETTER_LIMITS.recipientName} onChange={(e) => set('recipientName', e.target.value)} placeholder={t('recipientPlaceholder')} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="lp-address">{t('addressField')}</label>
          <textarea id="lp-address" rows={2} value={form.recipientAddress} maxLength={LETTER_LIMITS.recipientAddress} onChange={(e) => set('recipientAddress', e.target.value)} placeholder={t('addressPlaceholder')} className={inputClass} />
        </div>
      </Section>

      <Section title={t('sectionSender')} hint={cvSender ? t('sectionSenderHintCv') : t('sectionSenderHint')}>
        {cvSender && (
          <button type="button" onClick={fromCv} className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-[var(--gold-pale)]/50 px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
            <FileUser className="h-4 w-4 text-[var(--gold)]" /> {t('fromCv')}
          </button>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="lp-name">{t('senderNameField')}</label>
            <input id="lp-name" value={form.senderName} maxLength={LETTER_LIMITS.senderName} onChange={(e) => setForm((p) => ({ ...p, senderName: e.target.value, signature: p.signature === p.senderName ? e.target.value : p.signature }))} autoComplete="name" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lp-role">{t('senderRoleField')}</label>
            <input id="lp-role" value={form.senderRole} maxLength={LETTER_LIMITS.senderRole} onChange={(e) => set('senderRole', e.target.value)} placeholder={t('senderRolePlaceholder')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lp-email">{t('senderEmailField')}</label>
            <input id="lp-email" type="email" value={form.senderEmail} maxLength={LETTER_LIMITS.senderEmail} onChange={(e) => set('senderEmail', e.target.value)} autoComplete="email" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lp-phone">{t('senderPhoneField')}</label>
            <input id="lp-phone" type="tel" value={form.senderPhone} maxLength={LETTER_LIMITS.senderPhone} onChange={(e) => set('senderPhone', e.target.value)} autoComplete="tel" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="lp-city">{t('senderCityField')}</label>
            <input id="lp-city" value={form.senderCity} maxLength={LETTER_LIMITS.senderCity} onChange={(e) => set('senderCity', e.target.value)} className={inputClass} />
          </div>
        </div>
      </Section>

      <Section title={t('sectionTop')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="lp-place">{t('placeField')}</label>
            <input id="lp-place" value={form.place} maxLength={LETTER_LIMITS.place} onChange={(e) => set('place', e.target.value)} placeholder={t('placePlaceholder')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lp-date">{t('dateField')}</label>
            <input id="lp-date" type="date" value={form.letterDate} min="2000-01-01" max="2100-12-31" onChange={(e) => set('letterDate', e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="lp-subject">{t('subjectField')}</label>
          <input id="lp-subject" value={form.subject} maxLength={LETTER_LIMITS.subject} onChange={(e) => set('subject', e.target.value)} placeholder={autoSubject(form.language, letterLabels(form.language).tokens.position)} className={inputClass} />
          <p className="mt-1 text-xs text-[var(--muted)]">{t('subjectHint')}</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="lp-greeting">{t('greetingField')}</label>
          <input id="lp-greeting" value={form.greeting} maxLength={LETTER_LIMITS.greeting} onChange={(e) => set('greeting', e.target.value)} className={inputClass} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {phrases.greetings.map((g) => (
              <button key={g} type="button" onClick={() => set('greeting', fillPhrase(g, form))} className={chipClass}>
                {fillPhrase(g, form)}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t('sectionBody')} hint={t('sectionBodyHint')}>
        <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--paper)] p-3 sm:p-4">
          <p className="text-sm font-bold text-[var(--ink)]">{t('phrasesTitle')}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{t('phrasesHint')}</p>
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
            {PHRASE_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={group === g}
                onClick={() => setGroup(g)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${group === g ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-[var(--gold)]/30 bg-white text-[var(--ink)]'}`}
              >
                {t(`group_${g}`)}
              </button>
            ))}
          </div>
          <ul className="mt-3 space-y-2" lang={form.language}>
            {phrases.groups[group].map((ph) => (
              <li key={ph}>
                <button
                  type="button"
                  onClick={() => insertPhrase(ph)}
                  className="flex w-full items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-800 transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold-pale)]/40"
                >
                  {justAdded === ph ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <Plus className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />}
                  <span>{fillPhrase(ph, form)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <label className={labelClass} htmlFor="lp-body">{t('bodyField')}</label>
          <textarea
            id="lp-body"
            rows={12}
            lang={form.language}
            value={form.body}
            maxLength={LETTER_LIMITS.body}
            onChange={(e) => {
              caret.current = e.target.selectionStart
              set('body', e.target.value)
            }}
            onSelect={(e) => {
              caret.current = e.currentTarget.selectionStart
            }}
            placeholder={t('bodyPlaceholder')}
            className={`${inputClass} leading-relaxed`}
          />
          <div className="mt-1 flex items-start justify-between gap-3">
            <p className="text-xs text-[var(--muted)]">{t('bodyHint')}</p>
            {counter(form.body, LETTER_LIMITS.body)}
          </div>
        </div>
      </Section>

      <Section title={t('sectionEnd')}>
        <div>
          <label className={labelClass} htmlFor="lp-closing">{t('closingField')}</label>
          <input id="lp-closing" value={form.closing} maxLength={LETTER_LIMITS.closing} onChange={(e) => set('closing', e.target.value)} className={inputClass} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {phrases.closings.map((c) => (
              <button key={c} type="button" onClick={() => set('closing', c)} className={chipClass}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="lp-signature">{t('signatureField')}</label>
          <input id="lp-signature" value={form.signature} maxLength={LETTER_LIMITS.signature} onChange={(e) => set('signature', e.target.value)} className={inputClass} />
          <p className="mt-1 text-xs text-[var(--muted)]">{t('signatureHint')}</p>
        </div>
        <label className="flex items-start gap-2 text-sm text-[var(--ink)]">
          <input type="checkbox" checked={form.attachCv} onChange={(e) => set('attachCv', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
          <span>{t('attachCvField')}</span>
        </label>
      </Section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <XCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3 border-t border-[var(--gold)]/15 pt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || saving || created || (mode === 'edit' && !dirty)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105 disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
          {saving ? t('saving') : mode === 'create' ? t('create') : savedNote && !dirty ? t('saved') : t('save')}
        </button>
        {!isValid && <p className="text-center text-xs text-[var(--muted)]">{t('titleRequiredHint')}</p>}
        {mode === 'edit' && dirty && <p className="text-center text-xs text-amber-700">{t('unsaved')}</p>}
        <LetteraPdfButtons form={form} />
      </div>
    </div>
  )

  const preview = (
    <div className="space-y-3 lg:sticky lg:top-24">
      <div className="overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-2 shadow-sm sm:p-3">
        <div className="max-h-[calc(100vh-11rem)] overflow-y-auto rounded-lg max-lg:max-h-none">
          <LetteraPreview form={form} />
        </div>
      </div>
      <div className="hidden lg:block">
        <LetteraPdfButtons form={form} />
      </div>
      <p className="text-center text-xs text-[var(--muted)]">{t('previewHint')}</p>
    </div>
  )

  return (
    <div>
      {/* Telefono: Modifica / Anteprima */}
      <div className="mb-4 flex overflow-hidden rounded-xl border border-[var(--gold)]/30 lg:hidden">
        <button type="button" onClick={() => setMobileView('edit')} className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium ${mobileView === 'edit' ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-white text-[var(--muted)]'}`}>
          <Pencil className="h-4 w-4" /> {t('tabEdit')}
        </button>
        <button type="button" onClick={() => setMobileView('preview')} className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium ${mobileView === 'preview' ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-white text-[var(--muted)]'}`}>
          <Eye className="h-4 w-4" /> {t('tabPreview')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={mobileView === 'edit' ? 'block' : 'hidden lg:block'}>{editor}</div>
        <div className={mobileView === 'preview' ? 'block' : 'hidden lg:block'}>
          {preview}
          <div className="mt-3 lg:hidden">
            <LetteraPdfButtons form={form} />
          </div>
        </div>
      </div>
    </div>
  )
}
