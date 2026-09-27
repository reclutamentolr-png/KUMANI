import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, Gift, Stamp, Users, CheckCircle2, MonitorSmartphone, Repeat, UserX, Activity } from 'lucide-react'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import FidelitySettingsForm from '@/components/fidelity/FidelitySettingsForm'
import FidelitySettingsPanel from '@/components/fidelity/FidelitySettingsPanel'
import FidelityCustomers from '@/components/fidelity/FidelityCustomers'
import FidelityBarChart from '@/components/fidelity/FidelityBarChart'
import { FIDELITY_LOST_AFTER_DAYS, effectiveStamps, type FidelityCard, type FidelityMember } from '@/lib/fidelity'
import { FIDELITY_STATS_TIMEZONE, FIDELITY_STATS_WEEKS, computeFidelityStats, statsWindowStartIso, type FidelityEventRow } from '@/lib/fidelity-stats'

const CARD_COLUMNS =
  'id, owner_id, business_name, prize, stamps_needed, min_hours_between_stamps, stamps_expire_days, review_url, close_to_prize_percent, is_active, created_at'
const MEMBER_COLUMNS =
  'id, card_id, member_code, stamps_count, total_stamps, rewards_redeemed, last_stamp_at, customer_name, contact_phone, marketing_consent, review_bonus_at, last_contacted_at, created_at'

// Gestione della Kumi Card del commerciante: creazione/impostazioni,
// modalità cassa, statistiche e clienti (chi è vicino al premio in cima).
export default async function FidelityManagePage() {
  const t = await getTranslations('fidelity')
  const commonT = await getTranslations('common')
  const locale = await getLocale()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await hasActiveToolAccess(supabase, user.id, 'fidelity'))) redirect('/marketplace')

  const { data: card } = await supabase.from('fidelity_cards').select(CARD_COLUMNS).eq('owner_id', user.id).maybeSingle<FidelityCard>()

  let members: FidelityMember[] = []
  let events: FidelityEventRow[] = []
  if (card) {
    const since = statsWindowStartIso()
    const [{ data: memberRows }, { data: eventRows }] = await Promise.all([
      supabase
        .from('fidelity_members')
        .select(MEMBER_COLUMNS)
        .eq('card_id', card.id)
        .order('stamps_count', { ascending: false })
        .order('last_stamp_at', { ascending: false, nullsFirst: false })
        .limit(1000)
        .returns<FidelityMember[]>(),
      supabase
        .from('fidelity_events')
        .select('member_id, kind, quantity, created_at')
        .eq('card_id', card.id)
        .gte('created_at', since)
        .limit(20000)
        .returns<FidelityEventRow[]>(),
    ])
    members = memberRows ?? []
    events = eventRows ?? []
    // Ordine per timbri effettivi (quelli scaduti contano zero).
    members.sort((a, b) => effectiveStamps(card, b) - effectiveStamps(card, a))
  }

  const stats = computeFidelityStats(events, members)
  const prizesToGive = card ? members.filter((m) => m.stamps_count >= card.stamps_needed).length : 0
  const prizesGiven = members.reduce((sum, m) => sum + m.rewards_redeemed, 0)
  const kpis = [
    { icon: Users, label: t('statCustomers'), value: members.length },
    { icon: Stamp, label: t('statStampsToday'), value: stats.stampsToday },
    { icon: Gift, label: t('statPrizesToGive'), value: prizesToGive },
    { icon: CheckCircle2, label: t('statPrizesGiven'), value: prizesGiven },
    { icon: Activity, label: t('statActive'), value: stats.activeCustomers },
    { icon: Repeat, label: t('statAvgReturn'), value: stats.avgReturnDays == null ? '—' : t('daysValue', { days: stats.avgReturnDays }) },
    { icon: UserX, label: t('statLost', { days: FIDELITY_LOST_AFTER_DAYS }), value: stats.lostCustomers },
  ]

  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  // 2024-01-01 era un lunedì: base per le etichette lun…dom nella lingua dell'utente.
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(Date.UTC(2024, 0, 1 + i))))
  const weekLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const hasActivity = events.some((e) => e.kind === 'stamp')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <Stamp className="h-5 w-5 text-[var(--gold-bright)]" /> {t('title')}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {!card ? (
          <>
            <div className="relative mx-auto max-w-xl overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
              <div className="pointer-events-none absolute -bottom-20 left-10 h-36 w-36 rounded-full border border-[var(--gold)]/15" />
              <div className="relative">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
                  <Stamp className="h-4 w-4" />
                  {t('title')}
                </div>
                <h2 className="text-2xl font-bold sm:text-3xl">{t('createTitle')}</h2>
                <p className="mt-2 text-sm text-white/70 sm:text-base">{t('createDescription')}</p>
              </div>
            </div>
            <div className="mx-auto max-w-xl rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6 shadow-sm sm:p-8">
              <FidelitySettingsForm card={null} />
            </div>
          </>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
              <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
              <div className="relative">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
                  <Stamp className="h-4 w-4" />
                  {t('title')}
                </div>
                <h2 className="break-words text-2xl font-bold sm:text-3xl">{card.business_name}</h2>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] sm:text-base">
                  <Gift className="h-4 w-4 shrink-0" />
                  {t('cardSummary', { stamps: card.stamps_needed, prize: card.prize })}
                </p>
                <div className="mt-6 flex flex-col items-start gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-bold">{t('cassaCtaTitle')}</p>
                    <p className="mt-1 text-sm text-white/70">{t('cassaCtaText')}</p>
                  </div>
                  <Link
                    href={`/f/cassa/${card.id}`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
                  >
                    <MonitorSmartphone className="h-5 w-5" /> {t('openCassa')}
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] p-4">
                  <kpi.icon className="mb-2 h-5 w-5 text-[var(--gold)]" />
                  <p className="text-2xl font-bold text-[var(--ink)]">{kpi.value}</p>
                  <p className="text-xs text-[var(--muted)]">{kpi.label}</p>
                </div>
              ))}
            </div>

            <section className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6">
              <h2 className="text-lg font-bold text-[var(--ink)]">{t('statsTitle')}</h2>
              <p className="mb-4 text-xs text-[var(--muted)]">{t('statsTimezoneNote', { tz: FIDELITY_STATS_TIMEZONE })}</p>
              {!hasActivity ? (
                <p className="text-sm text-[var(--muted)]">{t('statsEmpty')}</p>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-[var(--ink)]">{t('chartWeekly', { weeks: FIDELITY_STATS_WEEKS })}</p>
                    <FidelityBarChart data={stats.weekly.map((w) => ({ label: weekLabel.format(new Date(`${w.weekStart}T00:00:00Z`)), value: w.stamps }))} />
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-[var(--ink)]">{t('chartWeekday')}</p>
                      <FidelityBarChart highlightMax data={stats.byWeekday.map((value, i) => ({ label: weekdayLabels[i], value }))} />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-[var(--ink)]">{t('chartHour')}</p>
                      <FidelityBarChart
                        highlightMax
                        data={stats.byHour.slice(6, 24).map((value, i) => ({ label: String(i + 6), value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6">
              <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t('settingsTitle')}</h2>
              <FidelitySettingsPanel card={card} customersCount={members.length} />
            </section>

            <section className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6">
              <h2 className="text-lg font-bold text-[var(--ink)]">{t('customersTitle')}</h2>
              <p className="mb-4 text-sm text-[var(--muted)]">{t('customersDescription')}</p>
              <FidelityCustomers card={card} members={members} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
