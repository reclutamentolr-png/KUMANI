'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ExternalLink, KeyRound, LifeBuoy, ShieldAlert, ShieldCheck, UserLock } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { tutelaDone } from '@/app/actions/tutela'

// Sezioni e controlli della guida (i testi stanno in «tutela.items.<id>»)
const SECTIONS = [
  { key: 'basics', icon: KeyRound, items: ['twofa', 'password', 'recovery', 'sessions', 'backup'] },
  { key: 'privacy', icon: UserLock, items: ['private', 'tags', 'location', 'kids', 'personal'] },
  { key: 'scams', icon: ShieldAlert, items: ['fakeSupport', 'blueTick', 'clone', 'whatsappCode', 'collab', 'giveaway', 'videoLink'] },
] as const
type ItemId = (typeof SECTIONS)[number]['items'][number]
const CHECKS: ItemId[] = [...SECTIONS[0].items, ...SECTIONS[1].items]
const STORE = 'kumani:tutela:done'

// KUMANI TUTELA (gratis per tutti): i social più sicuri in pochi passi. Le
// spunte restano sul dispositivo; la percentuale conta i controlli fatti.
export default function TutelaApp() {
  const t = useTranslations('tutela')
  const [done, setDone] = useState<string[]>([])
  const [open, setOpen] = useState<string | null>('twofa')

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? '[]') as unknown
      // eslint-disable-next-line react-hooks/set-state-in-effect -- le spunte si leggono solo nel browser
      if (Array.isArray(saved)) setDone(saved.filter((x): x is string => typeof x === 'string'))
    } catch {
      // facoltativo
    }
  }, [])

  const toggle = (id: string) =>
    setDone((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      try {
        localStorage.setItem(STORE, JSON.stringify(next))
      } catch {
        // facoltativo
      }
      if (next.length > list.length) void tutelaDone()
      return next
    })

  const pct = Math.round((CHECKS.filter((id) => done.includes(id)).length / CHECKS.length) * 100)

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className={`h-10 w-10 shrink-0 ${pct === 100 ? 'text-emerald-600' : 'text-[var(--gold)]'}`} />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-[var(--ink)]">{t('score', { pct })}</p>
            <p className="text-sm text-[var(--muted)]">{pct === 100 ? t('scoreDone') : t('scoreHint')}</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full transition-all ${pct === 100 ? 'bg-emerald-600' : 'bg-[var(--gold)]'}`} style={{ width: `${pct}%` }} />
        </div>
      </section>

      {SECTIONS.map((s) => (
        <section key={s.key} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-extrabold text-[var(--ink)]">
            <s.icon className="h-5 w-5 text-[var(--gold)]" /> {t(`section_${s.key}`)}
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{t(`section_${s.key}_text`)}</p>
          <ul className="mt-3 divide-y divide-gray-100">
            {s.items.map((id) => {
              const check = s.key !== 'scams'
              const isOpen = open === id
              return (
                <li key={id} className="py-2">
                  <div className="flex items-start gap-3">
                    {check ? (
                      <input type="checkbox" checked={done.includes(id)} onChange={() => toggle(id)} aria-label={t('markDone')} className="mt-1 h-5 w-5 shrink-0 accent-[var(--gold)]" />
                    ) : (
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    )}
                    <button type="button" onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left">
                      <span className={`font-semibold text-[var(--ink)] ${check && done.includes(id) ? 'line-through opacity-60' : ''}`}>{t(`items.${id}.title`)}</span>
                      <ChevronDown className={`mt-0.5 h-5 w-5 shrink-0 text-[var(--muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {isOpen && <p className="mt-2 whitespace-pre-line pl-8 text-sm leading-relaxed text-[var(--muted)]">{t(`items.${id}.text`)}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <section className="rounded-2xl border-2 border-red-200 bg-red-50/50 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-extrabold text-[var(--ink)]">
          <LifeBuoy className="h-5 w-5 text-red-700" /> {t('hackedTitle')}
        </h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--ink)]">
          <li>{t('hacked1')}</li>
          <li>{t('hacked2')}</li>
          <li>{t('hacked3')}</li>
          <li>{t('hacked4')}</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          <a href="https://www.instagram.com/hacked/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-[var(--ink)] shadow-sm">
            Instagram <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a href="https://www.facebook.com/hacked" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-[var(--ink)] shadow-sm">
            Facebook <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a href="https://www.commissariatodips.it" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-[var(--ink)] shadow-sm">
            {t('police')} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
        <p className="font-bold text-[var(--ink)]">{t('toolsTitle')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link href="/marketplace/svat" className="rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]">
            {t('toolSpeculum')}
          </Link>
          <Link href="/marketplace/rete-antitruffa" className="rounded-xl border border-[var(--gold)]/50 px-4 py-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold)]/10">
            {t('toolRete')}
          </Link>
        </div>
      </section>
    </div>
  )
}
