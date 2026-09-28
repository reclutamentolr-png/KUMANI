'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BookOpen, ChevronLeft, ChevronRight, Dices, Feather, Flag, Flame, LoaderCircle, PenLine, Send, Share2, Timer, Trash2 } from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import {
  applaudFabula,
  deleteFabulaStory,
  getFabulaGallery,
  getFabulaStatus,
  getFabulaMy,
  reportFabula,
  saveFabulaStory,
  setFabulaPublished,
} from '@/app/actions/fabula'
import {
  FABULA_CHALLENGE_SECONDS,
  FABULA_DICE,
  FABULA_LOCALES,
  FABULA_LOCALE_NAMES,
  FABULA_MAX_CHARS,
  FABULA_MIN_CHARS,
  FABULA_REPORT_REASONS,
  faceOf,
  randomDice,
  type FabulaGallery,
  type FabulaLocale,
  type FabulaStatus,
  type FabulaStory,
} from '@/lib/fabula'
import { renderFabulaShareCard } from '@/lib/fabulaShareCard'

type Tab = 'write' | 'gallery' | 'mine'
type Notice = { text: string; tone: 'ok' | 'error' | 'info' }

const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Kumani Fabula: lancio dei dadi, scrittura, galleria del giorno e archivio.
export default function FabulaHome({
  status,
  initialGallery,
  initialMy,
}: {
  status: FabulaStatus
  initialGallery: FabulaGallery | null
  initialMy: FabulaStory[]
}) {
  const t = useTranslations('fabula')
  const locale = useLocale()
  const [tab, setTab] = useState<Tab>('write')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [myToday, setMyToday] = useState(status.my_today)
  const [my, setMy] = useState(initialMy)
  const [gallery, setGallery] = useState(initialGallery)
  const [galleryDay, setGalleryDay] = useState(status.today)
  const [galleryLocale, setGalleryLocale] = useState<string>('')
  const [loadingGallery, setLoadingGallery] = useState(false)
  const [stats, setStats] = useState({ stories: status.stories, streak: status.streak, best: status.best_streak, badges: status.badges })
  const refreshStats = useCallback(async () => {
    const fresh = await getFabulaStatus()
    if (fresh) setStats({ stories: fresh.stories, streak: fresh.streak, best: fresh.best_streak, badges: fresh.badges })
  }, [])
  const [reporting, setReporting] = useState<{ story: FabulaStory; reason: (typeof FABULA_REPORT_REASONS)[number] } | null>(null)

  const errorText = useCallback((code?: string) => (code && t.has(`error_${code}`) ? t(`error_${code}`) : t('error_saveError')), [t])

  const loadGallery = useCallback(async (day: string, lang: string) => {
    setLoadingGallery(true)
    setGallery(await getFabulaGallery(day, lang || null))
    setLoadingGallery(false)
  }, [])

  const refreshMine = useCallback(async () => setMy(await getFabulaMy()), [])

  const share = useCallback(
    async (story: { dice: number[]; title: string | null; body: string; author_name?: string }) => {
      const blob = await renderFabulaShareCard({
        emoji: story.dice.map((face, i) => faceOf(i, face).emoji),
        title: story.title,
        body: story.body,
        author: story.author_name || 'Kumano',
        footer: t('cardFooter'),
        site: window.location.host,
      }).catch(() => null)
      if (!blob) return
      const file = new File([blob], 'kumani-fabula.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: t('cardShareText') })
        } catch {
          // Annullato.
        }
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'kumani-fabula.png'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
    [t],
  )

  const tabs: [Tab, string, typeof Dices][] = [
    ['write', t('tabWrite'), PenLine],
    ['gallery', t('tabGallery'), BookOpen],
    ['mine', t('tabMine'), Feather],
  ]

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value)
              setNotice(null)
            }}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${
              tab === value ? 'bg-[var(--ink)] text-white' : 'border border-gray-200 bg-white text-gray-700'
            }`}
          >
            <Icon className={`h-4 w-4 ${tab === value ? 'text-[var(--gold-bright)]' : ''}`} /> {label}
          </button>
        ))}
      </div>

      {notice && (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            notice.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : notice.tone === 'info' ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      {tab === 'write' && (
        <WriteTab
          status={status}
          myToday={myToday}
          defaultLocale={(FABULA_LOCALES as readonly string[]).includes(locale) ? (locale as FabulaLocale) : 'it'}
          onSaved={async (result, daily, story) => {
            if (daily) setMyToday({ id: result.id!, status: result.status!, title: story.title || null, body: story.body, locale: story.locale })
            setNotice({
              text:
                result.status === 'published' ? t('savedPublished') : result.status === 'pending' ? t('savedPending') : t('savedPrivate'),
              tone: result.status === 'pending' ? 'info' : 'ok',
            })
            await Promise.all([refreshMine(), refreshStats()])
            if (result.status === 'published') loadGallery(status.today, galleryLocale)
          }}
          onError={(code) => setNotice({ text: errorText(code), tone: 'error' })}
          onShare={share}
        />
      )}

      {tab === 'gallery' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t('previousDay')}
                onClick={() => {
                  const day = shiftDay(galleryDay, -1)
                  setGalleryDay(day)
                  loadGallery(day, galleryLocale)
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-center">
                <p className="text-sm font-bold text-[var(--ink)]">
                  {galleryDay === status.today
                    ? t('today')
                    : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${galleryDay}T12:00:00Z`))}
                </p>
                {gallery && <p className="text-xl tracking-wider">{gallery.dice.map((face, i) => faceOf(i, face).emoji).join(' ')}</p>}
              </div>
              <button
                type="button"
                aria-label={t('nextDay')}
                disabled={galleryDay >= status.today}
                onClick={() => {
                  const day = shiftDay(galleryDay, 1)
                  setGalleryDay(day)
                  loadGallery(day, galleryLocale)
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['', ...FABULA_LOCALES].map((code) => {
                const count = code ? gallery?.locales[code] ?? 0 : null
                if (code && !count && galleryLocale !== code) return null
                return (
                  <button
                    key={code || 'all'}
                    type="button"
                    onClick={() => {
                      setGalleryLocale(code)
                      loadGallery(galleryDay, code)
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      galleryLocale === code ? 'bg-[var(--ink)] text-white' : 'border border-gray-200 text-gray-700'
                    }`}
                  >
                    {code ? `${code.toUpperCase()} · ${count}` : t('allLanguages')}
                  </button>
                )
              })}
            </div>
          </div>

          {loadingGallery ? (
            <div className="flex justify-center py-10">
              <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" />
            </div>
          ) : !gallery || gallery.stories.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-[var(--muted)]">{t('galleryEmpty')}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {gallery.stories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onApplaud={async () => {
                    const result = await applaudFabula(story.id)
                    if (result.error) return setNotice({ text: errorText(result.error), tone: 'error' })
                    setGallery((g) =>
                      g && {
                        ...g,
                        stories: g.stories.map((s) => (s.id === story.id ? { ...s, applauded: !!result.applauded, applause: result.count ?? s.applause } : s)),
                      },
                    )
                  }}
                  onReport={() => setReporting({ story, reason: 'offensive' })}
                  onShare={story.is_mine ? () => share(story) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [t('statStories'), stats.stories],
              [t('statStreak'), stats.streak],
              [t('statBestStreak'), stats.best],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
                <p className="mt-1 text-2xl font-black text-[var(--ink)]">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['first_story', Feather, stats.badges.first_story],
                ['steady_pen', Flame, stats.badges.steady_pen],
              ] as const
            ).map(([key, Icon, earned]) => (
              <span
                key={key}
                title={t(`badge_${key}_desc`)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                  earned ? 'border border-[var(--gold)]/50 bg-[var(--gold)]/10 text-[var(--ink)]' : 'border border-gray-200 bg-gray-50 text-gray-400'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${earned ? 'text-[var(--gold)]' : ''}`} /> {t(`badge_${key}`)}
              </span>
            ))}
          </div>

          {my.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-[var(--muted)]">{t('mineEmpty')}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {my.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  mine
                  onShare={() => share(story)}
                  onTogglePublish={
                    story.roll_date && !story.locked && !['hidden', 'removed'].includes(story.status)
                      ? async () => {
                          const result = await setFabulaPublished(story.id, story.status === 'private')
                          if (!['private', 'pending', 'published'].includes(result)) return setNotice({ text: errorText(result), tone: 'error' })
                          setNotice({
                            text: result === 'published' ? t('savedPublished') : result === 'pending' ? t('savedPending') : t('unpublished'),
                            tone: result === 'pending' ? 'info' : 'ok',
                          })
                          if (story.roll_date === status.today) setMyToday((m) => m && { ...m, status: result as FabulaStory['status'] })
                          await refreshMine()
                        }
                      : undefined
                  }
                  onDelete={async () => {
                    if (!confirm(t('deleteConfirm'))) return
                    const result = await deleteFabulaStory(story.id)
                    if (result !== 'ok') return setNotice({ text: errorText(result), tone: 'error' })
                    if (story.roll_date === status.today) setMyToday(null)
                    setNotice({ text: t('deleted'), tone: 'ok' })
                    await Promise.all([refreshMine(), refreshStats()])
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {reporting && (
        <Sheet title={t('reportTitle')} onClose={() => setReporting(null)}>
          <div className="space-y-2">
            {FABULA_REPORT_REASONS.map((reason) => (
              <label key={reason} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-800">
                <input
                  type="radio"
                  name="fabula-report"
                  className="h-4 w-4 accent-[var(--ink)]"
                  checked={reporting.reason === reason}
                  onChange={() => setReporting({ ...reporting, reason })}
                />
                {t(`reportReason_${reason}`)}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={async () => {
              const result = await reportFabula(reporting.story.id, reporting.reason)
              setReporting(null)
              setNotice(result === 'ok' ? { text: t('reportSent'), tone: 'ok' } : { text: errorText(result), tone: 'error' })
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white"
          >
            <Flag className="h-4 w-4 text-[var(--gold-bright)]" /> {t('reportSend')}
          </button>
        </Sheet>
      )}
    </div>
  )
}

// I sei dadi: si "lanciano" (le facce scorrono) e si fermano sul risultato
function DiceRow({ dice, rolling }: { dice: number[] | null; rolling: boolean }) {
  const t = useTranslations('fabula')
  const [spin, setSpin] = useState<number[] | null>(null)

  useEffect(() => {
    if (!rolling) return
    const timer = setInterval(() => setSpin(randomDice()), 90)
    return () => {
      clearInterval(timer)
      setSpin(null)
    }
  }, [rolling])

  const shown = rolling ? spin : dice
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {FABULA_DICE.map((die, i) => {
        const face = shown ? faceOf(i, shown[i]) : null
        return (
          <div
            key={die.id}
            className={`flex flex-col items-center rounded-2xl border p-3 text-center transition-transform ${
              face ? 'border-[var(--gold)]/50 bg-white shadow-sm' : 'border-dashed border-gray-300 bg-gray-50'
            } ${rolling ? 'animate-pulse' : ''}`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{t(`die_${die.id}`)}</span>
            <span className="my-1 text-4xl leading-none">{face ? face.emoji : '🎲'}</span>
            <span className="min-h-[1rem] text-xs font-semibold text-[var(--ink)]">{face && !rolling ? t(`face_${face.id}`) : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

function WriteTab({
  status,
  myToday,
  defaultLocale,
  onSaved,
  onError,
  onShare,
}: {
  status: FabulaStatus
  myToday: FabulaStatus['my_today']
  defaultLocale: FabulaLocale
  onSaved: (
    result: { id?: string; status?: FabulaStory['status'] },
    daily: boolean,
    story: { title: string; body: string; locale: FabulaLocale },
  ) => Promise<void>
  onError: (code?: string) => void
  onShare: (story: { dice: number[]; title: string | null; body: string }) => void
}) {
  const t = useTranslations('fabula')
  const [mode, setMode] = useState<'daily' | 'free'>('daily')
  const [dice, setDice] = useState<number[] | null>(null)
  const [rolling, setRolling] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [lang, setLang] = useState<FabulaLocale>(defaultLocale)
  const [challenge, setChallenge] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canWrite = status.online && !status.blocked
  const dailyDone = mode === 'daily' && !!myToday
  const timeUp = challenge && secondsLeft === 0

  useEffect(() => () => {
    if (rollTimer.current) clearTimeout(rollTimer.current)
  }, [])

  // Sfida dei 60 secondi: il tempo parte alla prima lettera
  useEffect(() => {
    if (!challenge || secondsLeft === null || secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? s : Math.max(0, s - 1))), 1000)
    return () => clearTimeout(timer)
  }, [challenge, secondsLeft])

  const roll = () => {
    setRolling(true)
    setBody('')
    setTitle('')
    setSecondsLeft(null)
    rollTimer.current = setTimeout(() => {
      setDice(mode === 'daily' ? status.dice : randomDice())
      setRolling(false)
    }, 1100)
  }

  const switchMode = (value: 'daily' | 'free') => {
    if (rollTimer.current) clearTimeout(rollTimer.current)
    setRolling(false)
    setMode(value)
    setDice(null)
    setBody('')
    setTitle('')
    setSecondsLeft(null)
  }

  const save = async (publish: boolean) => {
    if (!dice) return
    setBusy(true)
    const result = await saveFabulaStory({ daily: mode === 'daily', dice, title, body, locale: lang, publish, challenge })
    setBusy(false)
    if (!result.id) return onError(result.error)
    await onSaved(result, mode === 'daily', { title, body, locale: lang })
    if (mode === 'free') {
      setDice(null)
      setBody('')
      setTitle('')
    }
    setSecondsLeft(null)
  }

  const todayDice = useMemo(() => status.dice, [status.dice])
  const length = body.trim().length

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['daily', 'free'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => switchMode(value)}
            disabled={rolling}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${mode === value ? 'bg-[var(--gold)]/20 text-[var(--ink)] ring-1 ring-[var(--gold)]' : 'text-gray-600'}`}
          >
            {t(value === 'daily' ? 'modeDaily' : 'modeFree')}
          </button>
        ))}
      </div>
      <p className="text-sm text-[var(--muted)]">{t(mode === 'daily' ? 'modeDailyText' : 'modeFreeText')}</p>

      {dailyDone ? (
        <div className="space-y-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
          <DiceRow dice={todayDice} rolling={false} />
          <p className="text-sm font-semibold text-[var(--ink)]">{t('todayDone')}</p>
          {myToday?.title && <p className="font-serif text-lg font-bold text-[var(--ink)]">{myToday.title}</p>}
          <p className="whitespace-pre-line font-serif text-gray-800">{myToday?.body}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{t(`status_${myToday?.status}`)}</span>
            <button
              type="button"
              onClick={() => myToday && onShare({ dice: todayDice, title: myToday.title, body: myToday.body })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700"
            >
              <Share2 className="h-3.5 w-3.5" /> {t('share')}
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">{t('tryFree')}</p>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
          <DiceRow dice={dice} rolling={rolling} />
          {!dice && (
            <button
              type="button"
              onClick={roll}
              disabled={rolling || !canWrite}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <Dices className="h-5 w-5 text-[var(--gold-bright)]" /> {rolling ? t('rolling') : t('roll')}
            </button>
          )}

          {dice && canWrite && (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  placeholder={t('titlePlaceholder')}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 font-serif text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/40"
                />
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as FabulaLocale)}
                  aria-label={t('language')}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/40"
                >
                  {FABULA_LOCALES.map((code) => (
                    <option key={code} value={code}>
                      {FABULA_LOCALE_NAMES[code]}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={body}
                onChange={(e) => {
                  if (challenge && secondsLeft === null && e.target.value) setSecondsLeft(FABULA_CHALLENGE_SECONDS)
                  setBody(e.target.value)
                }}
                readOnly={timeUp}
                maxLength={FABULA_MAX_CHARS}
                rows={8}
                placeholder={t('bodyPlaceholder')}
                className="w-full rounded-xl border border-gray-300 p-3 font-serif text-[16px] leading-7 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/40 read-only:bg-gray-50"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <label className="flex items-center gap-2 font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--ink)]"
                    checked={challenge}
                    disabled={secondsLeft !== null && secondsLeft > 0}
                    onChange={(e) => {
                      setChallenge(e.target.checked)
                      setSecondsLeft(null)
                    }}
                  />
                  <Timer className="h-3.5 w-3.5" /> {t('challenge')}
                </label>
                <span className={`font-semibold ${length > FABULA_MAX_CHARS - 50 ? 'text-amber-700' : 'text-[var(--muted)]'}`}>
                  {challenge && secondsLeft !== null && (
                    <span className={`mr-3 ${secondsLeft <= 10 ? 'text-red-600' : 'text-[var(--ink)]'}`}>
                      {timeUp ? t('timeUp') : t('secondsLeft', { seconds: secondsLeft })}
                    </span>
                  )}
                  {body.length}/{FABULA_MAX_CHARS}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {mode === 'daily' && (
                  <button
                    type="button"
                    onClick={() => save(true)}
                    disabled={busy || length < FABULA_MIN_CHARS}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
                  >
                    <Send className="h-4 w-4 text-[var(--gold-bright)]" /> {t('publish')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => save(false)}
                  disabled={busy || length < FABULA_MIN_CHARS}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40 ${
                    mode === 'daily' ? 'border border-gray-300 text-gray-700' : 'bg-[var(--ink)] text-white sm:col-span-2'
                  }`}
                >
                  <Feather className="h-4 w-4" /> {t('saveForMe')}
                </button>
              </div>
              {length > 0 && length < FABULA_MIN_CHARS && <p className="text-xs text-[var(--muted)]">{t('minChars', { count: FABULA_MIN_CHARS })}</p>}
              {mode === 'daily' && status.login_days < status.min_login_days && (
                <p className="text-xs text-[var(--muted)]">{t('newUserNote', { min: status.min_login_days })}</p>
              )}
              {mode === 'free' && (
                <button type="button" onClick={roll} disabled={rolling} className="text-xs font-semibold text-[var(--muted)] underline">
                  {t('rerollFree')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StoryCard({
  story,
  mine = false,
  onApplaud,
  onReport,
  onShare,
  onTogglePublish,
  onDelete,
}: {
  story: FabulaStory
  mine?: boolean
  onApplaud?: () => void
  onReport?: () => void
  onShare?: () => void
  onTogglePublish?: () => void
  onDelete?: () => void
}) {
  const t = useTranslations('fabula')
  const locale = useLocale()
  const when = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(
    new Date(story.created_at),
  )
  return (
    <article className="flex flex-col rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-lg tracking-wider">{story.dice.map((face, i) => faceOf(i, face).emoji).join(' ')}</span>
        <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 text-[10px] font-bold text-[var(--gold-bright)]">{story.locale.toUpperCase()}</span>
      </div>
      {story.title && <h3 className="font-serif text-lg font-bold text-[var(--ink)]">{story.title}</h3>}
      <p className="mt-1 whitespace-pre-line font-serif leading-7 text-gray-800">{story.body}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-[var(--muted)]">
        <span>
          {mine ? (story.roll_date ? t('dailyRoll') : t('freeRoll')) : story.author_name} · {when}
          {story.challenge && <Timer className="ml-1 inline h-3 w-3" aria-label={t('challenge')} />}
        </span>
        <div className="flex items-center gap-1.5">
          {mine && <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">{t(`status_${story.status}`)}</span>}
          {onApplaud && (
            <button
              type="button"
              onClick={onApplaud}
              disabled={story.is_mine}
              aria-label={t('applaud')}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${
                story.applauded ? 'bg-[var(--gold)]/20 text-[var(--ink)]' : 'border border-gray-200 text-gray-600'
              } disabled:opacity-60`}
            >
              👏 {story.applause}
            </button>
          )}
          {mine && story.status === 'published' && <span className="font-semibold">👏 {story.applause}</span>}
          {onShare && (
            <button type="button" onClick={onShare} aria-label={t('share')} className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100">
              <Share2 className="h-4 w-4" />
            </button>
          )}
          {onTogglePublish && (
            <button type="button" onClick={onTogglePublish} className="rounded-lg border border-gray-200 px-2 py-1 font-semibold text-gray-700">
              {story.status === 'private' ? t('publishShort') : t('unpublishShort')}
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} aria-label={t('delete')} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {onReport && !story.is_mine && (
            <button type="button" onClick={onReport} aria-label={t('report')} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600">
              <Flag className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
