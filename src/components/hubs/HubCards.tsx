'use client'

import { useTranslations } from 'next-intl'
import { ArrowRight, BookUser, Briefcase, CalendarClock, House, PanelsTopLeft, Store, Dices, Flower2, PiggyBank, QrCode, Signature, Lock, Megaphone, ScanSearch, ShieldCheck, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import type { ServiceItem } from '@/lib/servicesCatalog'
import { HUB_HOME, HUB_TABS, type ServiceHub } from '@/lib/serviceHubs'

const HUB_ICON: Record<ServiceHub, LucideIcon> = { controlla: ScanSearch, proteggi: ShieldCheck, segnala: Megaphone, benessere: Flower2, giochi: Dices, qr: QrCode, spendly: PiggyBank, lavoro: Briefcase, gestione: BookUser, ufficio: Signature, negozio: Store, vetrina: PanelsTopLeft, agenda: CalendarClock, casaauto: House }

// Pagina Servizi: i servizi uniti di un gruppo (Sicurezza: Controlla,
// Proteggi, Segnala; Benessere; Giochi) con le loro schede; quelle del piano
// che non si ha col lucchetto.
export default function HubCards({ hubs, items }: { hubs: readonly ServiceHub[]; items: ServiceItem[] }) {
  const t = useTranslations('serviceHubs')
  const openOf = new Map(items.map((i) => [i.toolName, i.open]))
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {hubs.map((hub) => {
        const Icon = HUB_ICON[hub]
        return (
          <Link
            key={hub}
            href={HUB_HOME[hub]}
            className="group flex flex-col rounded-2xl border border-[var(--gold)]/35 bg-white p-4 shadow-sm transition-colors hover:border-[var(--gold)] sm:p-5"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-extrabold text-[var(--ink)]">{t(`${hub}.title`)}</span>
                <span className="block text-sm font-semibold text-[var(--gold)]">{t(`${hub}.tagline`)}</span>
              </span>
            </span>
            <span className="mt-2 text-sm text-[var(--muted)]">{t(`${hub}.description`)}</span>
            <span className="mt-3 flex flex-wrap gap-1.5">
              {HUB_TABS[hub]
                .filter((tab) => tab.key !== 'all' && (!tab.tool || openOf.has(tab.tool)))
                .map((tab) => {
                  const locked = !!tab.tool && openOf.get(tab.tool) === false
                  return (
                    <span key={tab.key} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${locked ? 'bg-gray-100 text-gray-500' : 'bg-[var(--gold)]/10 text-[var(--ink)]'}`}>
                      {locked && <Lock className="h-3 w-3" aria-label={t('locked')} />}
                      {t(`${hub}.tab_${tab.key}`)}
                    </span>
                  )
                })}
            </span>
            <span className="mt-4 flex items-center gap-1 text-sm font-bold text-[var(--ink)]">
              {t('open')} <ArrowRight className="h-4 w-4 text-[var(--gold)] transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )
      })}
    </div>
  )
}
