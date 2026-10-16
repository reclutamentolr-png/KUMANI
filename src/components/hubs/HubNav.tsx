'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BookUser, Briefcase, CalendarClock, House, PanelsTopLeft, Store, Dices, Flower2, PiggyBank, QrCode, Signature, Lock, Megaphone, ScanSearch, ShieldCheck, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { HUB_TABS, hubOf, type ServiceHub } from '@/lib/serviceHubs'

const HUB_ICON: Record<ServiceHub, LucideIcon> = { controlla: ScanSearch, proteggi: ShieldCheck, segnala: Megaphone, benessere: Flower2, giochi: Dices, qr: QrCode, spendly: PiggyBank, lavoro: Briefcase, gestione: BookUser, ufficio: Signature, negozio: Store, vetrina: PanelsTopLeft, agenda: CalendarClock, casaauto: House }

// Barra comune in cima agli strumenti di un servizio unito (Controlla,
// Proteggi, Segnala, Benessere, Giochi) e le sue schede. Le schede del piano che non si ha
// mostrano il lucchetto (aprendole si arriva a dove si sbloccano).
export default function HubNav({ locked }: { locked: string[] }) {
  const t = useTranslations('serviceHubs')
  const pathname = usePathname()
  const search = useSearchParams()
  const where = hubOf(pathname, search.toString())
  if (!where) return null
  const Icon = HUB_ICON[where.hub]
  return (
    <nav aria-label={t(`${where.hub}.title`)} className="border-b border-[var(--gold)]/20 bg-[#0f0f0f] text-white print:hidden">
      <div className="mx-auto flex max-w-5xl items-center gap-3 overflow-x-auto px-4 sm:px-6 lg:px-8">
        <span className="flex shrink-0 items-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--gold-bright)]">
          <Icon className="h-4 w-4" aria-hidden /> {t(`${where.hub}.short`)}
        </span>
        <div className="flex gap-1">
          {HUB_TABS[where.hub].map((tab) => {
            const active = tab.key === where.tab
            const isLocked = !!tab.tool && locked.includes(tab.tool)
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'border-[var(--gold)] text-[var(--gold-bright)]' : 'border-transparent text-white/65 hover:text-white'
                }`}
              >
                {isLocked && <Lock className="h-3.5 w-3.5" aria-label={t('locked')} />}
                {t(`${where.hub}.tab_${tab.key}`)}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
