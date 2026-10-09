'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  CalendarHeart,
  Eye,
  Gift,
  HelpCircle,
  Images,
  ImagePlus,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  MessageSquareText,
  Music2,
  Pause,
  Play,
  Plus,
  Route,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  VolumeX,
  X,
  type LucideIcon,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/resizeImage'
import { askConfirm } from '@/lib/confirm'
import { audioUrl } from '@/lib/audioUrl'
import { deleteSurprise, deleteSurpriseStep, saveSurprise, saveSurpriseStep } from '@/app/actions/surprise'
import {
  GALLERY_MAX,
  MUSIC_TRACKS,
  musicFile,
  OCCASION_STYLE,
  REVEAL_STYLES,
  STEP_KINDS,
  SURPRISE_KINDS,
  SURPRISE_MAX,
  SURPRISE_OCCASIONS,
  SURPRISE_THEMES,
  THEME_STYLE,
  stepIncomplete,
  surpriseDays,
  type MusicTrack,
  type RevealStyle,
  type StepExtra,
  type StepKind,
  type SurpriseKind,
  type SurpriseMusic,
  type SurpriseOccasion,
  type SurpriseRow,
  type SurpriseStepRow,
  type SurpriseTheme,
} from '@/lib/surprise'
import { OCCASION_ICON } from './SurpriseExperience'
import VoiceRecorder from './VoiceRecorder'

type MediaType = 'image' | 'video' | 'audio'
const KIND_ICON: Record<SurpriseKind, LucideIcon> = { voucher: Gift, journey3: Route, journey7: CalendarHeart }
const REVEAL_ICON: Record<RevealStyle, LucideIcon> = { box: Gift, envelope: Mail, scratch: Sparkles }
const STEP_ICON: Record<StepKind, LucideIcon> = { message: MessageSquareText, gallery: Images, riddle: HelpCircle, place: MapPin, song: Music2 }
const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'
const card = (on: boolean) =>
  `flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 p-3 text-center text-sm transition-colors ${on ? 'border-[var(--gold)] bg-[var(--gold-pale)]/60 font-bold text-[var(--ink)]' : 'border-gray-200 text-gray-700 hover:border-[var(--gold)]/60'}`

// Data e ora locali per <input type="datetime-local">
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function mediaTypeOf(file: File): MediaType | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

// Carica un file nella cartella della sorpresa (foto ridotte prima)
async function uploadMedia(userId: string, giftId: string, file: File): Promise<{ path: string; type: MediaType; url: string } | { error: string }> {
  const type = mediaTypeOf(file)
  if (!type) return { error: 'error_fileType' }
  let upload: File = file
  if (type === 'image') upload = (await resizeImageFile(file, 1600, 0.82)) ?? file
  if (upload.size > SURPRISE_MAX.mediaBytes) return { error: 'error_tooBig' }
  const ext = type === 'image' ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
  const path = `${userId}/${giftId}/${crypto.randomUUID()}.${ext}`
  const supabase = createClient()
  const { error } = await supabase.storage.from('surprise-media').upload(path, upload, { contentType: upload.type.split(';')[0] || undefined, upsert: false })
  if (error) return { error: /row-level|policy|quota/i.test(error.message) ? 'error_filesLimit' : /size|large/i.test(error.message) ? 'error_tooBig' : 'error_uploadError' }
  const { data } = await supabase.storage.from('surprise-media').createSignedUrl(path, 3600)
  return { path, type, url: data?.signedUrl ?? '' }
}

function MediaPreview({ url, type }: { url: string; type: MediaType | null }) {
  if (type === 'video') return <video src={url} controls playsInline className="max-h-56 w-full rounded-xl bg-black" />
  if (type === 'audio') return <audio src={url} controls className="w-full" />
  // eslint-disable-next-line @next/next/no-img-element -- link firmato temporaneo
  return <img src={url} alt="" className="max-h-80 w-full rounded-xl bg-gray-100 object-contain" />
}

type StepDraft = {
  id?: string
  day: number
  kind: StepKind
  title: string
  message: string
  hint: string
  mediaPath: string | null
  mediaType: MediaType | null
  mediaUrl: string | null
  gallery: { path: string; url: string }[]
  extra: StepExtra
  riddleAnswer: string
}

function StepForm({ userId, giftId, days, initial, onClose }: { userId: string; giftId: string; days: number; initial: StepDraft; onClose: (saved: boolean) => void }) {
  const t = useTranslations('surprise')
  const [step, setStep] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof StepDraft>(key: K, value: StepDraft[K]) => setStep((s) => ({ ...s, [key]: value }))
  const setExtra = (key: keyof StepExtra, value: string) => setStep((s) => ({ ...s, extra: { ...s.extra, [key]: value } }))

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    const r = await uploadMedia(userId, giftId, file)
    setBusy(false)
    if ('error' in r) return setError(t(r.error))
    setStep((s) => ({ ...s, mediaPath: r.path, mediaType: r.type, mediaUrl: r.url }))
  }

  const pickGallery = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    const room = GALLERY_MAX - step.gallery.length
    const added: { path: string; url: string }[] = []
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith('image/')) continue
      const r = await uploadMedia(userId, giftId, file)
      if ('error' in r) {
        setError(t(r.error))
        break
      }
      added.push({ path: r.path, url: r.url })
    }
    setBusy(false)
    setStep((s) => ({ ...s, gallery: [...s.gallery, ...added].slice(0, GALLERY_MAX) }))
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const r = await saveSurpriseStep(giftId, {
      id: step.id,
      day: step.day,
      kind: step.kind,
      title: step.title,
      message: step.message,
      hint: step.hint,
      mediaPath: step.mediaPath,
      mediaType: step.mediaType,
      gallery: step.gallery.map((g) => g.path),
      extra: step.extra,
      riddleAnswer: step.riddleAnswer,
    })
    setBusy(false)
    if (!r.success) return setError(r.limitText ?? t(`error_${r.message}`))
    onClose(true)
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-[var(--gold)]/50 bg-[var(--gold-pale)]/30 p-4">
      <div>
        <span className={label}>{t('stepKindLabel')}</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup">
          {STEP_KINDS.map((k) => {
            const Icon = STEP_ICON[k]
            return (
              <button key={k} type="button" role="radio" aria-checked={step.kind === k} onClick={() => set('kind', k)} className={card(step.kind === k)}>
                <Icon className="h-5 w-5 text-[var(--gold)]" /> {t(`stepKind_${k}`)}
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-gray-500">{t(`stepKindHint_${step.kind}`)}</p>
      </div>
      <label className="block">
        <span className={label}>{t('stepDay')}</span>
        <select value={step.day} onChange={(e) => set('day', Number(e.target.value))} className={input}>
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {t('day', { day: d })}
            </option>
          ))}
        </select>
      </label>

      {step.kind === 'riddle' && (
        <div className="space-y-3 rounded-xl bg-white p-3">
          <label className="block">
            <span className={label}>{t('riddleQuestionLabel')} *</span>
            <input value={step.extra.question ?? ''} maxLength={SURPRISE_MAX.question} placeholder={t('riddleQuestionPlaceholder')} onChange={(e) => setExtra('question', e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>{t('riddleAnswerLabel')} *</span>
            <input value={step.riddleAnswer} maxLength={SURPRISE_MAX.answer} placeholder={t('riddleAnswerPlaceholder')} onChange={(e) => set('riddleAnswer', e.target.value)} className={input} />
            <span className="mt-1 block text-xs text-gray-500">{t('riddleAnswerHint')}</span>
          </label>
          <p className="text-xs font-semibold text-gray-600">{t('riddleContentNote')}</p>
        </div>
      )}

      <label className="block">
        <span className={label}>{t('stepTitleLabel')}</span>
        <input value={step.title} maxLength={SURPRISE_MAX.stepTitle} onChange={(e) => set('title', e.target.value)} className={input} />
      </label>
      <label className="block">
        <span className={label}>{t('stepMessageLabel')}</span>
        <textarea value={step.message} maxLength={SURPRISE_MAX.stepMessage} rows={4} onChange={(e) => set('message', e.target.value)} className={input} />
      </label>

      {step.kind === 'place' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t('placeNameLabel')}</span>
            <input value={step.extra.placeName ?? ''} maxLength={SURPRISE_MAX.place} placeholder={t('placeNamePlaceholder')} onChange={(e) => setExtra('placeName', e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>{t('placeAddressLabel')}</span>
            <input value={step.extra.placeAddress ?? ''} maxLength={SURPRISE_MAX.place} placeholder={t('placeAddressPlaceholder')} onChange={(e) => setExtra('placeAddress', e.target.value)} className={input} />
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>{t('mapUrlLabel')}</span>
            <input value={step.extra.mapUrl ?? ''} maxLength={SURPRISE_MAX.link} inputMode="url" placeholder="https://maps.app.goo.gl/…" onChange={(e) => setExtra('mapUrl', e.target.value)} className={input} />
          </label>
        </div>
      )}

      {step.kind === 'song' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t('songTitleLabel')}</span>
            <input value={step.extra.songTitle ?? ''} maxLength={SURPRISE_MAX.place} placeholder={t('songTitlePlaceholder')} onChange={(e) => setExtra('songTitle', e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>{t('songUrlLabel')} *</span>
            <input value={step.extra.songUrl ?? ''} maxLength={SURPRISE_MAX.link} inputMode="url" placeholder="https://open.spotify.com/…" onChange={(e) => setExtra('songUrl', e.target.value)} className={input} />
          </label>
        </div>
      )}

      {step.kind === 'gallery' ? (
        <div>
          <span className={label}>{t('galleryLabelEdit', { max: GALLERY_MAX })}</span>
          <div className="grid grid-cols-3 gap-2">
            {step.gallery.map((g) => (
              <div key={g.path} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- link firmato temporaneo */}
                <img src={g.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => set('gallery', step.gallery.filter((x) => x.path !== g.path))}
                  aria-label={t('removeMedia')}
                  className="absolute right-1 top-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {step.gallery.length < GALLERY_MAX && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-white text-xs font-semibold text-gray-600 hover:border-[var(--gold)]">
                <ImagePlus className="h-6 w-6" /> {t('addPhotos')}
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => pickGallery(e.target.files)} />
              </label>
            )}
          </div>
        </div>
      ) : (
        <div>
          <span className={label}>{t('stepMedia')}</span>
          {step.mediaUrl ? (
            <div className="space-y-2">
              <MediaPreview url={step.mediaUrl} type={step.mediaType} />
              <button type="button" onClick={() => setStep((s) => ({ ...s, mediaPath: null, mediaType: null, mediaUrl: null }))} className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-red-600">
                <X className="h-4 w-4" /> {t('removeMedia')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 text-sm font-semibold text-gray-600 hover:border-[var(--gold)]">
                <Upload className="h-4 w-4" /> {t('addMedia')}
                <input type="file" accept="image/*,video/*,audio/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              </label>
              <VoiceRecorder disabled={busy} onRecorded={(f) => pick(f)} />
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">{t('mediaHint')}</p>
        </div>
      )}

      <label className="block">
        <span className={label}>{t('stepHintLabel')}</span>
        <input value={step.hint} maxLength={SURPRISE_MAX.hint} placeholder={t('stepHintPlaceholder')} onChange={(e) => set('hint', e.target.value)} className={input} />
      </label>
      {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onClose(false)} className="min-h-11 cursor-pointer rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          {t('cancel')}
        </button>
        <button type="button" onClick={save} disabled={busy} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-white disabled:opacity-50">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('saveStep')}
        </button>
      </div>
    </div>
  )
}

function MusicPicker({
  value,
  ownUrl,
  userId,
  giftId,
  onChange,
}: {
  value: SurpriseMusic | null
  ownUrl: string | null
  userId: string
  giftId: string
  onChange: (music: SurpriseMusic | null, path?: string | null, url?: string | null) => void
}) {
  const t = useTranslations('surprise')
  const [playing, setPlaying] = useState<MusicTrack | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Con «Nessuna musica» l'elenco si chiude e lascia solo una riga
  const [open, setOpen] = useState(value !== null)
  const player = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => player.current?.pause(), [])

  // Ascolto di prova del brano (si ferma da solo dopo 20 secondi)
  const preview = (track: MusicTrack) => {
    player.current?.pause()
    if (playing === track) return setPlaying(null)
    const audio = new Audio(audioUrl(musicFile(track)))
    audio.volume = 0.7
    audio.ontimeupdate = () => {
      if (audio.currentTime > 20) {
        audio.pause()
        setPlaying(null)
      }
    }
    audio.onended = () => setPlaying(null)
    player.current = audio
    audio.play().then(() => setPlaying(track)).catch(() => setPlaying(null))
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('audio/')) return setError(t('error_fileType'))
    setBusy(true)
    setError(null)
    const r = await uploadMedia(userId, giftId, file)
    setBusy(false)
    if ('error' in r) return setError(t(r.error))
    onChange('own', r.path, r.url)
  }

  // (se una musica torna scelta, per esempio con «Annulla», l'elenco si riapre)
  if (!open && value === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <VolumeX className="h-4 w-4 text-gray-400" /> {t('musicNone')}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-[var(--ink)] hover:border-[var(--gold)]"
        >
          <Music2 className="h-4 w-4 text-[var(--gold)]" /> {t('musicAdd')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            player.current?.pause()
            setPlaying(null)
            onChange(null)
            setOpen(false)
          }}
          className={`${card(!value)} !flex-row !justify-start`}
        >
          <VolumeX className="h-4 w-4 text-gray-400" /> {t('musicNone')}
        </button>
        {MUSIC_TRACKS.map((track) => (
          <div key={track} className={`${card(value === track)} !flex-row !justify-between`}>
            <button type="button" onClick={() => onChange(track)} className="min-h-8 flex-1 cursor-pointer text-left">
              {t(`music_${track}`)}
            </button>
            <button
              type="button"
              onClick={() => preview(track)}
              aria-label={playing === track ? t('musicStopPreview') : t('musicPreview')}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--ink)] text-white"
            >
              {playing === track ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </div>
        ))}
      </div>
      <div className={`${card(value === 'own')} !items-stretch !text-left`}>
        <span className="font-semibold">{t('musicOwn')}</span>
        <span className="text-xs font-normal text-gray-500">{t('musicOwnHint')}</span>
        {value === 'own' && ownUrl && <audio src={ownUrl} controls className="mt-2 w-full" />}
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:border-[var(--gold)]">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {t('musicUpload')}
            <input type="file" accept="audio/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <VoiceRecorder disabled={busy} onRecorded={(f) => upload(f)} />
        </div>
      </div>
      {error && <p className="text-sm font-semibold text-amber-700">{error}</p>}
      <p className="text-xs text-gray-500">{t('musicNote')}</p>
    </div>
  )
}

export default function SurpriseEditor({
  userId,
  gift,
  steps,
  mediaUrls,
  prices,
}: {
  userId: string
  gift: SurpriseRow
  steps: SurpriseStepRow[]
  mediaUrls: Record<string, string>
  prices: Record<SurpriseKind, number>
}) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  const router = useRouter()
  const active = gift.status === 'active'
  const initial = {
    kind: gift.kind,
    theme: gift.theme,
    occasion: gift.occasion ?? 'generic',
    revealStyle: gift.reveal_style ?? 'box',
    music: gift.music ?? null,
    musicPath: gift.music_path ?? null,
    recipientName: gift.recipient_name,
    senderName: gift.sender_name,
    title: gift.title,
    message: gift.message,
    howToUse: gift.how_to_use,
    validUntil: gift.valid_until ?? '',
    startAt: toLocalInput(gift.start_at),
    coverPath: gift.cover_path,
  }
  const [form, setForm] = useState(initial)
  // Ultima versione salvata: dopo «Salva» il modulo risulta subito salvato
  // (Anteprima attiva) anche se il server ripulisce i testi
  const [saved, setSaved] = useState(initial)
  const [coverUrl, setCoverUrl] = useState<string | null>(gift.cover_path ? (mediaUrls[gift.cover_path] ?? null) : null)
  const [musicUrl, setMusicUrl] = useState<string | null>(gift.music_path ? (mediaUrls[gift.music_path] ?? null) : null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [editing, setEditing] = useState<StepDraft | null>(null)
  const days = surpriseDays(form.kind)
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Scelta dell'occasione: colori e musica consigliati (la musica propria resta)
  const chooseOccasion = (occasion: SurpriseOccasion) =>
    setForm((f) => ({ ...f, occasion, theme: OCCASION_STYLE[occasion].theme, music: f.music === 'own' ? f.music : OCCASION_STYLE[occasion].music }))

  const save = async () => {
    setBusy(true)
    setNotice(null)
    const r = await saveSurprise(gift.id, { ...form, startAt: form.startAt ? new Date(form.startAt).toISOString() : null })
    setBusy(false)
    if (!r.success) return setNotice({ ok: false, text: t(`error_${r.message}`) })
    setSaved(form)
    setNotice({ ok: true, text: t('saved') })
    router.refresh()
  }

  const pickCover = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setNotice({ ok: false, text: t('error_fileType') })
    setBusy(true)
    const r = await uploadMedia(userId, gift.id, file)
    setBusy(false)
    if ('error' in r) return setNotice({ ok: false, text: t(r.error) })
    set('coverPath', r.path)
    setCoverUrl(r.url)
  }

  const removeStep = async (id: string) => {
    if (!(await askConfirm(t('deleteStepConfirm')))) return
    await deleteSurpriseStep(id)
    router.refresh()
  }

  const removeDraft = async () => {
    if (!(await askConfirm(t('deleteDraftConfirm')))) return
    const r = await deleteSurprise(gift.id)
    if (!r.success) return setNotice({ ok: false, text: t(`error_${r.message}`) })
    router.push(`${locale === 'it' ? '' : `/${locale}`}/sorprese`)
  }

  const sortedSteps = [...steps].sort((a, b) => a.day - b.day || a.position - b.position)
  const draftOf = (s: SurpriseStepRow): StepDraft => ({
    id: s.id,
    day: Math.min(s.day, days),
    kind: s.kind ?? 'message',
    title: s.title,
    message: s.message,
    hint: s.hint,
    mediaPath: s.media_path,
    mediaType: s.media_type,
    mediaUrl: s.media_path ? (mediaUrls[s.media_path] ?? null) : null,
    gallery: (s.gallery ?? []).map((p) => ({ path: p, url: mediaUrls[p] ?? '' })),
    extra: s.extra ?? {},
    riddleAnswer: s.riddle_answer ?? '',
  })
  const emptyStep = (): StepDraft => ({
    day: Math.min(days, (sortedSteps.at(-1)?.day ?? 0) + 1),
    kind: 'message',
    title: '',
    message: '',
    hint: '',
    mediaPath: null,
    mediaType: null,
    mediaUrl: null,
    gallery: [],
    extra: {},
    riddleAnswer: '',
  })
  const closeStep = (saved: boolean) => {
    setEditing(null)
    if (saved) router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Tipo */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--ink)]">{t('sectionKind')}</h2>
        {active && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
            <Lock className="h-4 w-4" /> {t('lockedKind')}
          </p>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {SURPRISE_KINDS.map((kind) => {
            const Icon = KIND_ICON[kind]
            const selected = form.kind === kind
            return (
              <button
                key={kind}
                type="button"
                disabled={active}
                onClick={() => set('kind', kind)}
                className={`cursor-pointer rounded-xl border-2 p-3 text-left transition-colors disabled:cursor-not-allowed ${selected ? 'border-[var(--gold)] bg-[var(--gold-pale)]/50' : 'border-gray-200 hover:border-[var(--gold)]/60'} ${active && !selected ? 'opacity-40' : ''}`}
              >
                <Icon className="h-5 w-5 text-[var(--gold)]" />
                <span className="mt-1 block font-bold text-[var(--ink)]">{t(`kind_${kind}`)}</span>
                <span className="block text-xs text-gray-500">{t(`kind_${kind}_desc`)}</span>
                <span className="mt-1 block text-sm font-bold">{money(prices[kind])}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Occasione e stile */}
      <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--ink)]">{t('sectionStyle')}</h2>
        <div>
          <span className={label}>{t('occasionLabel')}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t('occasionLabel')}>
            {SURPRISE_OCCASIONS.map((o) => {
              const Icon = OCCASION_ICON[o]
              return (
                <button key={o} type="button" role="radio" aria-checked={form.occasion === o} onClick={() => chooseOccasion(o)} className={card(form.occasion === o)}>
                  <Icon className="h-6 w-6 text-[var(--gold)]" /> {t(`occasion_${o}`)}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <span className={label}>{t('revealLabel')}</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('revealLabel')}>
            {REVEAL_STYLES.map((r) => {
              const Icon = REVEAL_ICON[r]
              return (
                <button key={r} type="button" role="radio" aria-checked={form.revealStyle === r} onClick={() => set('revealStyle', r)} className={card(form.revealStyle === r)}>
                  <Icon className="h-6 w-6 text-[var(--gold)]" /> {t(`reveal_${r}`)}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <span className={label}>{t('themeLabel')}</span>
          <div className="flex flex-wrap gap-2">
            {SURPRISE_THEMES.map((theme: SurpriseTheme) => (
              <button
                key={theme}
                type="button"
                onClick={() => set('theme', theme)}
                aria-label={t(`theme_${theme}`)}
                aria-pressed={form.theme === theme}
                title={t(`theme_${theme}`)}
                className={`h-11 w-11 cursor-pointer rounded-full border-4 ${form.theme === theme ? 'border-[var(--ink)]' : 'border-white shadow'}`}
                style={{ background: THEME_STYLE[theme].accent }}
              />
            ))}
          </div>
        </div>
        <div>
          <span className={label}>{t('musicLabel')}</span>
          <MusicPicker
            value={form.music}
            ownUrl={musicUrl}
            userId={userId}
            giftId={gift.id}
            onChange={(music, path, url) => {
              setForm((f) => ({ ...f, music, musicPath: music === 'own' ? (path ?? f.musicPath) : null }))
              if (url) setMusicUrl(url)
            }}
          />
        </div>
      </section>

      {/* Per chi e il regalo */}
      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--ink)]">{t('sectionGift')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t('recipientLabel')} *</span>
            <input value={form.recipientName} maxLength={SURPRISE_MAX.recipient} placeholder={t('recipientPlaceholder')} onChange={(e) => set('recipientName', e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>{t('senderLabel')}</span>
            <input value={form.senderName} maxLength={SURPRISE_MAX.sender} placeholder={t('senderPlaceholder')} onChange={(e) => set('senderName', e.target.value)} className={input} />
          </label>
        </div>
        <label className="block">
          <span className={label}>{t('titleLabel')} *</span>
          <input value={form.title} maxLength={SURPRISE_MAX.title} placeholder={t('titlePlaceholder')} onChange={(e) => set('title', e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={label}>{t('messageLabel')}</span>
          <textarea value={form.message} maxLength={SURPRISE_MAX.message} rows={4} placeholder={t('messagePlaceholder')} onChange={(e) => set('message', e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={label}>{t('howToUseLabel')}</span>
          <textarea value={form.howToUse} maxLength={SURPRISE_MAX.howToUse} rows={2} placeholder={t('howToUsePlaceholder')} onChange={(e) => set('howToUse', e.target.value)} className={input} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t('validUntilLabel')}</span>
            <input type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>{form.kind === 'voucher' ? t('startLabelVoucher') : t('startLabelJourney')}</span>
            <input type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} className={input} />
            <span className="mt-1 block text-xs text-gray-500">{t('startHint')}</span>
          </label>
        </div>
        <div>
          <span className={label}>{t('coverLabel')}</span>
          {coverUrl ? (
            <div className="space-y-2">
              <MediaPreview url={coverUrl} type="image" />
              <button
                type="button"
                onClick={() => {
                  set('coverPath', null)
                  setCoverUrl(null)
                }}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-red-600"
              >
                <X className="h-4 w-4" /> {t('removeMedia')}
              </button>
            </div>
          ) : (
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-3 py-4 text-sm font-semibold text-gray-600 hover:border-[var(--gold)]">
              <ImagePlus className="h-5 w-5" /> {t('uploadPhoto')}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickCover(e.target.files?.[0])} />
            </label>
          )}
        </div>
        <p className="text-xs text-gray-500">{t('mediaRights')}</p>
      </section>

      {/* Salva */}
      <div className="sticky bottom-20 z-20 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-4">
        {notice && (
          <p role="status" className={`mr-auto text-sm font-semibold ${notice.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
            {notice.text}
          </p>
        )}
        {/* Annulla: torna a quanto salvato l'ultima volta */}
        <button
          type="button"
          onClick={() => {
            setForm(saved)
            setCoverUrl(saved.coverPath ? (mediaUrls[saved.coverPath] ?? coverUrl) : null)
            setMusicUrl(saved.musicPath ? (mediaUrls[saved.musicPath] ?? musicUrl) : null)
            setNotice(null)
          }}
          disabled={busy || !dirty}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:opacity-50"
        >
          <Undo2 className="h-4 w-4" /> {t('cancel')}
        </button>
        <Link href={`/sorprese/${gift.id}/anteprima`} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-semibold hover:bg-gray-50 ${dirty ? 'pointer-events-none opacity-50' : ''}`}>
          <Eye className="h-4 w-4" /> {t('preview')}
        </Link>
        <button type="button" onClick={save} disabled={busy || !dirty} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 font-bold text-[var(--ink)] shadow disabled:opacity-50">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('save')}
        </button>
      </div>

      {/* Tappe del percorso */}
      {form.kind !== 'voucher' && (
        <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--ink)]">{t('stepsTitle')}</h2>
          <p className="text-sm text-gray-600">{t('stepsHint', { days })}</p>
          {sortedSteps.length === 0 && !editing && <p className="rounded-xl bg-gray-50 px-4 py-4 text-center text-sm text-gray-500">{t('noSteps')}</p>}
          {sortedSteps.map((s) => {
            const Icon = STEP_ICON[s.kind ?? 'message']
            return editing?.id === s.id ? (
              <StepForm key={s.id} userId={userId} giftId={gift.id} days={days} initial={editing} onClose={closeStep} />
            ) : (
              <div key={s.id} className="flex items-start gap-3 rounded-xl border border-gray-200 p-3">
                <span className="shrink-0 rounded-lg bg-[var(--ink)] px-2 py-1 text-xs font-bold text-[var(--gold-bright)]">{t('day', { day: Math.min(s.day, days) })}</span>
                <button type="button" onClick={() => setEditing(draftOf(s))} className="min-w-0 flex-1 cursor-pointer text-left">
                  <span className="flex items-center gap-1.5 truncate font-semibold text-[var(--ink)]">
                    <Icon className="h-4 w-4 shrink-0 text-[var(--gold)]" /> {s.title || s.extra?.question || s.message.slice(0, 60) || t('untitledStep')}
                    {stepIncomplete(s) && (
                      <span className="ml-1 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{t('stepIncomplete')}</span>
                    )}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {[
                      t(`stepKind_${s.kind ?? 'message'}`),
                      s.media_type ? t(`media_${s.media_type}`) : '',
                      s.gallery?.length ? t('photosCount', { n: s.gallery.length }) : '',
                      s.hint ? t('withHint') : '',
                      s.day > days ? t('stepOutOfRange') : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
                <button type="button" onClick={() => removeStep(s.id)} aria-label={t('deleteStep')} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}
          {editing && !editing.id ? (
            <StepForm userId={userId} giftId={gift.id} days={days} initial={editing} onClose={closeStep} />
          ) : (
            !editing && (
              <button
                type="button"
                onClick={() => setEditing(emptyStep())}
                className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--gold)]/60 px-4 font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]/40"
              >
                <Plus className="h-5 w-5" /> {t('addStep')}
              </button>
            )
          )}
          {gift.kind !== form.kind && <p className="text-xs text-amber-700">{t('saveKindFirst')}</p>}
        </section>
      )}

      {!active && (
        <div className="text-right">
          <button type="button" onClick={removeDraft} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline">
            <Trash2 className="h-4 w-4" /> {t('deleteDraft')}
          </button>
        </div>
      )}
    </div>
  )
}
