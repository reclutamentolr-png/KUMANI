'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarPlus, Captions, Hash, LoaderCircle, Sparkles, Trash2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { deleteDiariumPlan, generateDiariumPlan, setDiariumPostDone } from '@/app/actions/diarium'
import { addDays, todayKey } from '@/lib/agenda'
import { DIARIUM_NETWORKS, DIARIUM_PER_WEEK, DIARIUM_TONES, FORMAT_EMOJI, type DiariumPlan, type DiariumRequest } from '@/lib/diarium'

type Prefs = Omit<DiariumRequest, 'startDate'>
const PREFS_KEY = 'kumani:diarium:prefs'
const DEFAULT_PREFS: Prefs = { business: '', place: '', focus: '', networks: ['instagram'], perWeek: 3, tone: 'friendly' }

function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null
    if (!raw) return DEFAULT_PREFS
    const networks = (Array.isArray(raw.networks) ? raw.networks : []).filter((n) => DIARIUM_NETWORKS.includes(n))
    return {
      business: typeof raw.business === 'string' ? raw.business.slice(0, 300) : '',
      place: typeof raw.place === 'string' ? raw.place.slice(0, 80) : '',
      focus: typeof raw.focus === 'string' ? raw.focus.slice(0, 600) : '',
      networks: networks.length ? networks : DEFAULT_PREFS.networks,
      perWeek: raw.perWeek && DIARIUM_PER_WEEK.includes(raw.perWeek) ? raw.perWeek : 3,
      tone: raw.tone && DIARIUM_TONES.includes(raw.tone) ? raw.tone : 'friendly',
    }
  } catch {
    return DEFAULT_PREFS
  }
}

// KUMANI DIARIUM: 30 giorni di post. Il modulo (attività, zona, social, quanti
// post a settimana) e il piano diviso per settimane; da ogni post si apre
// CAPTIO per la didascalia o LUMEN per il copione dei reel.
// I pulsanti verso CAPTIO e LUMEN solo se quei servizi sono accesi
export default function DiariumApp({ initialPlans, captioOn = true, lumenOn = true }: { initialPlans: DiariumPlan[]; captioOn?: boolean; lumenOn?: boolean }) {
  const t = useTranslations('diarium')
  const locale = useLocale()
  const today = todayKey()
  const [plans, setPlans] = useState(initialPlans)
  const [planId, setPlanId] = useState<string | null>(initialPlans[0]?.id ?? null)
  const [creating, setCreating] = useState(initialPlans.length === 0)
  const [prefs, setPrefs] = useState<Prefs>(readPrefs)
  const [startDate, setStartDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setPref = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch }
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch {
        // facoltativo
      }
      return next
    })

  const plan = plans.find((p) => p.id === planId) ?? null
  const weeks = useMemo(() => {
    if (!plan) return []
    const out: { from: string; to: string; posts: DiariumPlan['posts'] }[] = []
    for (let w = 0; w < 5; w++) {
      const from = addDays(plan.start_date, w * 7)
      const to = addDays(from, 6)
      const posts = plan.posts.filter((p) => p.post_date >= from && p.post_date <= to)
      if (posts.length) out.push({ from, to, posts })
    }
    return out
  }, [plan])
  const doneCount = plan?.posts.filter((p) => p.done).length ?? 0

  const submit = async () => {
    setBusy(true)
    setError(null)
    const r = await generateDiariumPlan({ ...prefs, startDate }, locale)
    setBusy(false)
    if (!r.success) return setError(t(`error_${r.message}` as 'error_aiError'))
    setPlans((list) => [r.data, ...list])
    setPlanId(r.data.id)
    setCreating(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggle = async (postId: string, done: boolean) => {
    setPlans((list) => list.map((p) => ({ ...p, posts: p.posts.map((x) => (x.id === postId ? { ...x, done } : x)) })))
    if (!(await setDiariumPostDone(postId, done))) setPlans((list) => list.map((p) => ({ ...p, posts: p.posts.map((x) => (x.id === postId ? { ...x, done: !done } : x)) })))
  }

  const remove = async () => {
    if (!plan || !window.confirm(t('deleteConfirm'))) return
    if (!(await deleteDiariumPlan(plan.id))) return
    const rest = plans.filter((p) => p.id !== plan.id)
    setPlans(rest)
    setPlanId(rest[0]?.id ?? null)
    if (!rest.length) setCreating(true)
  }

  const day = (key: string, opts: Intl.DateTimeFormatOptions) => new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' })
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 text-gray-600 hover:border-[var(--gold)]/60'}`
  const field = 'mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none'

  return (
    <div className="space-y-4">
      {plans.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {plans.length > 1 && !creating && (
            <select value={planId ?? ''} onChange={(e) => setPlanId(e.target.value)} aria-label={t('choosePlan')} className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold">
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {day(p.start_date, { day: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-white px-4 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold)]/10"
          >
            <CalendarPlus className="h-4 w-4 text-[var(--gold)]" /> {creating ? t('backToPlan') : t('newPlan')}
          </button>
        </div>
      )}

      {creating ? (
        <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
          <h3 className="font-bold text-[var(--ink)]">{t('formTitle')}</h3>
          <label className="mt-3 block text-sm font-semibold text-[var(--ink)]">
            {t('business')}
            <input value={prefs.business} onChange={(e) => setPref({ business: e.target.value.slice(0, 300) })} placeholder={t('businessPlaceholder')} className={field} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[var(--ink)]">
              {t('place')}
              <input value={prefs.place} onChange={(e) => setPref({ place: e.target.value.slice(0, 80) })} placeholder={t('placePlaceholder')} className={field} />
            </label>
            <label className="block text-sm font-semibold text-[var(--ink)]">
              {t('startDate')}
              <input type="date" value={startDate} min={today} max={addDays(today, 60)} onChange={(e) => setStartDate(e.target.value || today)} className={field} />
            </label>
          </div>
          <label className="mt-3 block text-sm font-semibold text-[var(--ink)]">
            {t('focus')}
            <textarea value={prefs.focus} onChange={(e) => setPref({ focus: e.target.value.slice(0, 600) })} rows={2} placeholder={t('focusPlaceholder')} className={field} />
          </label>

          <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('networks')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIARIUM_NETWORKS.map((n) => {
              const on = prefs.networks.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPref({ networks: on ? prefs.networks.filter((x) => x !== n) : [...prefs.networks, n] })}
                  className={chip(on)}
                >
                  {t(`network_${n}`)}
                </button>
              )
            })}
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('perWeek')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIARIUM_PER_WEEK.map((n) => (
              <button key={n} type="button" aria-pressed={prefs.perWeek === n} onClick={() => setPref({ perWeek: n })} className={chip(prefs.perWeek === n)}>
                {t('perWeekValue', { n })}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('tone')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIARIUM_TONES.map((tone) => (
              <button key={tone} type="button" aria-pressed={prefs.tone === tone} onClick={() => setPref({ tone })} className={chip(prefs.tone === tone)}>
                {t(`tone_${tone}`)}
              </button>
            ))}
          </div>

          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={busy || prefs.business.trim().length < 3 || !prefs.networks.length}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 text-base font-extrabold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)] disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {busy ? t('writing') : t('generate')}
          </button>
          {busy && <p className="mt-2 text-center text-xs text-[var(--muted)]">{t('writingHint')}</p>}
        </section>
      ) : plan ? (
        <>
          <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-extrabold text-[var(--ink)]">{plan.title}</h3>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {t('period', { from: day(plan.start_date, { day: 'numeric', month: 'long' }), to: day(addDays(plan.start_date, 29), { day: 'numeric', month: 'long' }) })}
                </p>
              </div>
              <button type="button" onClick={remove} aria-label={t('delete')} title={t('delete')} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${plan.posts.length ? (doneCount / plan.posts.length) * 100 : 0}%` }} />
            </div>
            <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{t('progress', { done: doneCount, total: plan.posts.length })}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">{t('agendaNote')}</p>
          </section>

          {weeks.map((w, i) => (
            <section key={w.from} className="space-y-2">
              <h4 className="px-1 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {t('week', { n: i + 1 })} · {day(w.from, { day: 'numeric', month: 'short' })} – {day(w.to, { day: 'numeric', month: 'short' })}
              </h4>
              {w.posts.map((p) => {
                const isToday = p.post_date === today
                const brief = `${p.title}. ${p.idea}`
                return (
                  <article key={p.id} className={`rounded-2xl border bg-white p-4 ${isToday ? 'border-[var(--gold)] shadow-[0_0_0_3px_rgba(199,154,59,0.18)]' : 'border-[var(--gold)]/20'} ${p.done ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={p.done} onChange={(e) => toggle(p.id, e.target.checked)} aria-label={t('markDone')} className="mt-1 h-5 w-5 shrink-0 accent-[var(--gold)]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                          {isToday ? t('today') : day(p.post_date, { weekday: 'short', day: 'numeric', month: 'short' })} · {t(`network_${p.network}`)} · {FORMAT_EMOJI[p.format]} {t(`format_${p.format}`)}
                        </p>
                        <p className={`mt-1 font-bold text-[var(--ink)] ${p.done ? 'line-through' : ''}`}>{p.title}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{p.idea}</p>
                        {p.hook && <p className="mt-2 rounded-lg bg-[var(--gold)]/10 px-3 py-2 text-sm italic text-[var(--ink)]">«{p.hook}»</p>}
                        {!p.done && (captioOn || (lumenOn && p.format === 'reel')) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {captioOn && (
                            <Link
                              href={`/app/captio?d=${encodeURIComponent(brief)}&n=${p.network}`}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 text-xs font-bold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]"
                            >
                              <Hash className="h-3.5 w-3.5" /> {t('writeCaption')}
                            </Link>
                            )}
                            {lumenOn && p.format === 'reel' && (
                              <Link
                                href={`/app/lumen?topic=${encodeURIComponent(`${brief} ${p.hook}`)}`}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--gold)]/50 px-3 text-xs font-bold text-[var(--ink)] hover:bg-[var(--gold)]/10"
                              >
                                <Captions className="h-3.5 w-3.5 text-[var(--gold)]" /> {t('writeScript')}
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </section>
          ))}
        </>
      ) : null}
    </div>
  )
}
