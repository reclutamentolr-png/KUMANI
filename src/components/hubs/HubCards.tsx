'use client'

import { useTranslations } from 'next-intl'
import { ArrowRight, BookUser, Briefcase, CalendarClock, House, PanelsTopLeft, Store, Dices, Flower2, PiggyBank, QrCode, Signature, Lock, Megaphone, ScanSearch, ShieldCheck, type LucideIcon, Plane, HeartHandshake, Share2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import PlanTag from '@/components/PlanTag'
import type { ServiceItem } from '@/lib/servicesCatalog'
import { HUB_HOME, HUB_TABS, type ServiceHub } from '@/lib/serviceHubs'
import type { RequiredPlan } from '@/lib/plans'

// Schede in ordine di pacchetto: prima Free, poi Plus, poi Pro
const PLAN_RANK: Record<RequiredPlan, number> = { free: 0, base: 1, pro: 2 }

const HUB_ICON: Record<ServiceHub, LucideIcon> = { controlla: ScanSearch, proteggi: ShieldCheck, segnala: Megaphone, benessere: Flower2, giochi: Dices, qr: QrCode, spendly: PiggyBank, lavoro: Briefcase, gestione: BookUser, ufficio: Signature, negozio: Store, vetrina: PanelsTopLeft, social: Share2, agenda: CalendarClock, casaauto: House, viaggi: Plane, amicizie: HeartHandshake }

// Pagina Servizi: i servizi uniti di un gruppo (Sicurezza: Controlla,
// Proteggi, Segnala; Benessere; Giochi) con le loro schede; quelle del piano
// che non si ha col lucchetto. Ogni scheda porta al suo strumento; il titolo e
// «Apri» all'ingresso del servizio (prima tutto il riquadro era un link solo e
// qualsiasi scheda apriva la prima).
export default function HubCards({ hubs, items }: { hubs: readonly ServiceHub[]; items: ServiceItem[] }) {
  const t = useTranslations('serviceHubs')
  const openOf = new Map(items.map((i) => [i.toolName, i.open]))
  const planOf = new Map(items.map((i) => [i.toolName, i.plan]))
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {hubs.map((hub) => {
        const Icon = HUB_ICON[hub]
        return (
          <div key={hub} className="gold-corner group flex flex-col rounded-2xl border border-[var(--gold)]/35 bg-white p-4 shadow-sm transition-colors hover:border-[var(--gold)] sm:p-5">
            <Link href={HUB_HOME[hub]} className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-extrabold text-[var(--ink)]">{t(`${hub}.title`)}</span>
                <span className="block text-sm font-semibold text-[var(--gold)]">{t(`${hub}.tagline`)}</span>
              </span>
            </Link>
            <span className="mt-2 text-sm text-[var(--muted)]">{t(`${hub}.description`)}</span>
            <span className="mt-3 flex flex-wrap gap-x-1.5 gap-y-2">
              {HUB_TABS[hub]
                .filter((tab) => tab.key !== 'all' && (!tab.tool || openOf.has(tab.tool)))
                .map((tab) => ({ tab, plan: tab.plan ?? planOf.get(tab.tool ?? tab.planTool ?? '') }))
                .sort((a, b) => (a.plan ? PLAN_RANK[a.plan] : 0) - (b.plan ? PLAN_RANK[b.plan] : 0))
                .map(({ tab, plan }) => {
                  const locked = !!tab.tool && openOf.get(tab.tool) === false
                  return (
                    <span key={tab.key} className="flex flex-col items-center gap-1">
                    <Link
                      href={tab.href}
                      className={`inline-flex min-h-8 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${locked ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] font-bold text-[var(--ink)] shadow-sm hover:brightness-105'}`}
                    >
                      {locked && <Lock className="h-3 w-3" aria-label={t('locked')} />}
                      {t(`${hub}.tab_${tab.key}`)}
                    </Link>
                    <PlanTag plan={plan} />
                    </span>
                  )
                })}
            </span>
            <Link href={HUB_HOME[hub]} className="mt-4 inline-flex items-center gap-1 self-start rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 hover:bg-sky-100">
              {t('open')} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        )
      })}
    </div>
  )
}
