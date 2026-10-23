'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BellRing, BookOpen, CalendarPlus, Clock3, LoaderCircle, Moon, Pencil, Plane, ShieldCheck, Stethoscope, Trash2, Workflow } from 'lucide-react'
import { deleteCronobiomaData, deleteCronobiomaNight, logCronobiomaNight, saveCronobiomaProfile, type CronobiomaProfile } from '@/app/actions/cronobioma'
import { askConfirm } from '@/lib/confirm'
import {
  buildIcs,
  cleanAnswers,
  computeChrono,
  dayPlan,
  fmt,
  JETLAG_ZONES,
  jetlagPlan,
  norm,
  QUIZ_STORAGE_KEY,
  SHIFT_PRESETS,
  shiftPlan,
  span,
  toMinutes,
  weekStats,
  type QuizAnswers,
  type ShiftPreset,
  type SleepLog,
} from '@/lib/cronobioma'
import CronobiomaQuiz from './CronobiomaQuiz'
import ChronoResult, { useDuration } from './ChronoResult'
import ChronoShare from './ChronoShare'

type Tab = 'clock' | 'diary' | 'shifts' | 'travel' | 'reminders'
const TABS: { key: Tab; Icon: typeof Clock3 }[] = [
  { key: 'clock', Icon: Clock3 },
  { key: 'diary', Icon: BookOpen },
  { key: 'shifts', Icon: Workflow },
  { key: 'travel', Icon: Plane },
  { key: 'reminders', Icon: BellRing },
]

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 sm:p-6'
const timeField = 'mt-1 block w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-lg font-bold text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none'
const primary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 font-extrabold text-[var(--ink)] shadow-md hover:brightness-105 disabled:opacity-50'
const chipClass = (on: boolean) =>
  `min-h-11 rounded-xl border-2 px-3 py-2 text-sm font-semibold ${on ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 bg-white text-gray-600 hover:border-[var(--gold)]/60'}`

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// KUMANI CRONOBIOMA (piano Plus): l'orologio completo, il diario del sonno,
// i piani per turni e fuso orario, i promemoria nel calendario del telefono.
export default function CronobiomaApp({ initialProfile, initialLogs, shareUrl }: { initialProfile: CronobiomaProfile | null; initialLogs: SleepLog[]; shareUrl: string }) {
  const t = useTranslations('cronobioma')
  const [tab, setTab] = useState<Tab>('clock')
  const [profile, setProfile] = useState(initialProfile)
  const [logs, setLogs] = useState(initialLogs)
  const [now, setNow] = useState<number | null>(null)

  // L'ora di adesso sul quadrante (solo nel browser)
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setNow(d.getHours() * 60 + d.getMinutes())
    }
    tick()
    const id = window.setInterval(tick, 60000)
    return () => window.clearInterval(id)
  }, [])

  const result = useMemo(() => (profile ? computeChrono(profile.answers) : null), [profile])
  const plan = useMemo(() => (profile && result ? dayPlan(result, toMinutes(profile.wake_time) ?? result.naturalWake, profile.sleep_need) : null), [profile, result])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-1 rounded-2xl border border-[var(--gold)]/25 bg-white p-1.5">
        {TABS.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10.5px] font-bold leading-tight sm:flex-row sm:gap-1.5 sm:text-sm ${tab === key ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'text-[var(--ink)] hover:bg-[var(--gold-pale)]'}`}
          >
            <Icon className="h-4 w-4 shrink-0" /> <span className="max-w-full text-center [overflow-wrap:anywhere] [hyphens:auto]">{t(`tab_${key}`)}</span>
          </button>
        ))}
      </div>

      {tab === 'clock' && <ClockTab profile={profile} onSaved={setProfile} onDeleted={() => { setProfile(null); setLogs([]) }} result={result} plan={plan} now={now} shareUrl={shareUrl} />}
      {tab === 'diary' && (profile ? <DiaryTab logs={logs} setLogs={setLogs} plan={plan} sleepNeed={profile.sleep_need} /> : <NeedProfile onGo={() => setTab('clock')} />)}
      {tab === 'shifts' && <ShiftsTab />}
      {tab === 'travel' && <TravelTab answers={profile?.answers ?? null} />}
      {tab === 'reminders' && (plan ? <RemindersTab plan={plan} /> : <NeedProfile onGo={() => setTab('clock')} />)}

      <div className="space-y-2 rounded-2xl bg-white/70 p-4 text-sm text-[var(--muted)]">
        <p className="flex items-start gap-2">
          <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('doctorNote')}
        </p>
        <p>{t('disclaimer')}</p>
      </div>
    </div>
  )
}

function NeedProfile({ onGo }: { onGo: () => void }) {
  const t = useTranslations('cronobioma')
  return (
    <div className={`${card} text-center`}>
      <Moon className="mx-auto h-8 w-8 text-[var(--gold)]" />
      <p className="mt-2 font-bold text-[var(--ink)]">{t('startTitle')}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('startText')}</p>
      <button type="button" onClick={onGo} className={`${primary} mt-4`}>
        {t('tab_clock')}
      </button>
    </div>
  )
}

// ------------------------------------------------------------------ Orologio

function ClockTab({
  profile,
  onSaved,
  onDeleted,
  result,
  plan,
  now,
  shareUrl,
}: {
  profile: CronobiomaProfile | null
  onSaved: (p: CronobiomaProfile) => void
  onDeleted: () => void
  result: ReturnType<typeof computeChrono> | null
  plan: ReturnType<typeof dayPlan> | null
  now: number | null
  shareUrl: string
}) {
  const t = useTranslations('cronobioma')
  const dur = useDuration()
  const [draft, setDraft] = useState<QuizAnswers | null>(null)
  const [quiz, setQuiz] = useState(false)
  const [stored, setStored] = useState<QuizAnswers | null>(null)
  const [wake, setWake] = useState(profile?.wake_time ?? '07:00')
  const [need, setNeed] = useState(profile?.sleep_need ?? 480)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Il test pubblico fatto prima di iscriversi, su questo dispositivo
  useEffect(() => {
    if (profile) return
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- si legge una volta sola dal browser
      setStored(cleanAnswers(JSON.parse(localStorage.getItem(QUIZ_STORAGE_KEY) ?? 'null')?.answers))
    } catch {
      // facoltativo
    }
  }, [profile])

  const answers = draft ?? profile?.answers ?? null
  const pick = (a: QuizAnswers) => {
    setDraft(a)
    setQuiz(false)
    if (!profile) setWake(a.workDays > 0 ? a.workWake : a.freeWake)
  }

  const save = async () => {
    if (!answers) return
    setBusy(true)
    setError(null)
    const r = await saveCronobiomaProfile({ answers, wakeTime: wake, sleepNeed: need, consent })
    setBusy(false)
    if (!r.success) return setError(t(`error_${r.message}` as 'error_saveError'))
    setDraft(null)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
    onSaved(r.data)
  }

  const removeAll = async () => {
    if (!(await askConfirm(t('deleteAllConfirm'), { tone: 'danger' }))) return
    const r = await deleteCronobiomaData()
    if (!r.success) return setError(t('error_deleteError'))
    try {
      localStorage.removeItem(QUIZ_STORAGE_KEY)
    } catch {
      // facoltativo
    }
    onDeleted()
  }

  // Il questionario (primo accesso o «Cambia le risposte»)
  if (quiz || !answers) {
    return (
      <div className="space-y-4">
        {!answers && (
          <div className={card}>
            <p className="text-lg font-extrabold text-[var(--ink)]">{t('startTitle')}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('startText')}</p>
            {stored && (
              <button type="button" onClick={() => pick(stored)} className={`${primary} mt-4 w-full`}>
                {t('importQuiz')}
              </button>
            )}
          </div>
        )}
        <CronobiomaQuiz initial={answers} onDone={pick} />
      </div>
    )
  }

  const preview = computeChrono(answers)
  const previewPlan = dayPlan(preview, toMinutes(wake) ?? preview.naturalWake, need)
  const dirty = !profile || !!draft || wake !== profile.wake_time || need !== profile.sleep_need

  return (
    <div className="space-y-5">
      <ChronoResult result={preview} plan={previewPlan} now={profile && !dirty ? now : null} />

      {/* Ora del risveglio e ore di sonno */}
      <div className={card}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {t('wakeSetting')}
            <input type="time" value={wake} onChange={(e) => e.target.value && setWake(e.target.value)} className={timeField} />
          </label>
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">{t('sleepNeedSetting')}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {[420, 450, 480, 510, 540].map((m) => (
                <button key={m} type="button" onClick={() => setNeed(m)} aria-pressed={need === m} className={chipClass(need === m)}>
                  {dur(m)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {!profile && (
          <div className="mt-5 rounded-2xl border-2 border-[var(--gold)]/40 bg-[var(--gold-pale)] p-4">
            <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
              <ShieldCheck className="h-5 w-5 text-[var(--gold)]" /> {t('consentTitle')}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{t('consentText')}</p>
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm font-semibold text-[var(--ink)]">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--gold)]" />
              {t('consentCheck')}
            </label>
          </div>
        )}
        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={save} disabled={busy || !dirty || (!profile && !consent)} className={`${primary} flex-1`}>
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
            {busy ? t('saving') : saved ? t('saved') : t('save')}
          </button>
          <button type="button" onClick={() => setQuiz(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-white px-5 font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
            <Pencil className="h-4 w-4" /> {t('editAnswers')}
          </button>
        </div>
      </div>

      {profile && result && plan && <ChronoShare result={result} plan={plan} shareUrl={shareUrl} />}

      {profile && (
        <button type="button" onClick={removeAll} className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:underline">
          <Trash2 className="h-4 w-4" /> {t('deleteAll')}
        </button>
      )}
    </div>
  )
}

// -------------------------------------------------------------------- Diario

function DiaryTab({ logs, setLogs, plan, sleepNeed }: { logs: SleepLog[]; setLogs: (fn: (l: SleepLog[]) => SleepLog[]) => void; plan: ReturnType<typeof dayPlan> | null; sleepNeed: number }) {
  const t = useTranslations('cronobioma')
  const locale = useLocale()
  const dur = useDuration()
  // La notte di ieri (si calcola una volta, all'apertura)
  const [today] = useState(() => isoDay(new Date()))
  const [night, setNight] = useState(() => isoDay(new Date(new Date().getTime() - 86400000)))
  const [bed, setBed] = useState(plan ? fmt(plan.bed) : '23:00')
  const [wake, setWake] = useState(plan ? fmt(plan.wake) : '07:00')
  const [quality, setQuality] = useState<1 | 2 | 3>(2)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const recent = [...logs].sort((a, b) => b.night.localeCompare(a.night))
  const stats = weekStats(recent.slice(0, 7), sleepNeed)
  const dateFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  const nightName = (n: string) => dateFmt.format(new Date(`${n}T12:00:00`))

  const save = async () => {
    setBusy(true)
    setMsg(null)
    const r = await logCronobiomaNight({ night, bed, wake, quality })
    setBusy(false)
    if (!r.success) return setMsg({ ok: false, text: t(`error_${r.message}` as 'error_saveError') })
    setLogs((l) => [r.data, ...l.filter((x) => x.night !== r.data.night)])
    setMsg({ ok: true, text: t('logSaved') })
  }

  const remove = async (n: string) => {
    const r = await deleteCronobiomaNight(n)
    if (r.success) setLogs((l) => l.filter((x) => x.night !== n))
  }

  // Grafico delle ultime 14 notti: una barra per notte, dall'ora di andare a
  // letto al risveglio (asse dalle 20 alle 12), colore secondo la qualità
  const chart = recent.slice(0, 14).reverse()
  const y = (m: number) => {
    const fromEight = span(20 * 60, norm(m)) // minuti dalle 20:00
    return Math.min(16 * 60, fromEight)
  }
  const qColor = { 1: '#ef4444', 2: '#f2b134', 3: '#16a34a' } as const

  return (
    <div className="space-y-5">
      <div className={card}>
        <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('diaryTitle')}</h3>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{t('diaryIntro')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {t('nightLabel')}
            <input type="date" value={night} max={today} onChange={(e) => e.target.value && setNight(e.target.value)} className={timeField} />
          </label>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {t('diaryBed')}
            <input type="time" value={bed} onChange={(e) => e.target.value && setBed(e.target.value)} className={timeField} />
          </label>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {t('diaryWake')}
            <input type="time" value={wake} onChange={(e) => e.target.value && setWake(e.target.value)} className={timeField} />
          </label>
        </div>
        <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('qualityLabel')}</p>
        <div className="mt-2 flex gap-2">
          {([1, 2, 3] as const).map((q) => (
            <button key={q} type="button" onClick={() => setQuality(q)} aria-pressed={quality === q} className={`${chipClass(quality === q)} flex-1`}>
              <span className="mr-1" aria-hidden>
                {q === 1 ? '😴' : q === 2 ? '😐' : '😊'}
              </span>
              {t(`quality_${q}`)}
            </button>
          ))}
        </div>
        <button type="button" onClick={save} disabled={busy} className={`${primary} mt-4 w-full`}>
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null} {t('logSave')}
        </button>
        {msg && <p className={`mt-2 text-sm font-semibold ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>}
      </div>

      <div className={card}>
        <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('weekTitle')}</h3>
        {!stats ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{t('needTwo')}</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('avgSleep')} value={dur(stats.avgSleep)} />
              <Stat label={t('regularity')} value={t(`reg_${stats.regularityLevel}`)} hint={t('regularityHint')} />
              {stats.socialJetlag !== null && <Stat label={t('weekendShift')} value={dur(stats.socialJetlag)} />}
              <Stat label={t('avgQuality')} value={stats.avgQuality >= 2.5 ? t('quality_3') : stats.avgQuality >= 1.6 ? t('quality_2') : t('quality_1')} />
            </div>
            <p className="mt-4 rounded-xl bg-[var(--gold-pale)] px-4 py-3 text-sm font-semibold text-[var(--ink)]">{t(`tip_${stats.tip}`)}</p>
            <svg viewBox={`0 0 ${Math.max(chart.length, 1) * 24} 200`} className="mt-4 h-48 w-full" preserveAspectRatio="none" role="img" aria-label={t('historyTitle')}>
              {[0, 4, 8, 12, 16].map((h) => (
                <line key={h} x1={0} x2={chart.length * 24} y1={(h * 60 * 200) / (16 * 60)} y2={(h * 60 * 200) / (16 * 60)} stroke="#e5e7eb" strokeWidth={0.6} />
              ))}
              {chart.map((l, i) => {
                const top = y(toMinutes(l.bed) ?? 0)
                const bottom = y(toMinutes(l.wake) ?? 0)
                return <rect key={l.night} x={i * 24 + 5} y={(top * 200) / (16 * 60)} width={14} height={Math.max(4, ((bottom - top) * 200) / (16 * 60))} rx={4} fill={qColor[l.quality]} />
              })}
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
              <span>20:00 ↓</span>
              <span>12:00</span>
            </div>
          </>
        )}
      </div>

      {recent.length > 0 && (
        <div className={card}>
          <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('historyTitle')}</h3>
          <ul className="mt-3 divide-y divide-gray-100">
            {recent.slice(0, 30).map((l) => (
              <li key={l.night} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-semibold capitalize text-[var(--ink)]">{nightName(l.night)}</span>
                <span className="font-mono text-[var(--ink-soft)]">
                  {l.bed}–{l.wake} · {dur(span(toMinutes(l.bed) ?? 0, toMinutes(l.wake) ?? 0))}
                </span>
                <span aria-label={t(`quality_${l.quality}`)}>{l.quality === 1 ? '😴' : l.quality === 2 ? '😐' : '😊'}</span>
                <button type="button" onClick={() => remove(l.night)} aria-label={t('deleteNight')} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-[var(--paper)] p-3" title={hint}>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 font-extrabold text-[var(--ink)]">{value}</p>
    </div>
  )
}

// --------------------------------------------------------------------- Turni

function ShiftsTab() {
  const t = useTranslations('cronobioma')
  const [preset, setPreset] = useState<ShiftPreset>('night')
  const [start, setStart] = useState<string>(SHIFT_PRESETS.night[0])
  const [end, setEnd] = useState<string>(SHIFT_PRESETS.night[1])
  const choose = (p: ShiftPreset) => {
    setPreset(p)
    if (p !== 'custom') {
      setStart(SHIFT_PRESETS[p][0])
      setEnd(SHIFT_PRESETS[p][1])
    }
  }
  const planned = shiftPlan(start, end)
  const steps = planned ? [...planned.steps].sort((a, b) => span(norm((toMinutes(start) ?? 0) - 6 * 60), a.start) - span(norm((toMinutes(start) ?? 0) - 6 * 60), b.start)) : []

  return (
    <div className={card}>
      <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('shiftsTitle')}</h3>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{t('shiftsIntro')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['morning', 'afternoon', 'night', 'custom'] as const).map((p) => (
          <button key={p} type="button" onClick={() => choose(p)} aria-pressed={preset === p} className={chipClass(preset === p)}>
            {t(`preset_${p}`)}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-[var(--ink)]">
          {t('shiftStart')}
          <input type="time" value={start} onChange={(e) => { if (e.target.value) { setStart(e.target.value); setPreset('custom') } }} className={timeField} />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          {t('shiftEnd')}
          <input type="time" value={end} onChange={(e) => { if (e.target.value) { setEnd(e.target.value); setPreset('custom') } }} className={timeField} />
        </label>
      </div>
      {!planned ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{t('invalidShift')}</p>
      ) : (
        <>
          {planned.night && <p className="mt-4 rounded-xl bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">{t('shiftNightNote')}</p>}
          <ol className="mt-4 space-y-2">
            {steps.map((s) => (
              <li key={s.key} className="flex items-start gap-3 rounded-xl border border-gray-100 px-3 py-2">
                <span className="mt-0.5 shrink-0 rounded-lg bg-[var(--ink)] px-2 py-1 font-mono text-xs font-bold text-[var(--gold-bright)]">
                  {fmt(s.start)}
                  {s.end !== undefined ? `–${fmt(s.end)}` : ''}
                </span>
                <span>
                  <span className="block font-bold text-[var(--ink)]">{t(`st_${s.key}`)}</span>
                  <span className="block text-sm text-[var(--muted)]">{t(`stText_${s.key}`)}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

// -------------------------------------------------------------------- Viaggi

function TravelTab({ answers }: { answers: QuizAnswers | null }) {
  const t = useTranslations('cronobioma')
  const [home, setHome] = useState('Europe/Rome')
  const [dest, setDest] = useState('America/New_York')
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- il fuso del telefono si conosce solo nel browser
      setHome(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome')
    } catch {
      // facoltativo
    }
  }, [])
  const r = computeChrono(answers ?? cleanAnswers({ workDays: 5, workBed: '23:00', workLatency: 15, workWake: '07:00', freeBed: '23:30', freeLatency: 15, freeWake: '08:00' })!)
  const plan = jetlagPlan(home, dest, r)
  const city = (z: string) => z.split('/').pop()!.replace(/_/g, ' ')

  return (
    <div className={card}>
      <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('travelTitle')}</h3>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{t('travelIntro')}</p>
      <label className="mt-4 block text-sm font-semibold text-[var(--ink)]">
        {t('destination')}
        <select value={dest} onChange={(e) => setDest(e.target.value)} className={timeField}>
          {JETLAG_ZONES.map((z) => (
            <option key={z} value={z}>
              {city(z)}
            </option>
          ))}
        </select>
      </label>
      {plan && (
        <div className="mt-4 space-y-4">
          <p className="font-bold text-[var(--ink)]">{t('travelDiff', { hours: plan.hours > 0 ? `+${plan.hours}` : String(plan.hours) })}</p>
          <p className="rounded-xl bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">{t(`travel_${plan.direction}`)}</p>
          {plan.direction !== 'none' && (
            <>
              <p className="text-sm font-semibold text-[var(--ink)]">{t('travelDays', { days: plan.daysToAdapt })}</p>
              <div>
                <p className="text-sm font-extrabold uppercase tracking-wide text-[var(--gold)]">{t('beforeTitle')}</p>
                <ul className="mt-2 space-y-1.5">
                  {plan.before.map((b) => (
                    <li key={b.day} className="flex flex-wrap justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm">
                      <span className="font-bold text-[var(--ink)]">{t('dayBefore', { n: -b.day })}</span>
                      <span className="text-[var(--ink-soft)]">{t('bedWake', { bed: fmt(b.bed), wake: fmt(b.wake) })}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-extrabold uppercase tracking-wide text-[var(--gold)]">{t('afterTitle')}</p>
                <ul className="mt-2 space-y-1.5">
                  {plan.after.map((d) => (
                    <li key={d.day} className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
                      <span className="font-bold text-[var(--ink)]">{t('dayN', { n: d.day })}</span>
                      <span className="mt-0.5 block text-[var(--ink-soft)]">
                        {d.seek && <span className="block">☀️ {t('seekLight', { from: fmt(d.seek[0]), to: fmt(d.seek[1]) })}</span>}
                        {d.avoid && <span className="block">🕶️ {t('avoidLight', { from: fmt(d.avoid[0]), to: fmt(d.avoid[1]) })}</span>}
                        {!d.seek && !d.avoid && <span className="block">{t('noWindow')}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Promemoria

function RemindersTab({ plan }: { plan: ReturnType<typeof dayPlan> }) {
  const t = useTranslations('cronobioma')
  const dur = useDuration()
  const at = (key: string) => plan.events.find((e) => e.key === key)?.start ?? 0
  const items = [
    { key: 'light', time: plan.wake, title: t('ev_light'), text: t('evText_light') },
    { key: 'caffeine', time: at('caffeine'), title: t('ev_caffeine'), text: t('evText_caffeine') },
    { key: 'screens', time: at('screens'), title: t('ev_screens'), text: t('evText_screens') },
    { key: 'bed', time: plan.bed, title: t('ev_bed'), text: t('evText_bed', { hours: dur(plan.sleepNeed), wake: fmt(plan.wake) }) },
    { key: 'diary', time: norm(plan.wake + 30), title: t('rem_diary'), text: t('remText_diary') },
  ]
  const [chosen, setChosen] = useState<string[]>(['light', 'caffeine', 'screens', 'diary'])
  const toggle = (k: string) => setChosen((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))

  const download = () => {
    if (!chosen.length) return
    let zone = 'Europe/Rome'
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone
    } catch {
      // facoltativo
    }
    const ics = buildIcs(
      items.filter((i) => chosen.includes(i.key)).map((i) => ({ ...i, title: `KUMANI · ${i.title}` })),
      zone,
      // Sempre lo stesso: aggiungendo di nuovo il file il calendario aggiorna gli stessi promemoria
      'v1'
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    a.download = 'KUMANI_CRONOBIOMA.ics'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  }

  return (
    <div className={card}>
      <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('remindersTitle')}</h3>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{t('remindersIntro')}</p>
      <ul className="mt-4 space-y-2">
        {items.map((i) => (
          <li key={i.key}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
              <input type="checkbox" checked={chosen.includes(i.key)} onChange={() => toggle(i.key)} className="h-5 w-5 accent-[var(--gold)]" />
              <span className="flex-1 font-semibold text-[var(--ink)]">{i.title}</span>
              <span className="font-mono text-sm font-bold text-[var(--ink-soft)]">{fmt(i.time)}</span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" onClick={download} disabled={!chosen.length} className={`${primary} mt-4 w-full`}>
        <CalendarPlus className="h-5 w-5" /> {t('remindersDownload')}
      </button>
      <p className="mt-2 text-xs text-[var(--muted)]">{chosen.length ? t('remindersHint') : t('remindersSelectOne')}</p>
    </div>
  )
}
