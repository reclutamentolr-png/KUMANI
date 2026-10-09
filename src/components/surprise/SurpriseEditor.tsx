'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarHeart, Eye, Gift, ImagePlus, LoaderCircle, Lock, Mic, Plus, Route, Save, Trash2, Video, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/resizeImage'
import { askConfirm } from '@/lib/confirm'
import { deleteSurprise, deleteSurpriseStep, saveSurprise, saveSurpriseStep } from '@/app/actions/surprise'
import { SURPRISE_KINDS, SURPRISE_MAX, SURPRISE_THEMES, THEME_STYLE, surpriseDays, type SurpriseKind, type SurpriseRow, type SurpriseStepRow, type SurpriseTheme } from '@/lib/surprise'

type MediaType = 'image' | 'video' | 'audio'
const KIND_ICON: Record<SurpriseKind, typeof Gift> = { voucher: Gift, journey3: Route, journey7: CalendarHeart }
const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'

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
  const { error } = await supabase.storage.from('surprise-media').upload(path, upload, { contentType: upload.type || undefined, upsert: false })
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

type StepDraft = { id?: string; day: number; title: string; message: string; hint: string; mediaPath: string | null; mediaType: MediaType | null; mediaUrl: string | null }

function StepForm({ userId, giftId, days, initial, onClose }: { userId: string; giftId: string; days: number; initial: StepDraft; onClose: (saved: boolean) => void }) {
  const t = useTranslations('surprise')
  const [step, setStep] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    const r = await uploadMedia(userId, giftId, file)
    setBusy(false)
    if ('error' in r) return setError(t(r.error))
    setStep((s) => ({ ...s, mediaPath: r.path, mediaType: r.type, mediaUrl: r.url }))
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const r = await saveSurpriseStep(giftId, { id: step.id, day: step.day, title: step.title, message: step.message, hint: step.hint, mediaPath: step.mediaPath, mediaType: step.mediaType })
    setBusy(false)
    if (!r.success) return setError(r.limitText ?? t(`error_${r.message}`))
    onClose(true)
  }

  return (
    <div className="space-y-3 rounded-2xl border-2 border-[var(--gold)]/50 bg-[var(--gold-pale)]/30 p-4">
      <label className="block">
        <span className={label}>{t('stepDay')}</span>
        <select value={step.day} onChange={(e) => setStep((s) => ({ ...s, day: Number(e.target.value) }))} className={input}>
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {t('day', { day: d })}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>{t('stepTitleLabel')}</span>
        <input value={step.title} maxLength={SURPRISE_MAX.stepTitle} onChange={(e) => setStep((s) => ({ ...s, title: e.target.value }))} className={input} />
      </label>
      <label className="block">
        <span className={label}>{t('stepMessageLabel')}</span>
        <textarea value={step.message} maxLength={SURPRISE_MAX.stepMessage} rows={4} onChange={(e) => setStep((s) => ({ ...s, message: e.target.value }))} className={input} />
      </label>
      <label className="block">
        <span className={label}>{t('stepHintLabel')}</span>
        <input value={step.hint} maxLength={SURPRISE_MAX.hint} placeholder={t('stepHintPlaceholder')} onChange={(e) => setStep((s) => ({ ...s, hint: e.target.value }))} className={input} />
      </label>
      <div>
        <span className={label}>{t('stepMedia')}</span>
        {step.mediaUrl ? (
          <div className="space-y-2">
            <MediaPreview url={step.mediaUrl} type={step.mediaType} />
            <button type="button" onClick={() => setStep((s) => ({ ...s, mediaPath: null, mediaType: null, mediaUrl: null }))} className="inline-flex items-center gap-1 text-sm font-semibold text-red-600">
              <X className="h-4 w-4" /> {t('removeMedia')}
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-white px-3 py-4 text-sm font-semibold text-gray-600 hover:border-[var(--gold)]">
            <ImagePlus className="h-5 w-5" /> <Video className="h-5 w-5" /> <Mic className="h-5 w-5" /> {t('addMedia')}
            <input type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        )}
        <p className="mt-1 text-xs text-gray-500">{t('mediaHint')}</p>
      </div>
      {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onClose(false)} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          {t('cancel')}
        </button>
        <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('saveStep')}
        </button>
      </div>
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
  const [form, setForm] = useState({
    kind: gift.kind,
    theme: gift.theme,
    recipientName: gift.recipient_name,
    senderName: gift.sender_name,
    title: gift.title,
    message: gift.message,
    howToUse: gift.how_to_use,
    validUntil: gift.valid_until ?? '',
    startAt: toLocalInput(gift.start_at),
    coverPath: gift.cover_path,
  })
  const [coverUrl, setCoverUrl] = useState<string | null>(gift.cover_path ? (mediaUrls[gift.cover_path] ?? null) : null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [editing, setEditing] = useState<StepDraft | null>(null)
  const days = surpriseDays(form.kind)
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)

  const dirty = useMemo(
    () =>
      form.kind !== gift.kind ||
      form.theme !== gift.theme ||
      form.recipientName !== gift.recipient_name ||
      form.senderName !== gift.sender_name ||
      form.title !== gift.title ||
      form.message !== gift.message ||
      form.howToUse !== gift.how_to_use ||
      form.validUntil !== (gift.valid_until ?? '') ||
      form.startAt !== toLocalInput(gift.start_at) ||
      form.coverPath !== gift.cover_path,
    [form, gift]
  )

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    setBusy(true)
    setNotice(null)
    const r = await saveSurprise(gift.id, { ...form, startAt: form.startAt ? new Date(form.startAt).toISOString() : null })
    setBusy(false)
    if (!r.success) return setNotice({ ok: false, text: t(`error_${r.message}`) })
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
                className={`rounded-xl border-2 p-3 text-left transition-colors disabled:cursor-not-allowed ${selected ? 'border-[var(--gold)] bg-[var(--gold-pale)]/50' : 'border-gray-200 hover:border-[var(--gold)]/60'} ${active && !selected ? 'opacity-40' : ''}`}
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
                className="inline-flex items-center gap-1 text-sm font-semibold text-red-600"
              >
                <X className="h-4 w-4" /> {t('removeMedia')}
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-3 py-4 text-sm font-semibold text-gray-600 hover:border-[var(--gold)]">
              <ImagePlus className="h-5 w-5" /> {t('uploadPhoto')}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickCover(e.target.files?.[0])} />
            </label>
          )}
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
                title={t(`theme_${theme}`)}
                className={`h-10 w-10 rounded-full border-4 ${form.theme === theme ? 'border-[var(--ink)]' : 'border-white shadow'}`}
                style={{ background: THEME_STYLE[theme].accent }}
              />
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500">{t('mediaRights')}</p>
      </section>

      {/* Salva */}
      <div className="sticky bottom-20 z-20 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-4">
        {notice && <p className={`mr-auto text-sm font-semibold ${notice.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{notice.text}</p>}
        <Link href={`/sorprese/${gift.id}/anteprima`} className={`inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 ${dirty ? 'pointer-events-none opacity-50' : ''}`}>
          <Eye className="h-4 w-4" /> {t('preview')}
        </Link>
        <button type="button" onClick={save} disabled={busy || !dirty} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 font-bold text-[var(--ink)] shadow disabled:opacity-50">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('save')}
        </button>
      </div>

      {/* Tappe del percorso */}
      {form.kind !== 'voucher' && (
        <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--ink)]">{t('stepsTitle')}</h2>
          <p className="text-sm text-gray-600">{t('stepsHint', { days })}</p>
          {sortedSteps.length === 0 && !editing && <p className="rounded-xl bg-gray-50 px-4 py-4 text-center text-sm text-gray-500">{t('noSteps')}</p>}
          {sortedSteps.map((s) =>
            editing?.id === s.id ? (
              <StepForm
                key={s.id}
                userId={userId}
                giftId={gift.id}
                days={days}
                initial={editing}
                onClose={(saved) => {
                  setEditing(null)
                  if (saved) router.refresh()
                }}
              />
            ) : (
              <div key={s.id} className="flex items-start gap-3 rounded-xl border border-gray-200 p-3">
                <span className="shrink-0 rounded-lg bg-[var(--ink)] px-2 py-1 text-xs font-bold text-[var(--gold-bright)]">{t('day', { day: Math.min(s.day, days) })}</span>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      id: s.id,
                      day: Math.min(s.day, days),
                      title: s.title,
                      message: s.message,
                      hint: s.hint,
                      mediaPath: s.media_path,
                      mediaType: s.media_type,
                      mediaUrl: s.media_path ? (mediaUrls[s.media_path] ?? null) : null,
                    })
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate font-semibold text-[var(--ink)]">{s.title || s.message.slice(0, 60) || t('untitledStep')}</span>
                  <span className="block text-xs text-gray-500">
                    {[s.media_type ? t(`media_${s.media_type}`) : '', s.hint ? t('withHint') : '', s.day > days ? t('stepOutOfRange') : ''].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <button type="button" onClick={() => removeStep(s.id)} aria-label={t('deleteStep')} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          )}
          {editing && !editing.id ? (
            <StepForm
              userId={userId}
              giftId={gift.id}
              days={days}
              initial={editing}
              onClose={(saved) => {
                setEditing(null)
                if (saved) router.refresh()
              }}
            />
          ) : (
            !editing && (
              <button
                type="button"
                onClick={() =>
                  setEditing({ day: Math.min(days, (sortedSteps.at(-1)?.day ?? 0) + 1), title: '', message: '', hint: '', mediaPath: null, mediaType: null, mediaUrl: null })
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--gold)]/60 px-4 py-3 font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]/40"
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
          <button type="button" onClick={removeDraft} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline">
            <Trash2 className="h-4 w-4" /> {t('deleteDraft')}
          </button>
        </div>
      )}
    </div>
  )
}
