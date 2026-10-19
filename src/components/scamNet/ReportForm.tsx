'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle2, ImagePlus, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { submitScamReport } from '@/app/actions/scamNet'
import { createClient } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/resizeImage'
import { SCAM_CATEGORIES, SCAM_DESCRIPTION_MAX, SCAM_KINDS, type ScamCategory, type ScamKind } from '@/lib/scamNet'

const field = 'mt-1 block w-full rounded-xl border border-[var(--gold)]/35 bg-white px-3 text-base text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'block text-sm font-semibold text-[var(--muted)]'

// Carica la prova (screenshot) nella cartella privata, già compressa
export async function uploadEvidence(file: File): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const small = (await resizeImageFile(file, 1600, 0.72, { keepIfUnderBytes: 200 * 1024, webp: true })) ?? file
  const ext = small.type === 'image/png' ? 'png' : small.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('scam-evidence').upload(path, small, { contentType: small.type || 'image/jpeg', upsert: false })
  return error ? null : path
}

export function PoliceAdvice() {
  const t = useTranslations('scamNet')
  const locale = useLocale()
  return (
    <p className="text-sm leading-relaxed text-[var(--muted)]">
      {t('police')}{' '}
      {locale === 'it' && (
        <a href="https://www.commissariatodips.it/" target="_blank" rel="noopener noreferrer" className="font-bold text-[#7a5a14] underline-offset-2 hover:underline">
          {t('policeLink')}
        </a>
      )}
    </p>
  )
}

export default function ReportForm({ initialKind, initialValue, onDone }: { initialKind?: ScamKind; initialValue?: string; onDone: () => void }) {
  const t = useTranslations('scamNet')
  const [kind, setKind] = useState<ScamKind>(initialKind ?? 'phone')
  const [value, setValue] = useState(initialValue ?? '')
  const [category, setCategory] = useState<ScamCategory | ''>('')
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState<{ path: string; preview: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [rules, setRules] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<'pending' | 'confirmed' | null>(null)

  const addEvidence = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!/^image\//.test(file.type)) return setError(t('errors.evidenceType'))
    setUploading(true)
    const path = await uploadEvidence(file)
    setUploading(false)
    if (!path) return setError(t('errors.evidenceUpload'))
    setEvidence({ path, preview: URL.createObjectURL(file) })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || !value.trim() || !rules) return
    setSaving(true)
    setError(null)
    const result = await submitScamReport({ kind, value, category, description, evidencePath: evidence?.path ?? null })
    setSaving(false)
    if (!result.success) {
      const known = ['invalid_value', 'limit', 'already', 'auth']
      return setError(t(`errors.${known.includes(result.message) ? result.message : 'save'}`))
    }
    setSent(result.data.status)
  }

  const reset = () => {
    setSent(null)
    setValue('')
    setCategory('')
    setDescription('')
    setEvidence(null)
    setRules(false)
  }

  if (sent) {
    return (
      <section className="space-y-4 rounded-3xl border border-[var(--gold)]/25 bg-white p-6 text-center shadow-sm" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#1d6b34]" aria-hidden="true" />
        <h2 className="text-2xl font-extrabold text-[var(--ink)]">{t('sentTitle')}</h2>
        <p className="text-[var(--muted)]">{sent === 'confirmed' ? t('sentConfirmed') : t('sentPending')}</p>
        <div className="rounded-2xl bg-[var(--background)] p-4 text-left">
          <PoliceAdvice />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="min-h-12 rounded-full bg-[var(--ink)] px-6 font-bold text-[var(--gold-bright)]">
            {t('reportAnother')}
          </button>
          <button type="button" onClick={onDone} className="min-h-12 rounded-full border border-[var(--gold)]/40 bg-white px-6 font-bold text-[var(--ink)]">
            {t('tabs.mine')}
          </button>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:p-6">
      <fieldset className="space-y-2">
        <legend className={label}>{t('form.kind')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SCAM_KINDS.map((k) => (
            <label key={k} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 px-2 text-center text-sm font-bold ${kind === k ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-[var(--gold)]/25 bg-white text-[var(--ink)]'}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {t(`kinds.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={label}>
        {t(`form.value.${kind}`)}
        <input value={value} onChange={(e) => setValue(e.target.value.slice(0, 300))} placeholder={t(`form.placeholder.${kind}`)} className={`${field} min-h-12`} inputMode={kind === 'phone' ? 'tel' : kind === 'email' ? 'email' : 'text'} autoComplete="off" required />
      </label>

      <label className={label}>
        {t('form.category')}
        <select value={category} onChange={(e) => setCategory(e.target.value as ScamCategory)} className={`${field} min-h-12`} required>
          <option value="">{t('form.categoryPick')}</option>
          {SCAM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
      </label>

      <label className={label}>
        {t('form.description')}
        <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, SCAM_DESCRIPTION_MAX))} rows={4} placeholder={t('form.descriptionPlaceholder')} className={`${field} py-3`} />
        <span className="mt-1 block text-right text-xs tabular-nums text-[var(--muted)]">
          {description.length}/{SCAM_DESCRIPTION_MAX}
        </span>
      </label>

      <div className="space-y-2">
        <p className={label}>{t('form.evidence')}</p>
        {evidence ? (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--gold)]/30 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={evidence.preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <span className="flex-1 text-sm text-[var(--muted)]">{t('form.evidenceAdded')}</span>
            <button type="button" onClick={() => setEvidence(null)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--background)]" aria-label={t('form.evidenceRemove')}>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[var(--gold)]/45 bg-[var(--gold-pale)]/40 px-4 py-3">
            {uploading ? <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" aria-hidden="true" /> : <ImagePlus className="h-6 w-6 text-[#7a5a14]" aria-hidden="true" />}
            <span className="text-sm text-[var(--muted)]">
              <strong className="text-[var(--ink)]">{t('form.evidenceAdd')}</strong>
              <br />
              {t('form.evidenceHint')}
            </span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => addEvidence(e.target.files?.[0])} disabled={uploading} />
          </label>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-[var(--background)] p-4 text-sm text-[var(--ink)]">
        <input type="checkbox" checked={rules} onChange={() => setRules((v) => !v)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
        {t('form.rules')}
      </label>

      {error && (
        <p className="rounded-xl bg-[#fdf2f2] p-3 text-sm font-semibold text-[#a12a2a]" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={saving || uploading || !rules || !category || !value.trim()} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-lg font-bold text-[var(--gold-bright)] disabled:opacity-40">
        {saving ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />} {t('form.send')}
      </button>
      <p className="text-center text-xs text-[var(--muted)]">{t('form.reward')}</p>
    </form>
  )
}
