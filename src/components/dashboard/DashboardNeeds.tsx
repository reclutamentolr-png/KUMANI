'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, CalendarDays, ChevronDown, Gift, Leaf, PiggyBank, ShieldCheck, Smartphone, Store, Users, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import type { HomeNeed } from '@/lib/homeNeeds'

// Dashboard: «In cosa possiamo darti una mano?» in versione compatta, subito
// sotto la fascia «Oggi». Risposte brevi, tutte a vista (due per riga sul telefono);
// toccandone una compaiono i servizi giusti, ognuno con «Apri». Si può
// chiudere (resta una riga sola, che la riapre) e la scelta si ricorda su
// questo dispositivo.

const NEED_ICON: Record<string, LucideIcon> = { ShieldCheck, CalendarDays, PiggyBank, Store, BriefcaseBusiness, Users, Leaf, Gift }
const EXTRA_ICON: Record<string, LucideIcon> = { Gift, Users }
const HIDDEN_KEY = 'kumani_dash_needs_hidden'

export default function DashboardNeeds({
  needs,
  texts,
}: {
  needs: HomeNeed[]
  texts: { title: string; hint: string; open: string; hide: string }
}) {
  const [active, setActive] = useState<HomeNeed['key'] | null>(null)
  const [hidden, setHidden] = useState(false)
  const need = needs.find((n) => n.key === active) ?? null

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(HIDDEN_KEY) === '1') setHidden(true)
    } catch {
      // memoria del browser non disponibile: resta aperta
    }
  }, [])

  const toggleHidden = () => {
    const next = !hidden
    setHidden(next)
    if (next) setActive(null)
    try {
      if (next) localStorage.setItem(HIDDEN_KEY, '1')
      else localStorage.removeItem(HIDDEN_KEY)
    } catch {
      // vale solo per questa visita
    }
  }

  return (
    <section aria-labelledby="dash-needs-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="dash-needs-title" className="text-lg font-bold text-[var(--ink)] sm:text-xl">
          {hidden ? (
            <button type="button" onClick={toggleHidden} aria-expanded={false} className="flex cursor-pointer items-center gap-1.5 text-left hover:underline">
              {texts.title} <ChevronDown className="h-4 w-4 shrink-0 text-[var(--gold)]" />
            </button>
          ) : (
            texts.title
          )}
        </h2>
        {!hidden && (
          <button type="button" onClick={toggleHidden} aria-expanded className="min-h-9 shrink-0 cursor-pointer rounded-lg px-2 text-xs font-semibold text-[var(--muted)] hover:bg-black/5">
            {texts.hide}
          </button>
        )}
      </div>

      {!hidden && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label={texts.title}>
            {needs.map((n) => {
              const Icon = NEED_ICON[n.icon] ?? Smartphone
              const on = active === n.key
              return (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => setActive(on ? null : n.key)}
                  aria-pressed={on}
                  aria-controls="dash-needs-answer"
                  title={n.label}
                  className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] py-1.5 pl-1.5 pr-3 text-left text-[13px] font-semibold leading-tight sm:gap-2 sm:pr-3.5 sm:text-sm text-[var(--ink)] transition ${
                    on ? 'border-[var(--ink)] bg-[var(--gold-pale)] shadow-md' : 'border-[var(--gold)]/35 bg-white hover:border-[var(--gold)]'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${on ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {n.short}
                </button>
              )
            })}
          </div>

          <div id="dash-needs-answer" aria-live="polite" className="mt-3">
            {need ? (
              <div className="rounded-2xl border border-[var(--gold)]/30 bg-white p-3 shadow-[0_10px_30px_rgba(23,23,23,0.07)] motion-safe:animate-[fadeIn_0.25s_ease-out] sm:p-4">
                <p className="px-1 text-sm text-gray-700">{need.intro}</p>
                <ul className={`mt-3 grid gap-2 ${need.items.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                  {need.items.map((item) => {
                    const Icon = marketplaceIconMap[item.iconName] ?? EXTRA_ICON[item.iconName] ?? Smartphone
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className="group flex h-full items-center gap-3 rounded-xl border border-gray-200 bg-[var(--background)] p-2.5 transition hover:border-[var(--gold)] hover:bg-white"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold text-[var(--ink)]">{item.title}</span>
                            <span className="line-clamp-2 text-xs leading-snug text-gray-600">{item.description}</span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-[var(--ink)]">
                            {texts.open} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">{texts.hint}</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
