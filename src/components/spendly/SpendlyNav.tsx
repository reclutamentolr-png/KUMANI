'use client'

import { usePathname } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, TrendingUp, Repeat, Wallet, Gauge, Receipt } from 'lucide-react'

const TABS = [
  { href: '/app/spendly', icon: LayoutDashboard, key: 'navDashboard' },
  { href: '/app/spendly/entrate', icon: TrendingUp, key: 'navIncome' },
  { href: '/app/spendly/bollette', icon: Receipt, key: 'navBills' },
  { href: '/app/spendly/spese-fisse', icon: Repeat, key: 'navFixedExpenses' },
  { href: '/app/spendly/spese-variabili', icon: Wallet, key: 'navVariableExpenses' },
  { href: '/app/spendly/capienza', icon: Gauge, key: 'navCapacity' },
] as const

// Tab interne di Spendly (Dashboard/Entrate/Spese Fisse/Spese
// Variabili/Capienza) — stesso ruolo della sidebar dell'app di riferimento
// analizzata, qui come barra orizzontale coerente con lo stile Kumani.
export default function SpendlyNav() {
  const t = useTranslations('spendly')
  const pathname = usePathname()

  return (
    <nav className="bg-[var(--ink)] border-b border-[var(--gold)]/15 overflow-x-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1">
        {TABS.map((tab) => {
          // pathname porta il prefisso di lingua per le lingue non
          // predefinite (/en/app/...) — confrontiamo sul suffisso
          // invece che sull'uguaglianza esatta.
          const isActive = pathname === tab.href || pathname.endsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-[var(--gold)] text-[var(--gold-bright)]'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {t(tab.key)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
