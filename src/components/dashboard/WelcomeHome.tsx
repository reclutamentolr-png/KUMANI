'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Baby, FileText, ArrowRight, BriefcaseBusiness, CalendarDays, Check, Clapperboard, ChevronDown, Gamepad2, Gift, HeartHandshake, HeartPulse, Plane, Info, Leaf, LifeBuoy, LoaderCircle, Lock, Megaphone, Music, PiggyBank, Plus, ShieldCheck, Smartphone, Store, Users, X, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { showFullHome, toggleWelcomeService } from '@/app/actions/welcome'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'

// Home di benvenuto (nuovi iscritti Gratis): «Ciao …, scegli cosa ti
// interessa di più» con le voci di «In cosa possiamo darti una mano?». Ogni
// voce si apre con tutti i suoi servizi (Gratis, Plus e Pro): con la «i» si
// legge a cosa servono, con «Aggiungi» finiscono in «I tuoi servizi». Sotto,
// «Inizia da qui»: servizi pronti da provare in riquadri quadrati. In fondo
// «Mostra la Home completa».
const NEED_ICON: Record<string, LucideIcon> = { Baby, FileText, ShieldCheck, CalendarDays, PiggyBank, Store, Megaphone, Clapperboard, HeartHandshake, HeartPulse, Plane, BriefcaseBusiness, Users, Gamepad2, Leaf, Gift, Music }

const PLAN_RANK = { free: 0, base: 1, pro: 2 } as const

export type WelcomeNeedService = { toolName: string; title: string; description: string; iconName: string; href: string; plan: 'free' | 'base' | 'pro'; open: boolean }
export type WelcomeNeed = { key: string; icon: string; short: string; intro: string; services: WelcomeNeedService[] }

export default function WelcomeHome({
  firstName,
  needs,
  favorites: initialFavorites,
  solve = false,
}: {
  firstName: string | null
  needs: WelcomeNeed[]
  picked: string[]
  favorites: string[]
  // KUMANI Risolvi visibile: riquadro «Hai un problema?»
  solve?: boolean
}) {
  const t = useTranslations('welcomeHome')
  const ts = useTranslations('solve')
  const router = useRouter()
  const [favorites, setFavorites] = useState(() => new Set(initialFavorites))
  const [openNeed, setOpenNeed] = useState<string | null>(null)
  const [infoOf, setInfoOf] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  // Aggiungi / togli un servizio da «I tuoi servizi»
  const toggle = async (needKey: string, toolName: string) => {
    const add = !favorites.has(toolName)
    setBusyKey(toolName)
    const ok = await toggleWelcomeService(needKey, toolName, add)
    setBusyKey(null)
    if (!ok) return
    setFavorites((prev) => {
      const next = new Set(prev)
      if (add) next.add(toolName)
      else next.delete(toolName)
      return next
    })
    router.refresh()
  }
  const planLabel = (plan: WelcomeNeedService['plan']) => (plan === 'pro' ? t('planPro') : plan === 'base' ? t('planBase') : t('planFree'))
  const planStyle = (plan: WelcomeNeedService['plan']) =>
    plan === 'pro' ? 'bg-[var(--gold)] text-[var(--ink)]' : plan === 'base' ? 'bg-white/15 text-white' : 'bg-emerald-500/20 text-emerald-300'
  const activeNeed = needs.find((need) => need.key === openNeed) ?? null

  return (
    <div className="space-y-5">
      {/* Scegli cosa ti interessa di più */}
      <section className="rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.18)] sm:p-6" aria-labelledby="welcome-title">
        <h2 id="welcome-title" className="text-xl font-extrabold leading-tight sm:text-2xl">
          {firstName ? t('helloName', { name: firstName }) : t('hello')} <span className="text-[var(--gold-bright)]">{t('question')}</span>
        </h2>
        <p className="mt-1.5 text-sm text-white/70">{t('questionHint')}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {needs.map((need) => {
            const Icon = NEED_ICON[need.icon] ?? ShieldCheck
            const added = need.services.filter((s) => favorites.has(s.toolName)).length
            const expanded = openNeed === need.key
            return (
              <button
                key={need.key}
                type="button"
                aria-expanded={expanded}
                aria-controls="welcome-need-panel"
                onClick={() => {
                  setOpenNeed(expanded ? null : need.key)
                  setInfoOf(null)
                  // Sul telefono l'elenco è sotto tutte le voci: ci portiamo lì
                  if (!expanded) setTimeout(() => document.getElementById('welcome-need-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
                }}
                className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-bold transition-colors ${
                  expanded ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--ink)]' : added > 0 ? 'border-[var(--gold)]/70 bg-white/[0.06] text-white' : 'border-white/15 bg-white/[0.06] text-white hover:border-[var(--gold)]/70'
                }`}
              >
                {added > 0 && !expanded ? <Check className="h-4 w-4 shrink-0 text-[var(--gold-bright)]" /> : <Icon className={`h-4 w-4 shrink-0 ${expanded ? '' : 'text-[var(--gold-bright)]'}`} />}
                <span className="min-w-0 flex-1">{need.short}</span>
                {added > 0 && <span className={`rounded-full px-1.5 text-[11px] ${expanded ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-[var(--gold)] text-[var(--ink)]'}`}>{added}</span>}
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )
          })}
        </div>

        {/* La voce aperta: tutti i suoi servizi, con la «i» e «Aggiungi» */}
        {activeNeed && (
          <div id="welcome-need-panel" className="mt-4 rounded-2xl border border-[var(--gold)]/30 bg-white/[0.04] p-4">
            <p className="text-sm leading-6 text-white/80">{activeNeed.intro}</p>
            <ul className="mt-3 divide-y divide-white/10">
              {/* In ordine di pacchetto: prima Free, poi Plus, poi Pro */}
              {[...activeNeed.services].sort((a, b) => PLAN_RANK[a.plan] - PLAN_RANK[b.plan]).map((service) => {
                const Icon = marketplaceIconMap[service.iconName] ?? Smartphone
                const isOn = favorites.has(service.toolName)
                const showInfo = infoOf === service.toolName
                const [hubName, toolTitle] = service.title.includes(' · ') ? service.title.split(' · ', 2) : [null, service.title]
                return (
                  <li key={service.toolName} className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <Icon className="h-4.5 w-4.5 text-[var(--gold-bright)]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold">
                          <span className="min-w-0">{toolTitle}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${planStyle(service.plan)}`}>
                            {!service.open && <Lock className="h-2.5 w-2.5" />} {planLabel(service.plan)}
                          </span>
                        </p>
                        {hubName && <p className="truncate text-xs text-white/55">{hubName}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setInfoOf(showInfo ? null : service.toolName)}
                        aria-expanded={showInfo}
                        aria-label={t('info', { service: toolTitle })}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[var(--ink)] hover:bg-emerald-300 ${showInfo ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--ink)]' : ''}`}
                      >
                        <Info className="h-5 w-5" strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => toggle(activeNeed.key, service.toolName)}
                        aria-pressed={isOn}
                        aria-label={`${isOn ? t('remove') : t('add')}: ${toolTitle}`}
                        className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-extrabold disabled:opacity-60 ${
                          isOn ? 'bg-emerald-600 text-white' : 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]'
                        }`}
                      >
                        {busyKey === service.toolName ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : isOn ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{isOn ? t('remove') : t('add')}</span>
                      </button>
                    </div>
                    {showInfo && (
                      <div className="mt-2 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[13px] leading-5 text-white/85">
                        <p>{service.description}</p>
                        <p className="mt-1.5 text-xs font-semibold text-[var(--gold-bright)]">
                          {service.open ? t('infoOpen') : service.plan === 'pro' ? t('infoPro') : t('infoBase')}
                        </p>
                        {service.open && (
                          <Link href={service.href} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-white underline underline-offset-4">
                            {t('tryNow')} <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-white/55">{t('panelHint')}</p>
          </div>
        )}
      </section>

      {/* KUMANI Risolvi: guide passo passo per i problemi di tutti i giorni */}
      {solve && (
        <Link
          href="/risolvi"
          className="flex items-center gap-4 rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-br from-[#2a2418] to-[var(--ink)] p-4 text-white shadow-sm transition-colors hover:border-[var(--gold)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
            <LifeBuoy className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold text-[var(--gold-bright)]">{ts('entryTitle')}</span>
            <span className="block text-sm text-white/75">{ts('entryText')}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
        </Link>
      )}

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
