'use client'

import { useState, type FormEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle2, LoaderCircle, Send, TriangleAlert } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { sendContactMessage, type ContactError, type ContactTopic } from '@/app/actions/contact'

const TOPICS: ContactTopic[] = ['support', 'billing', 'pro', 'partnership', 'privacy', 'other']
const MIN_MESSAGE = 10
const MAX_MESSAGE = 3000

type Props = {
  defaultName?: string
  defaultEmail?: string
  defaultTopic?: ContactTopic
}

// Modulo della pagina Contatti. Il campo "website" è un honeypot: nascosto alle
// persone, lo compilano solo i bot (il server finge l'invio e non salva nulla).
export default function ContactForm({ defaultName = '', defaultEmail = '', defaultTopic = 'support' }: Props) {
  const t = useTranslations('contactPage')
  const locale = useLocale()
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [topic, setTopic] = useState<ContactTopic>(defaultTopic)
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<ContactError | 'network' | null>(null)
  const [sent, setSent] = useState(false)

  const prefilled = !!(defaultName || defaultEmail)
  const length = message.trim().length
  const tooShort = length > 0 && length < MIN_MESSAGE

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    // Controlli rapidi lato browser (il server rifà tutto comunque)
    if (name.trim().length < 2) return setError('invalidName')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError('invalidEmail')
    if (length < MIN_MESSAGE || length > MAX_MESSAGE) return setError('invalidMessage')
    if (!consent) return setError('consentRequired')

    setSending(true)
    try {
      const result = await sendContactMessage({ name, email, topic, message, consent, website, locale })
      if ('error' in result) setError(result.error)
      else setSent(true)
    } catch {
      setError('network')
    } finally {
      setSending(false)
    }
  }

  const reset = () => {
    setMessage('')
    setConsent(false)
    setError(null)
    setSent(false)
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] p-8 text-center shadow-sm sm:p-10" role="status">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)]">
          <CheckCircle2 className="h-8 w-8 text-[var(--ink)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--ink)]">{t('successTitle')}</h3>
        <p className="mx-auto mt-2 max-w-md text-[var(--muted)]">{t('successText', { email: email.trim() })}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl border border-[var(--ink)]/15 px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--gold)]"
        >
          {t('successAgain')}
        </button>
      </div>
    )
  }

  const inputClass =
    'w-full rounded-xl border border-[var(--ink)]/15 bg-white px-4 py-3 text-[var(--ink)] placeholder:text-[var(--muted)]/70 outline-none transition focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/25'
  const labelClass = 'mb-1.5 block text-sm font-semibold text-[var(--ink)]'

  return (
    <form onSubmit={onSubmit} noValidate className="relative rounded-2xl border border-[var(--ink)]/10 bg-[var(--paper)] p-6 shadow-sm sm:p-8">
      {prefilled && <p className="mb-5 rounded-lg bg-[var(--gold-pale)]/60 px-4 py-2.5 text-sm text-[var(--ink-soft)]">{t('formPrefilled')}</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={labelClass}>{t('formName')}</label>
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('formNamePlaceholder')}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="contact-email" className={labelClass}>{t('formEmail')}</label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('formEmailPlaceholder')}
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="contact-topic" className={labelClass}>{t('formTopic')}</label>
        <select id="contact-topic" value={topic} onChange={(e) => setTopic(e.target.value as ContactTopic)} className={inputClass}>
          {TOPICS.map((id) => (
            <option key={id} value={id}>{t(`topic_${id}`)}</option>
          ))}
        </select>
      </div>

      <div className="mt-5">
        <label htmlFor="contact-message" className={labelClass}>{t('formMessage')}</label>
        <textarea
          id="contact-message"
          rows={7}
          maxLength={MAX_MESSAGE}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('formMessagePlaceholder')}
          className={`${inputClass} resize-y`}
          required
        />
        <div className="mt-1.5 flex justify-between text-xs">
          <span className={tooShort ? 'text-amber-700' : 'text-[var(--muted)]'}>{t('formMessageMin', { min: MIN_MESSAGE })}</span>
          <span className={length > MAX_MESSAGE * 0.9 ? 'font-semibold text-amber-700' : 'text-[var(--muted)]'}>
            {t('formCounter', { count: message.length, max: MAX_MESSAGE })}
          </span>
        </div>
      </div>

      {/* Honeypot: fuori dallo schermo, ignorato da lettori di schermo e tastiera */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="contact-website">{t('formHoneypot')}</label>
        <input id="contact-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-[var(--ink-soft)]">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--gold)]"
          required
        />
        <span>
          {t.rich('formConsent', {
            link: (chunks) => (
              <Link href="/privacy" target="_blank" className="font-semibold text-[var(--gold)] underline-offset-2 hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{t(`error_${error}`)}</span>
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--muted)]">{t('formNote')}</p>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-6 py-3 font-bold text-[var(--gold-bright)] shadow-lg transition hover:bg-[var(--ink-soft)] disabled:opacity-60"
        >
          {sending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {sending ? t('formSending') : t('formSubmit')}
        </button>
      </div>
    </form>
  )
}
