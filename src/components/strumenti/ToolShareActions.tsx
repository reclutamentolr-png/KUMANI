'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, Crown, Ticket } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/client'
import { getToolShareViewer, type ToolShareViewer } from '@/app/actions/toolShare'

// Pulsanti della pagina pubblica di un servizio (/strumenti/[tool]). La
// pagina è uguale per tutti e tenuta in memoria; la parte personale si
// completa qui, nel browser:
// - chi arriva da un link condiviso (?ref=CODICE) vede chi l'ha invitato e
//   si iscrive con quel codice già inserito;
// - chi è già iscritto vede "Apri", oppure Pass del solo servizio o piano.
// Senza accesso e senza ?ref non si chiede nulla al server.

type Plan = 'free' | 'base' | 'pro'

type Props = {
  variant: 'hero' | 'footer'
  toolName: string
  toolTitle: string
  toolHref: string
  requiredPlan: Plan
  off: boolean
  prices: { base: number; pro: number }
  // Solo per variant 'footer': invito a iscriversi in fondo alla pagina
  ctaTitle?: string
  ctaText?: string
}

type State = { loading: boolean; viewer: ToolShareViewer }

const EMPTY: ToolShareViewer = { inviter: null, member: null }

// Una sola richiesta per pagina, condivisa dai due blocchi di pulsanti
const pending = new Map<string, Promise<ToolShareViewer>>()

function loadViewer(toolName: string): { hasWork: Promise<boolean>; viewer: () => Promise<ToolShareViewer> } {
  const ref = new URLSearchParams(window.location.search).get('ref')
  const key = `${toolName}|${ref ?? ''}`
  // Sessione letta in locale (cookie del browser), senza chiamate
  const hasWork = ref
    ? Promise.resolve(true)
    : createClient()
        .auth.getSession()
        .then(({ data }) => !!data.session)
        .catch(() => false)
  const viewer = () => {
    let p = pending.get(key)
    if (!p) {
      p = getToolShareViewer(toolName, ref).catch(() => EMPTY)
      pending.set(key, p)
    }
    return p
  }
  return { hasWork, viewer }
}

export default function ToolShareActions({ variant, toolName, toolTitle, toolHref, requiredPlan, off, prices, ctaTitle, ctaText }: Props) {
  const t = useTranslations('toolShare')
  const tmb = useTranslations('toolMember')
  const locale = useLocale()
  const [state, setState] = useState<State>({ loading: false, viewer: EMPTY })

  useEffect(() => {
    let alive = true
    const { hasWork, viewer } = loadViewer(toolName)
    hasWork.then((work) => {
      if (!alive || !work) return
      setState((s) => ({ ...s, loading: true }))
      viewer().then((v) => {
        if (alive) setState({ loading: false, viewer: v })
      })
    })
    return () => {
      alive = false
    }
  }, [toolName])

  // Utente collegato in attesa della risposta: niente "Iscriviti" per un attimo
  if (state.loading) return null

  const { inviter, member } = state.viewer
  const registerHref = inviter ? `/register?sponsor=${encodeURIComponent(inviter.referralCode)}` : '/register'
  const money = (eur: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(eur)

  const memberActions = member && !off && (
    <div className="mt-6 space-y-3 text-left">
      {member.allowed ? (
        <Link
          href={toolHref}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
        >
          {tmb('open', { tool: toolTitle })} <ArrowRight className="h-5 w-5" />
        </Link>
      ) : (
        <>
          <p className="text-center text-sm font-semibold text-gray-200">{tmb('choose')}</p>
          {member.passEnabled && (
            <Link href={`/pass/${toolName}`} className="flex items-center gap-3 rounded-2xl border border-[var(--gold)]/40 bg-white/[0.04] p-4 transition hover:border-[var(--gold)] hover:bg-white/[0.07]">
              <Ticket className="h-6 w-6 shrink-0 text-[var(--gold-bright)]" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{tmb('passTitle')}</span>
                <span className="block text-sm text-gray-300">{tmb('passText', { price: money(member.passPriceCents / 100) })}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            </Link>
          )}
          <Link
            href={requiredPlan === 'pro' ? `/pro?tool=${encodeURIComponent(toolName)}` : '/billing'}
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] p-4 text-[var(--ink)] transition hover:brightness-110"
          >
            <Crown className="h-6 w-6 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{tmb('planTitle')}</span>
              <span className="block text-sm">{tmb('planText', { plan: requiredPlan === 'pro' ? 'Pro' : 'Base', price: money(requiredPlan === 'pro' ? prices.pro : prices.base) })}</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0" />
          </Link>
        </>
      )}
    </div>
  )

  if (variant === 'footer') {
    if (member) {
      return memberActions ? (
        <section className="rounded-3xl border border-[var(--gold)]/25 bg-white/[0.04] p-6">
          <h2 className="text-center text-xl font-bold">{member.allowed ? tmb('readyTitle') : tmb('decideTitle')}</h2>
          {memberActions}
        </section>
      ) : null
    }
    return (
      <section className="rounded-3xl border border-[var(--gold)]/25 bg-white/[0.04] p-6 text-center">
        <h2 className="text-xl font-bold">{ctaTitle}</h2>
        <p className="mt-2 leading-relaxed text-gray-300">{ctaText}</p>
        <Link
          href={registerHref}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
        >
          {t('ctaRegister')} <ArrowRight className="h-5 w-5" />
        </Link>
      </section>
    )
  }

  if (member) {
    return (
      <>
        {memberActions}
        <Link href="/servizi" className="mt-4 inline-block text-sm font-semibold text-[var(--gold-bright)] hover:text-white">
          {tmb('back')}
        </Link>
      </>
    )
  }

  return (
    <>
      {inviter && <p className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-sm text-gray-200">{t('invitedBy', { name: inviter.firstName })}</p>}
      <Link
        href={registerHref}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
      >
        {t('ctaRegister')} <ArrowRight className="h-5 w-5" />
      </Link>
      <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[var(--gold-bright)] hover:text-white">
        {t('ctaDiscover')}
      </Link>
    </>
  )
}
