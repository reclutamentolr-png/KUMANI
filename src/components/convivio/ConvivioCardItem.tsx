'use client'

import { useLocale, useTranslations } from 'next-intl'
import { BadgeCheck, Clock, MapPin, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { formatEuro, savingPercent, type ConvivioCard } from '@/lib/convivio'

export const STATUS_STYLE: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-800',
  awaiting_supplier: 'bg-amber-100 text-amber-800',
  declined: 'bg-red-100 text-red-700',
  reached: 'bg-[var(--gold-pale)] text-[var(--ink)]',
  ordered: 'bg-[var(--ink)] text-[var(--gold-bright)]',
  completed: 'bg-gray-100 text-gray-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
}

export function ProgressBar({ people, min, max }: { people: number; min: number; max: number | null }) {
  const target = max ?? min
  const percent = Math.min(100, Math.round((people / Math.max(target, 1)) * 100))
  const minMark = max ? Math.round((min / max) * 100) : 100
  return (
    <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--gold-pale)]">
      <div className={`h-full rounded-full ${people >= min ? 'bg-emerald-500' : 'bg-[var(--gold)]'}`} style={{ width: `${percent}%` }} />
      {max && <span className="absolute top-0 h-full w-0.5 bg-[var(--ink)]/40" style={{ left: `${minMark}%` }} />}
    </div>
  )
}

// Scheda di una cordata nella lista.
export default function ConvivioCardItem({ card, now }: { card: ConvivioCard; now: number }) {
  const t = useTranslations('convivio')
  const locale = useLocale()
  const saving = savingPercent(card)
  const ms = new Date(card.expires_at).getTime() - now
  const hours = Math.floor(ms / 3600000)
  const left = ms <= 0 ? t('expired') : hours < 24 ? t('hoursLeft', { count: Math.max(1, hours) }) : t('daysLeft', { count: Math.ceil(hours / 24) })

  return (
    <Link
      href={`/marketplace/convivio/${card.id}`}
      className="group flex flex-col rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]/60 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">{t(`category_${card.category}`)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[card.status]}`}>{t(`status_${card.status}`)}</span>
      </div>
      <p className="font-bold leading-snug text-[var(--ink)]">{card.title}</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        {card.supplier_kumani && card.supplier_status === 'confirmed' && <BadgeCheck className="mr-0.5 inline h-3.5 w-3.5 text-[var(--gold)]" />}
        {card.supplier_name}
        {card.city ? (
          <>
            {' '}
            · <MapPin className="inline h-3 w-3" /> {card.city}
          </>
        ) : null}
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-xl font-bold text-[var(--ink)]">{formatEuro(card.group_price, locale)}</span>
        {card.unit_label && <span className="text-xs text-[var(--muted)]">/ {card.unit_label}</span>}
        {card.retail_price && saving ? (
          <>
            <span className="text-xs text-gray-400 line-through">{formatEuro(card.retail_price, locale)}</span>
            <span className="rounded bg-emerald-100 px-1.5 text-xs font-bold text-emerald-700">-{saving}%</span>
          </>
        ) : null}
      </div>
      <div className="mt-3">
        <ProgressBar people={card.people} min={card.min_participants} max={card.max_participants} />
        <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {t('peopleOfMin', { people: card.people, min: card.min_participants })}
          </span>
          {card.status === 'open' && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {left}
            </span>
          )}
        </div>
      </div>
      {(card.is_leader || card.is_supplier || card.my_quantity) && (
        <p className="mt-3 text-xs font-semibold text-[var(--gold)]">
          {card.is_supplier ? t('youAreSupplier') : card.is_leader ? t('youAreLeader') : t('youJoined', { quantity: card.my_quantity ?? 1 })}
        </p>
      )}
    </Link>
  )
}
