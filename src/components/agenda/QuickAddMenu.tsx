'use client'

import { useTranslations } from 'next-intl'
import { CalendarClock, CheckCircle2, FileBadge, Lock, Receipt, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import type { AgendaSources } from '@/lib/agenda-server'

// "+ Aggiungi": chiede COSA si vuole aggiungere e porta nello strumento giusto,
// così non ci si chiede più dove inserire una bolletta o una scadenza.
export default function QuickAddMenu({ sources, onClose }: { sources: AgendaSources; onClose: () => void }) {
  const t = useTranslations('agenda')
  const options = [
    { key: 'appointment', icon: CalendarClock, color: 'bg-sky-500', href: '/marketplace/memolife?add=appointment', enabled: sources.memolife },
    { key: 'task', icon: CheckCircle2, color: 'bg-violet-500', href: '/marketplace/memolife?add=task', enabled: sources.memolife },
    { key: 'bill', icon: Receipt, color: 'bg-amber-500', href: '/marketplace/spendly/bollette?new=1', enabled: sources.spendly },
    { key: 'deadline', icon: FileBadge, color: 'bg-rose-500', href: '/marketplace/life-calendar/new', enabled: sources.lifeCalendar },
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('addWhat')}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100" aria-label={t('close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-2">
          {options.map(({ key, icon: Icon, color, href, enabled }) =>
            enabled ? (
              <Link key={key} href={href} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 hover:border-[var(--gold)] hover:bg-[var(--gold-pale)]/40">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${color}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold text-[var(--ink)]">{t(`add_${key}`)}</span>
                  <span className="block text-xs text-[var(--muted)]">{t(`add_${key}_hint`)}</span>
                </span>
              </Link>
            ) : (
              <div key={key} className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 p-3 opacity-60">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-300 text-white">
                  <Lock className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold text-[var(--ink)]">{t(`add_${key}`)}</span>
                  <span className="block text-xs text-[var(--muted)]">{t('needsSubscription')}</span>
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
