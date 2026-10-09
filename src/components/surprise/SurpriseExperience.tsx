'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  Baby,
  Cake,
  Camera,
  CheckCircle2,
  Flower2,
  Gem,
  Gift,
  GraduationCap,
  HandHeart,
  Heart,
  LoaderCircle,
  Lock,
  MapPin,
  Music2,
  PartyPopper,
  Send,
  Smile,
  Sparkles,
  TreePine,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { resizeImageFile } from '@/lib/resizeImage'
import { audioUrl } from '@/lib/audioUrl'
import { musicFile, OCCASION_STYLE, REACTIONS, THEME_STYLE, type Reaction, type SurpriseOccasion, type SurpriseView, type SurpriseViewStep } from '@/lib/surprise'
import { sendSurpriseReply, solveSurpriseRiddle } from '@/app/actions/surprisePublic'
import Celebration from './Celebration'
import Reveal from './Reveal'
import { letterFont } from './surpriseFonts'

// Pagina di chi riceve (e anteprima di chi crea): apertura scelta da chi
// regala (scatola, busta, gratta e scopri), effetto e musica dell'occasione,
// percorso a capitoli con le tappe che si svelano nel tempo, biglietto
// finale e ringraziamento.

export const OCCASION_ICON: Record<SurpriseOccasion, LucideIcon> = {
  generic: Gift,
  birthday: Cake,
  love: Heart,
  wedding: Gem,
  baby: Baby,
  christmas: TreePine,
  parents: Flower2,
  graduation: GraduationCap,
  party: PartyPopper,
  thanks: HandHeart,
}
const REACTION_ICON: Record<Reaction, LucideIcon> = { love: Heart, joy: Smile, wow: PartyPopper, thanks: HandHeart }

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function Countdown({ to }: { to: string }) {
  const t = useTranslations('surprise')
  const router = useRouter()
  const now = useNow()
  const left = Math.max(0, new Date(to).getTime() - now)
  useEffect(() => {
    if (left === 0) {
      const id = setTimeout(() => router.refresh(), 1500)
      return () => clearTimeout(id)
    }
  }, [left, router])
  const d = Math.floor(left / 86_400_000)
  const h = Math.floor((left % 86_400_000) / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  return <span className="font-semibold tabular-nums">{d > 0 ? t('countdownDays', { d, h, m }) : t('countdownHours', { h, m, s })}</span>
}

function Media({ url, type }: { url: string; type: 'image' | 'video' | 'audio' | null | undefined }) {
  if (type === 'video') return <video src={url} controls playsInline className="mt-4 w-full rounded-2xl bg-black" />
  if (type === 'audio') return <audio src={url} controls className="mt-4 w-full" />
  // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo dello Storage
  return <img src={url} alt="" loading="lazy" className="mt-4 h-auto max-h-[75vh] w-full rounded-2xl object-contain" />
}

// Galleria scorrevole (con il dito o con le frecce della tastiera)
function Gallery({ urls }: { urls: string[] }) {
  const t = useTranslations('surprise')
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  if (!urls.length) return null
  return (
    <div className="mt-4">
      <div
        ref={track}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none]"
        aria-label={t('galleryLabel', { n: urls.length })}
      >
        {urls.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo dello Storage
          <img key={u} src={u} alt={t('photoN', { n: i + 1 })} loading="lazy" className="h-auto max-h-[70vh] w-full shrink-0 snap-center object-contain" />
        ))}
      </div>
      {urls.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {urls.map((u, i) => (
            <span key={u} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-gray-800' : 'w-1.5 bg-gray-300'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function Riddle({ step, token, accent, onSolved }: { step: SurpriseViewStep; token?: string; accent: string; onSolved: (s: SurpriseViewStep) => void }) {
  const t = useTranslations('surprise')
  const [answer, setAnswer] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'wrong' | 'wait'>('idle')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !answer.trim()) return
    setState('busy')
    const r = await solveSurpriseRiddle(token, step.id, answer)
    if (r.ok) return onSolved(r.step)
    setState(r.reason === 'wait' ? 'wait' : 'wrong')
  }
  return (
    <form onSubmit={submit} className="mt-3">
      <p className="font-[family-name:var(--font-letter)] text-2xl leading-snug text-gray-900">{step.riddle?.question}</p>
      <label className="mt-4 block text-sm font-semibold text-gray-700" htmlFor={`ans-${step.id}`}>
        {t('riddleAnswer')}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={`ans-${step.id}`}
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value)
            if (state !== 'busy') setState('idle')
          }}
          autoComplete="off"
          maxLength={100}
          className={`min-h-12 min-w-0 flex-1 rounded-xl border px-4 text-base focus:outline-none focus:ring-2 ${state === 'wrong' ? 'border-red-400 motion-safe:animate-[shake_0.35s]' : 'border-gray-300'}`}
          style={{ ['--tw-ring-color' as string]: accent }}
          aria-invalid={state === 'wrong'}
          aria-describedby={`ans-msg-${step.id}`}
        />
        <button type="submit" disabled={state === 'busy' || !token} className="min-h-12 shrink-0 cursor-pointer rounded-xl px-4 font-bold text-white disabled:opacity-60" style={{ background: accent }}>
          {state === 'busy' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : t('riddleSend')}
        </button>
      </div>
      <p id={`ans-msg-${step.id}`} role="status" className="mt-2 min-h-5 text-sm font-semibold text-red-600">
        {state === 'wrong' ? t('riddleWrong') : state === 'wait' ? t('riddleWait') : !token ? t('riddlePreview') : ''}
      </p>
    </form>
  )
}

function StepCard({ step, accent, token, onSolved }: { step: SurpriseViewStep; accent: string; token?: string; onSolved: (s: SurpriseViewStep) => void }) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  if (!step.open) {
    return (
      <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-6 text-white/80 backdrop-blur">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
          <Lock className="h-4 w-4" /> {t('day', { day: step.day })}
        </p>
        <p className="mt-2 text-lg font-semibold text-white">{t('lockedStep')}</p>
        <p className="mt-1 text-sm">
          {t('opensIn')} <Countdown to={step.unlockAt} />
        </p>
        <p className="mt-0.5 text-xs text-white/60">
          {new Date(step.unlockAt).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    )
  }
  const unsolved = step.kind === 'riddle' && step.riddle && !step.riddle.solved
  return (
    <article className="relative overflow-hidden rounded-3xl bg-white p-6 text-gray-800 shadow-2xl motion-safe:animate-[fadeIn_0.5s_ease-out]">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />
      <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
        {t('day', { day: step.day })}
        {step.kind !== 'message' ? ` · ${t(`stepKind_${step.kind}`)}` : ''}
      </p>
      {unsolved ? (
        <Riddle step={step} token={token} accent={accent} onSolved={onSolved} />
      ) : (
        <>
          {step.title && <h3 className="mt-2 font-[family-name:var(--font-letter)] text-3xl font-semibold leading-tight text-gray-900">{step.title}</h3>}
          {step.message && <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">{step.message}</p>}
          {step.mediaUrl && <Media url={step.mediaUrl} type={step.mediaType} />}
          {!!step.gallery?.length && <Gallery urls={step.gallery} />}
          {step.kind === 'place' && (step.extra?.placeName || step.extra?.placeAddress) && (
            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
              <p className="flex items-start gap-2 font-semibold text-gray-900">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} /> {step.extra.placeName || step.extra.placeAddress}
              </p>
              {step.extra.placeName && step.extra.placeAddress && <p className="ml-7 text-sm text-gray-600">{step.extra.placeAddress}</p>}
              <a
                href={step.extra.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(step.extra.placeAddress || step.extra.placeName || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-7 mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold text-white"
                style={{ background: accent }}
              >
                {t('openMap')}
              </a>
            </div>
          )}
          {step.kind === 'song' && step.extra?.songUrl && (
            <a
              href={step.extra.songUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-white hover:bg-black"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: accent }}>
                <Music2 className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{step.extra.songTitle || t('listenSong')}</span>
                <span className="block text-xs text-white/70">{t('listenSong')}</span>
              </span>
            </a>
          )}
          {step.hint && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-800" style={{ background: `${accent}1f` }}>
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} /> {step.hint}
            </p>
          )}
        </>
      )}
    </article>
  )
}

function Ticket({ view, accent, Icon }: { view: SurpriseView; accent: string; Icon: LucideIcon }) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  const v = view.voucher
  const style = THEME_STYLE[view.theme]
  return (
    <article className={`relative overflow-hidden rounded-[28px] ${style.card} ${style.text} shadow-2xl motion-safe:animate-[fadeIn_0.6s_ease-out]`}>
      {v.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo dello Storage
        <img src={v.coverUrl} alt="" className="block h-auto max-h-[75vh] w-full bg-black/5 object-contain" />
      )}
      <div className="p-7">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: accent }}>
          <Icon className="h-4 w-4" /> {t('finalGift')}
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-letter)] text-4xl font-semibold leading-[1.05]">{v.title}</h2>
        {v.message && <p className="mt-4 whitespace-pre-wrap font-[family-name:var(--font-letter)] text-xl italic leading-relaxed opacity-90">{v.message}</p>}
      </div>
      {/* Linea tratteggiata con i semicerchi, come un biglietto */}
      <div aria-hidden className="relative h-6">
        <span className="absolute -left-3 top-0 h-6 w-6 rounded-full bg-black/70" />
        <span className="absolute -right-3 top-0 h-6 w-6 rounded-full bg-black/70" />
        <span className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-current opacity-20" />
      </div>
      <div className="space-y-3 p-7 pt-3">
        {v.howToUse && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">{t('howToUseTitle')}</p>
            <p className="mt-1 whitespace-pre-wrap text-base">{v.howToUse}</p>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-2">
          {v.validUntil ? (
            <p className="text-sm opacity-70">
              {t('validUntilView', { date: new Date(v.validUntil + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
            </p>
          ) : (
            <span />
          )}
          {view.senderName && <p className="font-[family-name:var(--font-letter)] text-2xl italic">— {view.senderName}</p>}
        </div>
      </div>
    </article>
  )
}

function ReplyForm({ token, senderName, accent }: { token: string; senderName: string; accent: string }) {
  const t = useTranslations('surprise')
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const [message, setMessage] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reaction && !message.trim() && !photo) return
    setState('busy')
    const form = new FormData()
    if (reaction) form.set('reaction', reaction)
    form.set('message', message)
    if (photo) form.set('photo', (await resizeImageFile(photo, 1600, 0.82)) ?? photo)
    const r = await sendSurpriseReply(token, form)
    setState(r.ok ? 'sent' : 'error')
  }
  if (state === 'sent') {
    return (
      <div className="rounded-3xl bg-white/10 p-6 text-center text-white backdrop-blur" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10" style={{ color: accent }} />
        <p className="mt-2 text-lg font-semibold">{t('replySent', { name: senderName || '—' })}</p>
      </div>
    )
  }
  return (
    <form onSubmit={send} className="rounded-3xl bg-white p-6 text-gray-800 shadow-2xl">
      <h3 className="font-[family-name:var(--font-letter)] text-3xl font-semibold text-gray-900">{t('replyTitle', { name: senderName || '—' })}</h3>
      <p className="mt-1 text-sm text-gray-600">{t('replyText')}</p>
      <div className="mt-4 grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('replyReaction')}>
        {REACTIONS.map((r) => {
          const Icon = REACTION_ICON[r]
          const on = reaction === r
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setReaction(on ? null : r)}
              className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 text-xs font-semibold transition-colors ${on ? 'text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              style={on ? { background: accent, borderColor: accent } : undefined}
            >
              <Icon className="h-6 w-6" /> {t(`reaction_${r}`)}
            </button>
          )
        })}
      </div>
      <label className="mt-4 block text-sm font-semibold text-gray-700" htmlFor="reply-msg">
        {t('replyMessage')}
      </label>
      <textarea id="reply-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <Camera className="h-4 w-4" /> {photo ? photo.name.slice(0, 24) : t('replyPhoto')}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
        <button
          type="submit"
          disabled={state === 'busy' || (!reaction && !message.trim() && !photo)}
          className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-5 font-bold text-white disabled:opacity-50"
          style={{ background: accent }}
        >
          {state === 'busy' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t('replySend')}
        </button>
      </div>
      {state === 'error' && <p className="mt-2 text-sm font-semibold text-red-600">{t('replyError')}</p>}
    </form>
  )
}

const openedKey = (token: string) => `kumani_surprise_opened_${token}`

export default function SurpriseExperience({ view, preview = false, editorHref, token }: { view: SurpriseView; preview?: boolean; editorHref?: string; token?: string }) {
  const t = useTranslations('surprise')
  const style = THEME_STYLE[view.theme]
  const occasion = OCCASION_STYLE[view.occasion]
  const Icon = OCCASION_ICON[view.occasion]
  const accent = style.accent
  const [opened, setOpened] = useState<boolean | null>(preview ? true : null)
  // Indovinelli risolti in questa visita (il resto arriva dal server)
  const [solved, setSolved] = useState<Record<string, SurpriseViewStep>>({})
  const steps = view.steps.map((s) => solved[s.id] ?? s)
  const [burst, setBurst] = useState(0)
  const [playing, setPlaying] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (preview) return
    let seen = false
    try {
      seen = !!token && localStorage.getItem(openedKey(token)) === '1'
    } catch {
      // memoria del browser non disponibile: si mostra l'apertura
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la memoria del browser si legge solo nel browser
    setOpened(seen)
  }, [preview, token])

  const stopMusic = useCallback(() => {
    audio.current?.pause()
    setPlaying(false)
  }, [])

  const startMusic = useCallback(() => {
    if (!view.music) return
    // Brano scelto (registrazione vera su R2) oppure l'audio di chi regala
    const src = view.music === 'own' ? view.musicUrl : audioUrl(musicFile(view.music))
    if (!src) return
    if (!audio.current) {
      audio.current = new Audio(src)
      audio.current.loop = true
      audio.current.volume = 0.6
    }
    audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [view.music, view.musicUrl])

  useEffect(() => () => stopMusic(), [stopMusic])

  const open = () => {
    setOpened(true)
    setBurst((b) => b + 1)
    startMusic()
    try {
      if (token) localStorage.setItem(openedKey(token), '1')
    } catch {
      // nulla da fare
    }
  }

  const v = view.voucher
  const openDays = steps.filter((s) => s.open).length

  return (
    <div className={`${letterFont.variable} relative min-h-screen overflow-hidden bg-gradient-to-b ${style.bg} px-4 pb-20 pt-8 text-white`}>
      {/* Luci di sfondo e icona dell'occasione */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full opacity-30 blur-3xl" style={{ background: accent }} />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: accent }} />
        <Icon className="absolute right-6 top-24 h-24 w-24 rotate-12 opacity-[0.06]" />
        <Icon className="absolute bottom-40 left-4 h-16 w-16 -rotate-12 opacity-[0.05]" />
      </div>
      <Celebration kind={occasion.particles} trigger={burst} />

      {view.music && opened && (
        <button
          type="button"
          onClick={() => (playing ? stopMusic() : startMusic())}
          aria-label={playing ? t('musicOff') : t('musicOn')}
          title={playing ? t('musicOff') : t('musicOn')}
          className="fixed right-4 top-4 z-40 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
        >
          {playing ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      )}

      {preview && (
        <div className="relative mx-auto mb-6 flex max-w-xl flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm backdrop-blur">
          <span>{t('previewBanner')}</span>
          {editorHref && (
            <Link href={editorHref} className="font-semibold underline underline-offset-4">
              {t('backToEditor')}
            </Link>
          )}
        </div>
      )}

      <div className="relative mx-auto max-w-xl">
        <header className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur" style={{ color: accent }}>
            <Icon className="h-7 w-7" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">{t(`occasionTitle_${view.occasion}`)}</p>
          <h1 className="mt-2 font-[family-name:var(--font-letter)] text-5xl font-semibold leading-tight">{view.recipientName || '…'}</h1>
          {view.senderName && <p className="mt-1 font-[family-name:var(--font-letter)] text-xl italic text-white/80">{t('viewFrom', { name: view.senderName })}</p>}
        </header>

        {opened === null ? (
          <div className="h-72" />
        ) : !opened ? (
          <div className="mt-12">
            <Reveal style={view.revealStyle} accent={accent} Icon={Icon} name={view.recipientName} onOpen={open} />
          </div>
        ) : (
          <div className="mt-10 space-y-5">
            {view.kind !== 'voucher' && (
              <div className="rounded-2xl bg-white/[0.07] p-4 backdrop-blur">
                <p className="text-center text-sm text-white/80">{t('journeyIntro', { days: view.days })}</p>
                {/* Avanzamento del percorso: un pallino per tappa, il regalo alla fine */}
                <ol className="mt-3 flex items-center justify-center gap-2" aria-label={t('progressLabel', { open: openDays, total: steps.length })}>
                  {steps.map((s) => (
                    <li key={s.id} className="h-2.5 w-2.5 rounded-full" style={{ background: s.open ? accent : 'rgba(255,255,255,0.25)' }} />
                  ))}
                  <li>
                    <Gift className="h-4 w-4" style={{ color: v.open ? accent : 'rgba(255,255,255,0.35)' }} />
                  </li>
                </ol>
              </div>
            )}

            {steps.map((step) => (
              <StepCard
                key={step.id}
                step={step}
                accent={accent}
                token={preview ? undefined : token}
                onSolved={(solvedStep) => {
                  setSolved((prev) => ({ ...prev, [solvedStep.id]: solvedStep }))
                  setBurst((b) => b + 1)
                }}
              />
            ))}

            {v.open ? (
              <Ticket view={view} accent={accent} Icon={Icon} />
            ) : (
              <div className="rounded-3xl border-2 border-dashed border-white/25 p-7 text-center">
                <Gift className="mx-auto h-10 w-10" style={{ color: accent }} />
                <p className="mt-3 font-[family-name:var(--font-letter)] text-2xl font-semibold">{view.kind === 'voucher' ? t('voucherLocked') : t('finalLocked')}</p>
                <p className="mt-1 text-sm text-white/80">
                  {t('opensIn')} <Countdown to={v.unlockAt} />
                </p>
              </div>
            )}

            {v.open && token && !preview && <ReplyForm token={token} senderName={view.senderName} accent={accent} />}
          </div>
        )}

        <p className="mt-14 text-center text-xs text-white/60">
          {t('madeWith')}{' '}
          <Link href="/sorprese" className="font-semibold text-white/85 underline underline-offset-4">
            {t('madeWithCta')}
          </Link>
        </p>
      </div>
    </div>
  )
}
