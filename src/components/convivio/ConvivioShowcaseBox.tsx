'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera, CheckCircle2, Clock, ImageOff, LoaderCircle, Megaphone, Trash2, X } from 'lucide-react'
import { cancelShowcase, getShowcaseInfo, removeConvivioPhoto, requestShowcase, uploadConvivioPhoto } from '@/app/actions/kordataShowcase'
import { convivioPhotoUrl, type ShowcaseInfo } from '@/lib/convivio'
import { resizeImageFile } from '@/lib/resizeImage'

// Per capocordata e fornitore confermato: foto del lotto e richiesta di
// comparire nella vetrina della homepage (approvata dallo Staff).
export default function ConvivioShowcaseBox({ groupId, initial, onPhoto }: { groupId: string; initial: ShowcaseInfo; onPhoto: (path: string | null) => void }) {
  const t = useTranslations('kordataShowcase')
  const [info, setInfo] = useState(initial)
  const [busy, setBusy] = useState<'photo' | 'request' | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    const fresh = await getShowcaseInfo(groupId)
    if (fresh) {
      setInfo(fresh)
      onPhoto(fresh.photo_path)
    }
  }

  const pickPhoto = async (picked: File | undefined) => {
    if (!picked) return
    setBusy('photo')
    setNotice(null)
    const file = (await resizeImageFile(picked, 1600, 0.82)) ?? picked
    const form = new FormData()
    form.append('file', file)
    const result = await uploadConvivioPhoto(groupId, form)
    setBusy(null)
    if (fileRef.current) fileRef.current.value = ''
    if (!result.ok) return setNotice({ ok: false, text: t(`error_${result.error}`) })
    await reload()
  }

  const dropPhoto = async () => {
    if (!confirm(t('removePhotoConfirm'))) return
    setBusy('photo')
    const result = await removeConvivioPhoto(groupId)
    setBusy(null)
    if (result !== 'ok') setNotice({ ok: false, text: t(`error_${result}`) })
    await reload()
  }

  const ask = async () => {
    setBusy('request')
    setNotice(null)
    const result = await requestShowcase(groupId)
    setBusy(null)
    setNotice(result === 'ok' ? { ok: true, text: t('requestDone') } : { ok: false, text: t(`error_${result}`) })
    await reload()
  }

  const withdraw = async () => {
    if (!confirm(t('cancelConfirm'))) return
    setBusy('request')
    const result = await cancelShowcase(groupId)
    setBusy(null)
    if (result !== 'ok') setNotice({ ok: false, text: t(`error_${result}`) })
    await reload()
  }

  const photo = convivioPhotoUrl(info.photo_path)
  const reason = info.reason ? t(`reason_${info.reason}`) : ''

  return (
    <div className="rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-br from-[var(--gold-pale)]/50 to-white p-5 shadow-sm">
      <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
        <Megaphone className="h-5 w-5 text-[var(--gold)]" /> {t('boxTitle')}
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('boxIntro')}</p>

      {/* Foto del lotto */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-[var(--gold)]/30 bg-[var(--background)]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-[var(--muted)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--ink)]">{t('photoTitle')}</p>
          <p className="text-xs text-[var(--muted)]">{t('photoHint')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--gold)]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--gold)] disabled:opacity-50"
            >
              {busy === 'photo' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {photo ? t('changePhoto') : t('addPhoto')}
            </button>
            {photo && (
              <button type="button" disabled={busy !== null} onClick={dropPhoto} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" /> {t('removePhoto')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stato della vetrina */}
      <div className="mt-4 border-t border-[var(--gold)]/20 pt-4">
        {info.status === 'requested' ? (
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" /> {t('status_requested')}
          </p>
        ) : info.status === 'approved' ? (
          <p className="flex items-start gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {info.eligible ? t('status_approved') : t('approvedHidden')}
          </p>
        ) : info.status === 'rejected' || info.status === 'removed' ? (
          <p className="text-sm text-red-700">{t(`status_${info.status}`, { reason })}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(info.status === 'none' || info.status === 'rejected' || info.status === 'removed') &&
            (info.eligible ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={ask}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy === 'request' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4 text-[var(--gold-bright)]" />}
                {info.status === 'none' ? t('request') : t('requestAgain')}
              </button>
            ) : (
              <p className="text-xs text-[var(--muted)]">{t('notEligible')}</p>
            ))}
          {(info.status === 'requested' || info.status === 'approved') && (
            <button type="button" disabled={busy !== null} onClick={withdraw} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-black/5 disabled:opacity-50">
              <X className="h-4 w-4" /> {info.status === 'requested' ? t('cancelRequest') : t('cancel')}
            </button>
          )}
        </div>
        {!photo && info.status === 'none' && info.eligible && <p className="mt-2 text-xs text-[var(--muted)]">{t('photoTip')}</p>}
      </div>

      {notice && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${notice.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{notice.text}</p>}
    </div>
  )
}
