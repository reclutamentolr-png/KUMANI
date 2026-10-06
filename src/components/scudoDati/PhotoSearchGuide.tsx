'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ExternalLink, FileLock2, Image as ImageIcon, Lightbulb, ScanSearch, ShieldAlert } from 'lucide-react'
import Link from '@/components/LocalizedLink'

// Guida «Scopri dove sono usate le tue foto»: ricerca inversa delle PROPRIE
// foto con strumenti gratuiti (Google Lens, TinEye). È l'utente a cercare;
// KUMANI non tratta volti né dati biometrici. Cosa fare con i profili falsi
// e collegamenti a VeriFoto e Documento Sicuro.
const STEPS = ['step1', 'step2', 'step3'] as const

export default function PhotoSearchGuide() {
  const t = useTranslations('scudoDati')
  const locale = useLocale()
  const lens = `https://lens.google.com/?hl=${locale}`
  const tineye = 'https://tineye.com/'

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
        <ImageIcon className="h-5 w-5 text-[var(--gold)]" /> {t('photosTitle')}
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{t('photosIntro')}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={lens} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--ink-soft)]">
          Google Lens <ExternalLink className="h-4 w-4" />
        </a>
        <a href={tineye} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[var(--ink)]/20 bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)] hover:bg-gray-50">
          TinEye <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <ol className="mt-5 space-y-3">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--gold-pale)] text-sm font-bold text-[var(--ink)]">{i + 1}</span>
            <div className="min-w-0">
              <p className="font-semibold text-[var(--ink)]">{t(`photos_${step}_title`)}</p>
              <p className="text-sm text-[var(--muted)]">{t(`photos_${step}_text`)}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Foto usata da un profilo falso: cosa fare */}
      <div className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">{t('photosFakeTitle')}</p>
          <p>{t('photosFakeText')}</p>
        </div>
      </div>

      {/* Consigli in evidenza, con i due servizi KUMANI collegati */}
      <div className="mt-5 rounded-2xl bg-gradient-to-br from-[var(--ink)] to-[#2a2721] p-5 text-white shadow-md">
        <div className="flex gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/20 ring-1 ring-[var(--gold-bright)]/60">
            <Lightbulb className="h-6 w-6 text-[var(--gold-bright)]" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-semibold leading-6 sm:text-base">
            {t('photosTipsBefore')} <span className="text-[var(--gold-bright)]">Documento Sicuro</span>
            {t('photosTipsMiddle')} <span className="text-[var(--gold-bright)]">VeriFoto</span>
            {t('photosTipsAfter')}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 sm:pl-16">
          <Link
            href="/marketplace/documento-sicuro"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-extrabold text-[var(--ink)] shadow hover:brightness-105"
          >
            <FileLock2 className="h-4 w-4" /> Documento Sicuro
          </Link>
          <Link
            href="/marketplace/verifoto"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-extrabold text-[var(--ink)] shadow hover:brightness-105"
          >
            <ScanSearch className="h-4 w-4" /> VeriFoto
          </Link>
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">{t('photosNote')}</p>
    </section>
  )
}
