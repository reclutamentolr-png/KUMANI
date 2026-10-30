import { getTranslations } from 'next-intl/server'
import { Crown, Gift } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { bonusReason, SURPRISE_KINDS, type SurpriseKind, type SurprisePlanStatus } from '@/lib/surprise'

// Sorprese incluse nel piano: per chi ha Plus o Pro quante ne restano per tipo
// e i regali del momento; per chi non ha un piano, cosa otterrebbe.
// Solo i tipi accesi dall'Admin (kinds): gli altri non si mostrano.
export const BONUS_KEY: Record<string, string> = {
  rinnovo: 'bonus_renewal',
  natale: 'bonus_christmas',
  mamma: 'bonus_mother',
  papa: 'bonus_father',
  'san-valentino': 'bonus_valentine',
}

export default async function SurprisePlanSummary({ status, kinds }: { status: SurprisePlanStatus; kinds: SurpriseKind[] }) {
  const t = await getTranslations('surprise')

  if (status.plan === 'none')
    return (
      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--gold)]/40 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <Crown className="h-6 w-6 shrink-0 text-[var(--gold)]" />
        <p className="flex-1 text-sm text-gray-700">{t(kinds.includes('journey3') ? 'planTeaser' : 'planTeaserVoucher')}</p>
        <Link href="/billing" className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-center text-sm font-bold text-white">
          {t('planTeaserCta')}
        </Link>
      </div>
    )

  const bonus = status.bonus.filter((b) => kinds.includes(b.kind))
  const lines = SURPRISE_KINDS.filter((kind) => kinds.includes(kind)).flatMap((kind) => {
    const q = status.quota[kind]
    return q && q.total > 0 ? [{ kind, q }] : []
  })
  if (!lines.length && !bonus.length) return null

  return (
    <section className="mt-5 rounded-2xl border-2 border-[var(--gold)]/50 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
        <Crown className="h-5 w-5 text-[var(--gold)]" /> {t('planTitle', { plan: t(status.plan === 'pro' ? 'planPro' : 'planBase') })}
      </h2>
      {lines.length > 0 && (
        <ul className={`mt-3 grid gap-2 ${lines.length === 1 ? '' : lines.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {lines.map(({ kind, q }) => (
            <li key={kind} className={`rounded-xl px-3 py-2 text-sm ${q.left > 0 ? 'bg-[var(--gold)]/10 text-[var(--ink)]' : 'bg-gray-50 text-gray-500'}`}>
              <span className="font-bold">{t(`kind_${kind}`)}</span>
              <br />
              {t('planLeft', { left: q.left, total: q.total })} {t(`period_${q.months}`)}
            </li>
          ))}
        </ul>
      )}
      {bonus.map((b) => (
        <p key={b.key} className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <Gift className="h-4 w-4 shrink-0" /> {t(BONUS_KEY[bonusReason(b)] ?? 'bonus_renewal')}
        </p>
      ))}
      <p className="mt-3 text-xs text-gray-500">{t('planHow')}</p>
    </section>
  )
}
