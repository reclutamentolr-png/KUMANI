'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckCircle, Clock, Globe, ImagePlus, LoaderCircle, MapPin, Palette, Phone, Plus, Trash2, Wallet, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveBusinessProfile } from '@/app/actions/businessProfile'
import { BUSINESS_SOCIALS, type BusinessProfile } from '@/lib/businessProfile'
import { validateLogoFile, logoExtension } from '@/lib/quotes'
import { resizeImageFile } from '@/lib/resizeImage'
import VatCheck from '@/components/ecosystem/VatCheck'
import IbanInlineCheck from '@/components/ecosystem/IbanInlineCheck'

const INPUT =
  'w-full rounded-lg border-2 border-[var(--gold)]/20 px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-[var(--gold)]/15 pt-6">
      <h2 className="flex items-center gap-2 font-bold text-[var(--ink)]">
        <span className="text-[var(--gold)]">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

// Modulo della «Scheda attività»: i dati si scrivono qui una volta sola e
// i servizi li riprendono con «Usa i dati della Scheda attività».
export default function BusinessProfileForm({ initial }: { initial: BusinessProfile }) {
  const t = useTranslations('businessProfile')
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { logoUrl: initialLogoUrl, ...initialForm } = initial
  const [form, setForm] = useState(initialForm)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setSaved(false)
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleLogoSelect = async (picked: File) => {
    // Logo ridotto a 800 px, trasparenza mantenuta; gli SVG restano come sono
    const file = picked.type === 'image/svg+xml' ? picked : ((await resizeImageFile(picked, 800, 0.9, { keepTransparency: true })) ?? picked)
    const invalid = validateLogoFile(file)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setUploadingLogo(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUploadingLogo(false)
      return
    }
    const path = `${user.id}/logo.${logoExtension(file)}`
    const { error: uploadError } = await supabase.storage.from('quote-logos-v2').upload(path, file, { upsert: true })
    setUploadingLogo(false)
    if (uploadError) {
      console.error('[scheda attività] logo:', uploadError.message)
      setError('logoUploadError')
      return
    }
    // Logo precedente con un altro formato (logo.png → logo.jpg): si cancella
    const { data: existing } = await supabase.storage.from('quote-logos-v2').list(user.id)
    const stale = (existing ?? []).map((f) => `${user.id}/${f.name}`).filter((p) => p !== path && /\/logo\.[a-z0-9]+$/i.test(p))
    if (stale.length) await supabase.storage.from('quote-logos-v2').remove(stale)
    setLogoPath(path)
    setLogoUrl(URL.createObjectURL(file))
    setSaved(false)
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    const result = await saveBusinessProfile(form, logoPath)
    setSaving(false)
    if (!result.success) {
      setError(result.message)
      return
    }
    setSaved(true)
    router.refresh()
  }

  const hours = form.openingHours

  return (
    <div className="space-y-6 rounded-2xl border border-[var(--gold)]/25 bg-white p-6 shadow-sm sm:p-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[var(--gold)]/40 bg-[var(--gold-pale)]/40 transition-all hover:border-[var(--gold)]"
          aria-label={logoUrl ? t('changeLogo') : t('addLogo')}
        >
          {uploadingLogo ? (
            <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
          ) : logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-contain p-2" />
          ) : (
            <ImagePlus className="h-8 w-8 text-gray-300" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleLogoSelect(file)
            e.target.value = ''
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm font-medium text-[var(--gold)] hover:underline">
          {logoUrl ? t('changeLogo') : t('addLogo')}
        </button>
      </div>

      {/* Attività */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('companyName')} wide>
          <input className={INPUT} value={form.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder={t('companyNamePlaceholder')} />
        </Field>
        <Field label={t('tagline')} wide>
          <input className={INPUT} value={form.tagline} maxLength={160} onChange={(e) => set('tagline', e.target.value)} placeholder={t('taglinePlaceholder')} />
        </Field>
        <Field label={t('vatNumber')}>
          <input className={INPUT} value={form.vatNumber} onChange={(e) => set('vatNumber', e.target.value)} />
          <VatCheck value={form.vatNumber} onUseName={(name) => set('companyName', name)} />
        </Field>
        <Field label={t('pec')}>
          <input type="email" className={INPUT} value={form.pec} onChange={(e) => set('pec', e.target.value)} />
        </Field>
      </div>

      <Section icon={<Phone className="h-5 w-5" />} title={t('contactsTitle')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('phone')}>
            <input type="tel" className={INPUT} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label={t('whatsapp')}>
            <input type="tel" className={INPUT} value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder={t('whatsappPlaceholder')} />
          </Field>
          <Field label={t('email')}>
            <input type="email" className={INPUT} value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label={t('website')}>
            <input className={INPUT} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="www.…" />
          </Field>
        </div>
      </Section>

      <Section icon={<MapPin className="h-5 w-5" />} title={t('addressTitle')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('address')} wide>
            <input className={INPUT} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label={t('city')}>
            <input className={INPUT} value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('postalCode')}>
              <input className={INPUT} value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
            </Field>
            <Field label={t('province')}>
              <input className={INPUT} value={form.province} onChange={(e) => set('province', e.target.value)} />
            </Field>
          </div>
        </div>
      </Section>

      <Section icon={<Clock className="h-5 w-5" />} title={t('hoursTitle')}>
        <div className="space-y-2">
          {hours.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${INPUT} w-2/5`}
                value={row.day}
                placeholder={t('hoursDayPlaceholder')}
                onChange={(e) => set('openingHours', hours.map((r, j) => (j === i ? { ...r, day: e.target.value } : r)))}
              />
              <input
                className={INPUT}
                value={row.hours}
                placeholder={t('hoursTimePlaceholder')}
                onChange={(e) => set('openingHours', hours.map((r, j) => (j === i ? { ...r, hours: e.target.value } : r)))}
              />
              <button type="button" onClick={() => set('openingHours', hours.filter((_, j) => j !== i))} className="shrink-0 rounded-lg px-2 text-gray-400 hover:text-red-600" aria-label={t('hoursRemove')}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {hours.length < 14 && (
            <button type="button" onClick={() => set('openingHours', [...hours, { day: '', hours: '' }])} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
              <Plus className="h-4 w-4" /> {t('hoursAdd')}
            </button>
          )}
        </div>
      </Section>

      <Section icon={<Globe className="h-5 w-5" />} title={t('socialTitle')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {BUSINESS_SOCIALS.map((key) => (
            <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
              <input className={INPUT} value={form.socials[key] ?? ''} placeholder="https://…" onChange={(e) => set('socials', { ...form.socials, [key]: e.target.value })} />
            </Field>
          ))}
          <Field label={t('reviewUrl')} wide>
            <input className={INPUT} value={form.reviewUrl} placeholder={t('reviewUrlPlaceholder')} onChange={(e) => set('reviewUrl', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section icon={<Palette className="h-5 w-5" />} title={t('brandTitle')}>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={form.accent || '#c79a3b'}
            onChange={(e) => set('accent', e.target.value)}
            className="h-10 w-16 cursor-pointer rounded border border-gray-200"
            aria-label={t('accent')}
          />
          <span className="text-sm text-[var(--muted)]">{form.accent ? t('accentChosen', { color: form.accent }) : t('accentHint')}</span>
          {form.accent && (
            <button type="button" onClick={() => set('accent', '')} className="text-xs font-semibold text-gray-500 hover:text-red-600">
              {t('accentReset')}
            </button>
          )}
        </div>
      </Section>

      <Section icon={<Wallet className="h-5 w-5" />} title={t('paymentTitle')}>
        <textarea className={`${INPUT} min-h-20`} value={form.paymentInfo} maxLength={500} placeholder={t('paymentPlaceholder')} onChange={(e) => set('paymentInfo', e.target.value)} />
        <IbanInlineCheck text={form.paymentInfo} />
      </Section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          {t(`error_${error}`)}
        </div>
      )}
      {saved && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle className="h-5 w-5 shrink-0" />
          {t('saved')}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!form.companyName.trim() || saving || uploadingLogo}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105 disabled:opacity-50"
      >
        {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
        {saving ? t('saving') : t('save')}
      </button>
    </div>
  )
}
