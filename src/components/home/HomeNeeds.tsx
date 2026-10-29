'use client'

import { Fragment, useRef, useState } from 'react'
import { Baby, FileText, ArrowRight, HandPlatter, Hourglass, Star, Tag, BriefcaseBusiness, CalendarDays, Clapperboard, Gamepad2, Gift, HeartHandshake, HeartPulse, Plane, Leaf, Megaphone, Music, PiggyBank, ShieldCheck, Smartphone, Store, Users, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import type { HomeNeed } from '@/lib/homeNeeds'
import { revealPanel } from '@/lib/revealPanel'

// Homepage: «In cosa possiamo darti una mano?». Si sceglie una risposta semplice e
// compaiono i servizi giusti, ognuno con la sua pagina: una porta d'ingresso
// più semplice della griglia di tutti i servizi.

const NEED_ICON: Record<string, LucideIcon> = { Baby, FileText, ShieldCheck, CalendarDays, PiggyBank, Store, Megaphone, Clapperboard, HeartHandshake, HeartPulse, Plane, BriefcaseBusiness, Users, Gamepad2, Leaf, Gift, Music }
const EXTRA_ICON: Record<string, LucideIcon> = { Gift, Users, Tag, HandPlatter, Hourglass, Star }

export default function HomeNeeds({
  needs,
  texts,
}: {
  needs: HomeNeed[]
  texts: { eyebrow: string; title: string; subtitle: string; hint: string; open: string; all: string }
}) {
  const [active, setActive] = useState<HomeNeed['key'] | null>(null)
  const need = needs.find((n) => n.key === active) ?? null
  const root = useRef<HTMLDivElement>(null)
  // Telefono: due caselle per riga, la risposta si apre subito sotto la riga toccata
  const activeIndex = needs.findIndex((n) => n.key === active)
  const rowEnd = activeIndex < 0 ? -1 : Math.min(activeIndex - (activeIndex % 2) + 1, needs.length - 1)
  const choose = (key: HomeNeed['key'] | null) => {
    setActive(key)
    if (key) revealPanel(root.current)
  }

  const answer = (need: HomeNeed) => (
    <div className="rounded-3xl border border-[var(--gold)]/30 bg-white p-4 shadow-[0_14px_40px_rgba(23,23,23,0.08)] motion-safe:animate-[fadeIn_0.25s_ease-out] sm:p-6">
      <p className="text-[15px] text-gray-700">{need.intro}</p>
      <ul className={`mt-4 grid gap-3 ${need.items.length > 2 ? 'sm:grid-cols-2' : ''} ${need.items.length > 3 ? 'lg:grid-cols-4' : need.items.length === 3 ? 'lg:grid-cols-3' : ''}`}>
        {need.items.map((item) => {
          const Icon = marketplaceIconMap[item.iconName] ?? EXTRA_ICON[item.iconName] ?? Smartphone
          // Servizio unito: tutte le sue schede, ognuna con la sua pagina
          if (item.links?.length)
            return (
              <li key={item.name}>
                <div className="flex h-full items-start gap-3 gold-corner gold-corner-sm rounded-2xl border border-gray-200 bg-[var(--background)] p-3 sm:flex-col sm:gap-0 sm:p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col sm:mt-3">
                    <span className="font-bold text-[var(--ink)]">{item.title}</span>
                    <span className="mt-0.5 line-clamp-3 text-sm leading-snug text-gray-600 sm:mt-1">{item.description}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5 sm:mt-3">
                      {item.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[var(--gold)]/40 bg-white px-3 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--gold)] hover:bg-[var(--gold)]/10"
                        >
                          {link.title} <ArrowRight className="h-3 w-3" />
                        </Link>
                      ))}
                    </span>
                  </span>
                </div>
              </li>
            )
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                className="group flex h-full items-start gap-3 gold-corner gold-corner-sm rounded-2xl border border-gray-200 bg-[var(--background)] p-3 transition hover:border-[var(--gold)] hover:bg-white hover:shadow-md sm:flex-col sm:gap-0 sm:p-4"
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
  )

  return (
    <div ref={root} className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-[var(--gold)]">{texts.eyebrow}</p>
      <h2 className="mt-2 text-center text-3xl font-bold text-[var(--ink)] sm:text-4xl">{texts.title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-base text-gray-600 sm:text-lg">{texts.subtitle}</p>

      <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label={texts.title}>
        {needs.map((n, i) => {
          const Icon = NEED_ICON[n.icon] ?? Smartphone
          const on = active === n.key
          return (
            <Fragment key={n.key}>
            <button
              type="button"
              onClick={() => choose(on ? null : n.key)}
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
            {need && i === rowEnd && (
              <div data-reveal-panel className="col-span-2 sm:hidden">
                {answer(need)}
              </div>
            )}
            </Fragment>
          )
        })}
      </div>

      <div id="home-needs-answer" aria-live="polite" className="mt-5">
        {need ? (
          <div data-reveal-panel className="hidden sm:block">{answer(need)}</div>
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
