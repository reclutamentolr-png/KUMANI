'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2 } from 'lucide-react'
import { saveInterests } from '@/app/actions/interests'
import { SERVICE_GROUPS, STARTER_SERVICES, type ServiceGroup } from '@/lib/serviceGroups'
import type { ServiceItem } from '@/lib/servicesCatalog'

// Primo accesso: "Cosa ti interessa?". Le scelte diventano i primi servizi
// preferiti della Home; poi parte il tour (la pagina si ricarica).
export default function InterestsOnboarding({ items }: { items: ServiceItem[] }) {
  const t = useTranslations('hub')
  const router = useRouter()
  const [picked, setPicked] = useState<ServiceGroup[]>([])
  const [hidden, setHidden] = useState(false)
  const [isPending, startTransition] = useTransition()

  const titles = new Map(items.map((item) => [item.toolName, item.title]))
  // Esempi per ogni interesse: i servizi consigliati accesi dall'Admin
  const choices = SERVICE_GROUPS.map((group) => ({
    group,
    examples: STARTER_SERVICES[group]
      .map((name) => titles.get(name))
      .filter(Boolean)
      .slice(0, 3)
      .join(', '),
  })).filter(({ examples }) => examples.length > 0)

  const finish = (groups: ServiceGroup[]) =>
    startTransition(async () => {
      await saveInterests(groups)
      setHidden(true)
      router.refresh()
    })

  if (hidden) return null

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[var(--ink)] text-white" role="dialog" aria-modal="true" aria-labelledby="interests-title">
      <div className="mx-auto flex min-h-full max-w-lg flex-col gap-6 px-6 pb-8 pt-10">
        <div className="space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--gold-bright)]">{t('interestsEyebrow')}</p>
          <h2 id="interests-title" className="font-serif text-3xl font-bold leading-tight">
            {t('interestsTitle')}
          </h2>
          <p className="text-[15px] leading-relaxed text-white/80">{t('interestsText')}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          {choices.map(({ group, examples }) => {
            const on = picked.includes(group)
            return (
              <button
                key={group}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked((list) => (on ? list.filter((g) => g !== group) : [...list, group]))}
                className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                  on ? 'border-[var(--gold)] bg-[#2a2214]' : 'border-white/12 bg-white/[0.06] hover:border-white/30'
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold">{t(`interest_${group}`)}</span>
                  <span className="truncate text-xs text-white/70">{examples}</span>
                </span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    on ? 'bg-[var(--gold)] text-[var(--ink)]' : 'border-2 border-white/30'
                  }`}
                >
                  {on && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => finish(picked)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--gold)] px-4 py-4 text-base font-extrabold text-[var(--ink)] transition hover:brightness-105 disabled:opacity-70"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {picked.length > 0 ? t('interestsCtaCount', { count: picked.length }) : t('interestsCta')}
          </button>
          <button type="button" disabled={isPending} onClick={() => finish([])} className="text-sm font-semibold text-[var(--gold-bright)] hover:text-white">
            {t('interestsSkip')}
          </button>
        </div>
      </div>
    </div>
  )
}
