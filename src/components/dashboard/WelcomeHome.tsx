'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, Gamepad2, Gift, Leaf, LoaderCircle, Megaphone, PartyPopper, PiggyBank, Play, ShieldCheck, Smartphone, Store, Users, X, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import NativeShareButton from '@/components/NativeShareButton'
import HomeVideo from '@/components/home/HomeVideo'
import { closeWelcome, markWelcomeDiscovered, pickWelcomeNeed, showFullHome } from '@/app/actions/welcome'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { FROM_ICONS_KEY } from '@/lib/homeView'
import type { WelcomeSteps } from '@/lib/welcomeHome'

// Home di benvenuto (nuovi iscritti Gratis): «Ciao …, per cosa sei qui?» con
// le risposte di «In cosa possiamo darti una mano?» (la scelta mette i
// servizi giusti in «I tuoi servizi») e «I tuoi primi 3 passi». In fondo
// «Mostra la Home completa». Al posto del tour di 6 passi.
// Passo 2: un servizio gratuito da provare (prima quelli scelti al passo 1).
// Passo 3: il video di KUMANI e «Condividi KUMANI» con il proprio invito:
// KUMANI è aiuto a più mani. Si spunta guardando il video o condividendo.
const NEED_ICON: Record<string, LucideIcon> = { ShieldCheck, CalendarDays, PiggyBank, Store, Megaphone, BriefcaseBusiness, Users, Gamepad2, Leaf, Gift }

export type WelcomeNeed = { key: string; icon: string; short: string }
export type WelcomeService = { toolName: string; label: string; href: string; iconName: string }

export default function WelcomeHome({
  firstName,
  needs,
  picked: initialPicked,
  steps,
  shareUrl,
  tryServices,
  videoId,
}: {
  firstName: string | null
  needs: WelcomeNeed[]
  picked: string[]
  steps: WelcomeSteps
  shareUrl: string
  tryServices: WelcomeService[]
  videoId: string | null
}) {
  const t = useTranslations('welcomeHome')
  const router = useRouter()
  const [picked, setPicked] = useState(initialPicked)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [showVideo, setShowVideo] = useState(false)
  const [discovered, setDiscovered] = useState(false)
  // Video guardato o KUMANI condiviso: il passo 3 è fatto
  const discover = () => {
    if (discovered || steps.third) return
    setDiscovered(true)
    markWelcomeDiscovered().catch(() => {})
  }

  const choose = async (key: string) => {
    setBusyKey(key)
    const result = await pickWelcomeNeed(key)
    setBusyKey(null)
    if (result.success) {
      setPicked(result.needs)
      router.refresh()
    }
  }

  const done = { picked: steps.picked || picked.length > 0, tried: steps.tried, third: steps.third || discovered }
  const count = Number(done.picked) + Number(done.tried) + Number(done.third)
  // Tutti e tre fatti: «Complimenti» (non mentre guarda il video)
  const [closing, startClosing] = useTransition()
  if (count === 3 && !showVideo)
    return (
      <section className="rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.18)]" aria-labelledby="welcome-done">
        <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--gold-bright)]">
          <PartyPopper className="h-4 w-4" /> {t('stepsProgress', { done: 3 })}
        </p>
        <h2 id="welcome-done" className="mt-2 text-2xl font-extrabold leading-tight">
          {firstName ? t('doneTitleName', { name: firstName }) : t('doneTitle')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/80">{t('doneText')}</p>
        <button
          type="button"
          disabled={closing}
          onClick={() =>
            startClosing(async () => {
              if (await closeWelcome()) router.refresh()
            })
          }
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 text-sm font-extrabold text-[var(--ink)] disabled:opacity-60"
        >
          {closing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} {t('doneCta')}
        </button>
      </section>
    )

  const stepRow = (n: number, isDone: boolean, title: string, text: string, actions?: React.ReactNode) => (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${isDone ? 'bg-emerald-600 text-white' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}
        aria-hidden
      >
        {isDone ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${isDone ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>
          {title}
          {isDone && <span className="sr-only"> ({t('stepDone')})</span>}
        </p>
        {!isDone && <p className="mt-0.5 text-[13px] leading-snug text-[var(--muted)]">{text}</p>}
        {!isDone && actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </li>
  )

  return (
    <div className="space-y-5">
      {/* Per cosa sei qui? */}
      <section className="rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.18)] sm:p-6" aria-labelledby="welcome-title">
        <h2 id="welcome-title" className="text-xl font-extrabold leading-tight sm:text-2xl">
          {firstName ? t('helloName', { name: firstName }) : t('hello')} <span className="text-[var(--gold-bright)]">{t('question')}</span>
        </h2>
        <p className="mt-1.5 text-sm text-white/70">{t('questionHint')}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {needs.map((need) => {
            const Icon = NEED_ICON[need.icon] ?? ShieldCheck
            const on = picked.includes(need.key)
            return (
              <button
                key={need.key}
                type="button"
                aria-pressed={on}
                disabled={busyKey !== null}
                onClick={() => choose(need.key)}
                className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-bold transition-colors disabled:cursor-wait ${
                  on ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--ink)]' : 'border-white/15 bg-white/[0.06] text-white hover:border-[var(--gold)]/70'
                }`}
              >
                {busyKey === need.key ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /> : on ? <Check className="h-4 w-4 shrink-0" /> : <Icon className="h-4 w-4 shrink-0 text-[var(--gold-bright)]" />}
                <span className="min-w-0">{need.short}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* I tuoi primi 3 passi */}
      <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm" aria-labelledby="welcome-steps">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="welcome-steps" className="text-lg font-bold text-[var(--ink)]">
            {t('stepsTitle')}
          </h2>
          <span className="text-xs font-bold text-[var(--muted)]">{t('stepsProgress', { done: count })}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--gold-pale)]" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={count}>
          <div className="h-full rounded-full bg-[var(--gold)] transition-[width]" style={{ width: `${(count / 3) * 100}%` }} />
        </div>
        <ol className="mt-4 space-y-4">
          {stepRow(1, done.picked, t('step1Title'), t('step1Text'))}
          {stepRow(
            2,
            done.tried,
            t('step2Title'),
            t('step2Text'),
            <>
              {tryServices.map((service) => {
                const Icon = marketplaceIconMap[service.iconName] ?? Smartphone
                return (
                  <Link
                    key={service.toolName}
                    href={service.href}
                    onClick={() => {
                      try {
                        sessionStorage.setItem(FROM_ICONS_KEY, '1')
                      } catch {
                        // facoltativo
                      }
                    }}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 text-xs font-bold text-white hover:bg-[var(--ink-soft)]"
                  >
                    <Icon className="h-3.5 w-3.5 text-[var(--gold-bright)]" /> {service.label}
                  </Link>
                )
              })}
              <Link href="/servizi" className="inline-flex min-h-9 items-center gap-1 px-1 text-xs font-bold text-[var(--gold)] hover:text-[var(--ink)]">
                {t('step2All')} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
          {stepRow(
            3,
            done.third,
            t('step3Title'),
            t('step3Text'),
            <>
              {videoId && (
                <button
                  type="button"
                  onClick={() => setShowVideo((v) => !v)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 text-xs font-bold text-white hover:bg-[var(--ink-soft)]"
                >
                  <Play className="h-3.5 w-3.5 fill-[var(--gold-bright)] text-[var(--gold-bright)]" /> {t('step3Video')}
                </button>
              )}
              <span onClickCapture={discover}>
                <NativeShareButton url={shareUrl} title="KUMANI" text={t('step3ShareText')} variant="light" label={t('step3Share')} />
              </span>
            </>
          )}
        </ol>
        {/* Video fuori dai passi: resta aperto anche quando il passo 3 si spunta */}
        {showVideo && videoId && (
          <div className="mt-4">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setShowVideo(false)} aria-label={t('closeVideo')} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div onClickCapture={discover}>
              <HomeVideo id={videoId} title="KUMANI" playLabel={t('step3Video')} />
            </div>
          </div>
        )}
      </section>

    </div>
  )
}

// «Mostra la Home completa»: in fondo alla Home di benvenuto
export function ShowFullHomeLink() {
  const t = useTranslations('welcomeHome')
  const router = useRouter()
  const [leaving, startLeaving] = useTransition()
  return (
    <div className="flex justify-center">
      <button
        type="button"
        disabled={leaving}
        onClick={() =>
          startLeaving(async () => {
            if (await showFullHome()) router.refresh()
          })
        }
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gold)] hover:text-[var(--ink)] disabled:opacity-50"
      >
        {leaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {t('showFull')} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}
