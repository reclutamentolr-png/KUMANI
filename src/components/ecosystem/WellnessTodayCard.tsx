'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Brain, Check, Flame, Gift, LoaderCircle, Palette, Wind } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { claimWellnessBonus, type WellnessToday } from '@/app/actions/ecosystem'

// «Il tuo benessere di oggi»: respiro (Oxygen), concentrazione (Focus) e
// Mandala oppure NeuroBalance. Fatti tutti e tre si ritira il bonus di KU
// Karma (una volta al giorno), con la serie di giorni consecutivi.
export default function WellnessTodayCard({ initial }: { initial: WellnessToday }) {
  const t = useTranslations('ecosystem')
  const [state, setState] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [awarded, setAwarded] = useState<number | null>(null)

  const steps = [
    { done: state.breath, label: t('wellnessBreath'), href: '/marketplace/oxygen', Icon: Wind },
    { done: state.focus, label: t('wellnessFocus'), href: '/marketplace/focus', Icon: Brain },
    { done: state.mind, label: t('wellnessMind'), href: '/marketplace/mandala', Icon: Palette },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const complete = doneCount === steps.length

  const claim = async () => {
    setBusy(true)
    const result = await claimWellnessBonus()
    setBusy(false)
    if (result) {
      setState(result)
      if (result.awarded) setAwarded(result.awarded)
    }
  }

  return (
    <section className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[var(--ink)]">{t('wellnessTitle')}</h2>
        {state.streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
            <Flame className="h-3.5 w-3.5" /> {t('wellnessStreak', { count: state.streak })}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        {state.claimed ? t('wellnessDoneToday') : t('wellnessIntro', { bonus: state.bonus })}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map(({ done, label, href, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              done ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-teal-200 bg-white text-[var(--ink)] hover:border-teal-400'
            }`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-500 text-white' : 'bg-teal-100 text-teal-700'}`}>
              {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span className="min-w-0">{label}</span>
          </Link>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[var(--muted)]">{t('wellnessProgress', { done: doneCount, total: steps.length })}</span>
        {state.claimed ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <Check className="h-4 w-4" /> {awarded ? t('wellnessAwarded', { bonus: awarded }) : t('wellnessClaimed')}
          </span>
        ) : (
          <button
            type="button"
            onClick={claim}
            disabled={!complete || busy}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {t('wellnessClaim', { bonus: state.bonus })}
          </button>
        )}
      </div>
    </section>
  )
}
