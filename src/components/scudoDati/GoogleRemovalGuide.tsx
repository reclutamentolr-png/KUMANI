'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Copy, ExternalLink, Info, Lightbulb, Mail, SearchX } from 'lucide-react'
import Link from '@/components/LocalizedLink'

// Guida «Togli i tuoi dati da Google»: la procedura ufficiale «Risultati che
// ti riguardano» di Google spiegata a passi, con i link diretti nella lingua
// dell'utente e un modello di email per chiedere al sito di cancellare i dati
// (diritto alla cancellazione, art. 17 GDPR). Testi nostri, nessuna immagine
// di Google.
const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const

export default function GoogleRemovalGuide() {
  const t = useTranslations('scudoDati')
  const locale = useLocale()
  const [copied, setCopied] = useState(false)

  const resultsAboutYou = `https://myactivity.google.com/results-about-you?hl=${locale}`
  const helpPage = `https://support.google.com/websearch/answer/12719076?hl=${locale}`
  const minorsForm = `https://support.google.com/websearch/contact/content_removal_form?hl=${locale}`

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(t('googleEmailTemplate'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Appunti non disponibili: il testo resta leggibile a schermo
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
        <SearchX className="h-5 w-5 text-[var(--gold)]" /> {t('googleTitle')}
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{t('googleIntro')}</p>

      <a
        href={resultsAboutYou}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--ink-soft)]"
      >
        {t('googleOpenButton')} <ExternalLink className="h-4 w-4" />
      </a>

      <ol className="mt-5 space-y-3">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--gold-pale)] text-sm font-bold text-[var(--ink)]">{i + 1}</span>
            <div className="min-w-0">
              <p className="font-semibold text-[var(--ink)]">{t(`google_${step}_title`)}</p>
              <p className="text-sm text-[var(--muted)]">{t(`google_${step}_text`)}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">{t('googleLimitsTitle')}</p>
          <p>{t('googleLimitsText')}</p>
          <p>
            {t('googleMinorsText')}{' '}
            <a href={minorsForm} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              {t('googleMinorsLink')}
            </a>
          </p>
        </div>
      </div>

      {/* Per toglierli davvero: chiedere al sito di cancellare i dati */}
      <div className="mt-5 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/40 p-4">
        <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
          <Mail className="h-5 w-5 text-[var(--gold)]" /> {t('googleSourceTitle')}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('googleSourceText')}</p>
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 font-sans text-xs leading-5 text-[var(--ink)]">
          {t('googleEmailTemplate')}
        </pre>
        <button
          type="button"
          onClick={copyTemplate}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? t('googleCopied') : t('googleCopy')}
        </button>
      </div>

      <div className="mt-5 flex gap-3 text-sm text-[var(--muted)]">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
        <p>
          {t('googleTips')}{' '}
          <Link href="/marketplace/checkmail" className="font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
            CheckMail
          </Link>
        </p>
      </div>

      <p className="mt-4 text-xs text-[var(--muted)]">
        {t('googleNote')}{' '}
        <a href={helpPage} target="_blank" rel="noopener noreferrer" className="underline">
          {t('googleHelpLink')}
        </a>
      </p>
    </section>
  )
}
