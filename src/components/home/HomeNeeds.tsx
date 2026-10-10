'use client'

import { useState } from 'react'
import { ArrowRight, BriefcaseBusiness, CalendarDays, Gift, Leaf, PiggyBank, ShieldCheck, Smartphone, Store, Users, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import type { HomeNeed } from '@/lib/homeNeeds'

// Homepage: «In cosa possiamo darti una mano?». Si sceglie una risposta semplice e
// compaiono i servizi giusti, ognuno con la sua pagina: una porta d'ingresso
// più semplice della griglia di tutti i servizi.

const NEED_ICON: Record<string, LucideIcon> = { ShieldCheck, CalendarDays, PiggyBank, Store, BriefcaseBusiness, Users, Leaf, Gift }
const EXTRA_ICON: Record<string, LucideIcon> = { Gift, Users }

export default function HomeNeeds({
  needs,
  texts,
}: {
  needs: HomeNeed[]
  texts: { eyebrow: string; title: string; subtitle: string; hint: string; open: string; all: string }
}) {
  const [active, setActive] = useState<HomeNeed['key'] | null>(null)
  const need = needs.find((n) => n.key === active) ?? null

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-[var(--gold)]">{texts.eyebrow}</p>
      <h2 className="mt-2 text-center text-3xl font-bold text-[var(--ink)] sm:text-4xl">{texts.title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-base text-gray-600 sm:text-lg">{texts.subtitle}</p>

      <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label={texts.title}>
        {needs.map((n) => {
          const Icon = NEED_ICON[n.icon] ?? Smartphone
          const on = active === n.key
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => setActive(on ? null : n.key)}
              aria-pressed={on}
              aria-controls="home-needs-answer"
              className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left text-sm font-semibold leading-snug transition sm:text-[15px] ${
                on ? 'border-[var(--ink)] bg-[var(--gold-pale)] text-[var(--ink)] shadow-lg' : 'border-[var(--gold)]/30 bg-white text-[var(--ink)] hover:border-[var(--gold)] hover:shadow-md'
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
                <Icon className="h-5 w-5" />
              </span>
              {n.label}
            </button>
          )
        })}
      </div>

      <div id="home-needs-answer" aria-live="polite" className="mt-5">
        {need ? (
          <div className="rounded-3xl border border-[var(--gold)]/30 bg-white p-4 shadow-[0_14px_40px_rgba(23,23,23,0.08)] motion-safe:animate-[fadeIn_0.25s_ease-out] sm:p-6">
            <p className="text-[15px] text-gray-700">{need.intro}</p>
            <ul className={`mt-4 grid gap-3 ${need.items.length > 2 ? 'sm:grid-cols-2' : ''} ${need.items.length > 3 ? 'lg:grid-cols-4' : need.items.length === 3 ? 'lg:grid-cols-3' : ''}`}>
              {need.items.map((item) => {
                const Icon = marketplaceIconMap[item.iconName] ?? EXTRA_ICON[item.iconName] ?? Smartphone
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="group flex h-full items-start gap-3 rounded-2xl border border-gray-200 bg-[var(--background)] p-3 transition hover:border-[var(--gold)] hover:bg-white hover:shadow-md sm:flex-col sm:gap-0 sm:p-4"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col sm:mt-3">
                        <span className="font-bold text-[var(--ink)]">{item.title}</span>
                        <span className="mt-0.5 line-clamp-2 flex-1 text-sm leading-snug text-gray-600 sm:mt-1 sm:line-clamp-3">{item.description}</span>
                        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--ink)] sm:mt-3">
                          {texts.open} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <p className="text-center text-sm text-gray-500">{texts.hint}</p>
        )}
        <p className="mt-5 text-center">
          <Link href="/catalogo" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--ink)] underline-offset-4 hover:underline">
            {texts.all} <ArrowRight className="h-4 w-4" />
          </Link>
        </p>
      </div>
    </div>
  )
}
