'use client'

import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, Circle, Percent, Trophy, Users } from 'lucide-react'
import type { OrganizerLevel, OrganizerStatus } from '@/lib/events'
import { LevelBadge, Stars, formatRating } from './EventBadges'

// Regole dei livelli (le stesse di event_organizer_stats in SQL):
// Fidato = ≥2 eventi conclusi e (meno di 3 recensioni o media ≥4,5)
// Super  = ≥10 eventi conclusi, ≥10 recensioni, media ≥4,8
// Declassamento a Nuovo: evento bloccato negli ultimi 180 giorni, oppure
// almeno 5 recensioni con media sotto 3,5.
const TRUSTED_EVENTS = 2
const TRUSTED_MIN_AVG = 4.5
const TRUSTED_AVG_FROM_REVIEWS = 3
const SUPER_EVENTS = 10
const SUPER_REVIEWS = 10
const SUPER_MIN_AVG = 4.8
const DECAY_REVIEWS = 5
const DECAY_AVG = 3.5

type Step = { key: string; label: string; done: boolean; progress?: number }

// "La tua reputazione": livello, media, eventi conclusi, cosa manca al
// livello successivo, posti massimi e commissione.
export default function OrganizerReputation({ status }: { status: OrganizerStatus }) {
  const t = useTranslations('eventsOrganizer')
  const locale = useLocale()

  const level: OrganizerLevel = status.level ?? (status.trusted ? 'trusted' : 'new')
  const concluded = Number(status.concluded ?? 0)
  const reviews = Number(status.reviews ?? 0)
  const avg = status.avg_rating != null ? Number(status.avg_rating) : null
  const maxCapacity = status.max_capacity ?? (level === 'super' ? 300 : level === 'trusted' ? 100 : 20)
  const bannedRecent = Number(status.banned_recent ?? 0) > 0
  const lowRating = reviews >= DECAY_REVIEWS && avg !== null && avg < DECAY_AVG
  const decayed = bannedRecent || lowRating
  const fmt = (value: number) => formatRating(value, locale)

  // Requisiti per il livello successivo
  let nextLevel: OrganizerLevel | null = null
  let steps: Step[] = []
  if (level === 'new') {
    nextLevel = 'trusted'
    steps = [
      {
        key: 'events',
        label: t('progressEvents', { done: Math.min(concluded, TRUSTED_EVENTS), target: TRUSTED_EVENTS }),
        done: concluded >= TRUSTED_EVENTS,
        progress: Math.min(1, concluded / TRUSTED_EVENTS),
      },
      {
        key: 'avg',
        label:
          reviews < TRUSTED_AVG_FROM_REVIEWS
            ? t('progressAvgTrustedFew', { min: fmt(TRUSTED_MIN_AVG), from: TRUSTED_AVG_FROM_REVIEWS })
            : t('progressAvg', { min: fmt(TRUSTED_MIN_AVG), avg: avg !== null ? fmt(avg) : '—' }),
        done: reviews < TRUSTED_AVG_FROM_REVIEWS || (avg !== null && avg >= TRUSTED_MIN_AVG),
      },
    ]
    if (decayed) steps.push({ key: 'decay', label: t('progressNoDecay'), done: false })
  } else if (level === 'trusted') {
    nextLevel = 'super'
    steps = [
      {
        key: 'events',
        label: t('progressEvents', { done: Math.min(concluded, SUPER_EVENTS), target: SUPER_EVENTS }),
        done: concluded >= SUPER_EVENTS,
        progress: Math.min(1, concluded / SUPER_EVENTS),
      },
      {
        key: 'reviews',
        label: t('progressReviews', { done: Math.min(reviews, SUPER_REVIEWS), target: SUPER_REVIEWS }),
        done: reviews >= SUPER_REVIEWS,
        progress: Math.min(1, reviews / SUPER_REVIEWS),
      },
      {
        key: 'avg',
        label: t('progressAvg', { min: fmt(SUPER_MIN_AVG), avg: avg !== null ? fmt(avg) : '—' }),
        done: avg !== null && avg >= SUPER_MIN_AVG,
      },
    ]
  }

  return (
    <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
        <Trophy className="h-5 w-5 text-[var(--gold)]" /> {t('reputationTitle')}
      </h2>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
        {/* Dove sei ora */}
        <div
          className={`rounded-2xl p-4 ${
            level === 'super' ? 'bg-[var(--ink)] text-white ring-1 ring-[var(--gold)]/60' : 'bg-[var(--gold-pale)]/40 text-[var(--ink)]'
          }`}
        >
          <LevelBadge level={level} showNew dark={level === 'super'} />
          <div className="mt-3 flex items-center gap-2">
            {avg !== null && reviews > 0 ? (
              <>
                <span className="text-3xl font-extrabold">{fmt(avg)}</span>
                <span className="flex flex-col">
                  <Stars rating={avg} />
                  <span className={`text-xs ${level === 'super' ? 'text-white/70' : 'text-[var(--muted)]'}`}>{t('reputationReviews', { count: reviews })}</span>
                </span>
              </>
            ) : (
              <span className={`text-sm ${level === 'super' ? 'text-white/70' : 'text-[var(--muted)]'}`}>{t('reputationNoReviews')}</span>
            )}
          </div>
          <p className={`mt-2 text-sm font-semibold ${level === 'super' ? 'text-white/85' : 'text-[var(--ink-soft)]'}`}>
            {t('reputationConcluded', { count: concluded })}
          </p>
          <div className={`mt-3 space-y-1 border-t pt-3 text-xs ${level === 'super' ? 'border-white/15 text-white/80' : 'border-[var(--gold)]/20 text-[var(--ink-soft)]'}`}>
            <p className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" /> {t('reputationMaxSeats', { max: maxCapacity })}
            </p>
            <p className="flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />
              {level === 'super' ? t('reputationFeeReduced', { percent: status.fee_percent }) : t('reputationFee', { percent: status.fee_percent })}
            </p>
            <p>{level === 'new' ? t('reputationApprovalNeeded') : t('reputationApprovalNotNeeded')}</p>
          </div>
        </div>

        {/* Prossimo livello */}
        <div className="space-y-3">
          {decayed && (
            <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{bannedRecent ? t('reputationDecayedBanned') : t('reputationDecayedRating', { min: fmt(DECAY_AVG) })}</span>
            </p>
          )}
          {nextLevel ? (
            <>
              <p className="text-sm font-bold text-[var(--ink)]">
                {t('nextLevelTitle', { level: t(`level_${nextLevel}`) })}
              </p>
              <ul className="space-y-2.5">
                {steps.map((step) => (
                  <li key={step.key} className="text-sm">
                    <p className={`flex items-start gap-2 ${step.done ? 'text-emerald-700' : 'text-[var(--ink-soft)]'}`}>
                      {step.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />}
                      <span>{step.label}</span>
                    </p>
                    {step.progress !== undefined && !step.done && (
                      <div className="ml-6 mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" style={{ width: `${Math.round(step.progress * 100)}%` }} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {nextLevel === 'super' && <p className="text-xs text-[var(--muted)]">{t('nextLevelSuperPerks', { max: 300 })}</p>}
              {nextLevel === 'trusted' && <p className="text-xs text-[var(--muted)]">{t('nextLevelTrustedPerks', { max: 100 })}</p>}
            </>
          ) : (
            <p className="rounded-xl bg-[var(--gold-pale)]/50 px-3 py-2 text-sm font-semibold text-[var(--ink)]">{t('reputationTopLevel', { min: fmt(SUPER_MIN_AVG) })}</p>
          )}
          <p className="text-xs leading-5 text-[var(--muted)]">
            {t('reputationDecayNote', { reviews: DECAY_REVIEWS, min: fmt(DECAY_AVG) })}
          </p>
        </div>
      </div>
    </section>
  )
}
