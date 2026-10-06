'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  Save,
  Share2,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import LandingView, { type LandingLabels } from '@/components/landing/LandingView'
import LandingContactForm, { type LandingFormLabels } from '@/components/landing/LandingContactForm'
import { landingSerif } from '@/components/landing/landingFonts'
import { checkLandingSlug, generateLandingDraft, importBusinessLogoToLanding, saveLanding, uploadLandingPhoto, type LandingAiAnswers } from '@/app/actions/landing'
import { resizeImageFile } from '@/lib/resizeImage'
import BusinessProfileImport from '@/components/businessProfile/BusinessProfileImport'
import type { BusinessProfile } from '@/lib/businessProfile'
import {
  CTA_KINDS,
  LANDING_ACCENTS,
  LANDING_LOCALE_NAMES,
  LANDING_LOCALES,
  LANDING_TEMPLATES,
  LANDING_PRESETS,
  LANDING_BG_KEYS,
  LANDING_FONTS,
  heroBackground,
  LIMITS,
  landingFromBusinessProfile,
  landingPhotoUrl,
  landingTheme,
  type LandingContent,
  type LandingLocale,
  type LandingTemplate,
  type SectionKey,
  type TitledText,
} from '@/lib/landing'

export type LandingEditorInitial = {
  exists: boolean
  slug: string
  isPublished: boolean
  template: LandingTemplate
  accent: string
  contentLocale: LandingLocale
  content: LandingContent
  suspended: boolean
  suspendedReason: string | null
}

type Props = {
  initial: LandingEditorInitial
  siteUrl: string
  labelsByLocale: Record<LandingLocale, LandingLabels>
  formLabelsByLocale: Record<LandingLocale, LandingFormLabels>
  menuUrl: string | null
  businessProfile: BusinessProfile | null
}

const input = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1.5 block text-sm font-semibold text-gray-800'

function Field({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  )
}

function Card({ title, children, defaultOpen = true, right }: { title: string; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <button type="button" onClick={() => setOpen(!open)} className="flex flex-1 items-center justify-between gap-3 text-left" aria-expanded={open}>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {right}
      </div>
      {open && <div className="space-y-4 border-t border-gray-100 px-4 py-4 sm:px-5">{children}</div>}
    </section>
  )
}

export default function LandingEditor({ initial, siteUrl, labelsByLocale, formLabelsByLocale, menuUrl, businessProfile }: Props) {
  const t = useTranslations('landingEditor')
  const [slug, setSlug] = useState(initial.slug)
  const [savedSlug, setSavedSlug] = useState(initial.exists ? initial.slug : '')
  const [isPublished, setIsPublished] = useState(initial.isPublished)
  const [template, setTemplate] = useState<LandingTemplate>(initial.template)
  const [accent, setAccent] = useState(initial.accent)
  const [contentLocale, setContentLocale] = useState<LandingLocale>(initial.contentLocale)
  const [c, setC] = useState<LandingContent>(initial.content)
  const [dirty, setDirty] = useState(!initial.exists)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | string>('idle')
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aiOpen, setAiOpen] = useState(!initial.exists)
  const [ai, setAi] = useState<LandingAiAnswers>({ business: '', city: '', audience: '', services: '', strengths: '' })
  const [aiBusy, setAiBusy] = useState(false)

  const publicUrl = `${siteUrl.replace(/\/$/, '')}/p/${savedSlug || slug}`
  const err = (code: string) => (t.has(`err_${code}`) ? t(`err_${code}`) : t('err_saveError'))

  // Ogni modifica segna la pagina come "da salvare"
  const update = (fn: (draft: LandingContent) => LandingContent) => {
    setC((prev) => fn(structuredClone(prev)))
    setDirty(true)
  }
  const touch = () => setDirty(true)

  // Avviso se si chiude la pagina con modifiche non salvate
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // Indirizzo libero? Controllo mentre si scrive (con un attimo di pausa)
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSlugChange = (value: string) => {
    const next = value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
    setSlug(next)
    touch()
    if (slugTimer.current) clearTimeout(slugTimer.current)
    if (next === savedSlug) return setSlugStatus('idle')
    setSlugStatus('checking')
    slugTimer.current = setTimeout(async () => {
      const r = await checkLandingSlug(next)
      setSlugStatus(r.ok ? 'ok' : (r.message ?? 'slugInvalid'))
    }, 500)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    const r = await saveLanding({ slug, isPublished, template, accent, contentLocale, content: c })
    setSaving(false)
    if (!r.success) {
      setMessage({ ok: false, text: err(r.message) })
      return
    }
    setC(r.content)
    setSavedSlug(slug)
    setSlugStatus('idle')
    setDirty(false)
    setMessage({ ok: true, text: t('saved') })
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* copia non disponibile */
    }
  }

  // Condividi la propria pagina: menu di condivisione del telefono, altrimenti WhatsApp
  const sharePage = async () => {
    const text = t('shareText', { name: c.hero.name || savedSlug })
    if (navigator.share) {
      try {
        await navigator.share({ title: c.hero.name, text, url: publicUrl })
        return
      } catch {
        /* condivisione annullata */
        return
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${publicUrl}`)}`, '_blank', 'noopener')
  }

  const downloadQr = async () => {
    const data = await QRCode.toDataURL(publicUrl, { width: 1024, margin: 2 })
    const a = document.createElement('a')
    a.href = data
    a.download = `landing-${savedSlug || slug}-qr.png`
    a.click()
  }

  const runAi = async () => {
    const hasText = c.hero.title || c.hero.text || c.services.items.length || c.about.text
    if (hasText && !confirm(t('aiConfirm'))) return
    setAiBusy(true)
    setMessage(null)
    const r = await generateLandingDraft(ai, contentLocale, c.hero.name)
    setAiBusy(false)
    if (!r.success) {
      setMessage({ ok: false, text: err(r.message) })
      return
    }
    const d = r.draft
    update((x) => {
      x.hero = { ...x.hero, title: d.hero.title, subtitle: d.hero.subtitle, text: d.hero.text, ctaLabel: x.hero.ctaLabel || d.hero.ctaLabel }
      x.services = { ...x.services, on: d.services.items.length > 0 || x.services.on, title: d.services.title, items: d.services.items }
      x.about = { ...x.about, on: true, title: d.about.title, text: d.about.text }
      x.method = { ...x.method, on: d.method.items.length > 0, title: d.method.title, items: d.method.items }
      x.seo.description = d.seoDescription
      if (ai.city && !x.contacts.city) x.contacts.city = ai.city
      return x
    })
    setAiOpen(false)
    setMessage({ ok: true, text: t('aiDone') })
  }

  // «Usa i dati della Scheda attività»: riempie solo i campi che la Scheda ha
  const importProfile = (p: BusinessProfile) => {
    const r = landingFromBusinessProfile(c, p)
    setC(r.content)
    if (r.accent) setAccent(r.accent)
    setDirty(true)
    // Anche il logo, se la Scheda ne ha uno (in caso di errore resta quello di prima)
    importBusinessLogoToLanding()
      .then((res) => {
        if ('path' in res) update((x) => ((x.hero.logo = res.path), x))
      })
      .catch(() => {})
  }

  const moveSection = (key: SectionKey, dir: -1 | 1) =>
    update((x) => {
      const i = x.order.indexOf(key)
      const j = i + dir
      if (j < 0 || j >= x.order.length) return x
      ;[x.order[i], x.order[j]] = [x.order[j], x.order[i]]
      return x
    })

  const labels = labelsByLocale[contentLocale]
  const status = initial.suspended ? 'suspended' : isPublished && savedSlug ? 'published' : 'draft'

  const preview = useMemo(
    () => (
      <LandingView
        content={c}
        template={template}
        accent={accent}
        labels={labels}
        lang={contentLocale}
        menuUrl={menuUrl}
        createHref="#"
        preview
        contactFormSlot={<LandingContactForm slug="" labels={formLabelsByLocale[contentLocale]} ownerName={c.hero.name} privacyHref="" preview />}
      />
    ),
    [c, template, accent, labels, contentLocale, menuUrl, formLabelsByLocale]
  )

  const blockEditors: Record<SectionKey, ReactNode> = {
    services: (
      <>
        <BlockTitle value={c.services.title} fallback={labels.services} onChange={(v) => update((x) => ((x.services.title = v), x))} />
        <TitledList
          items={c.services.items}
          max={LIMITS.services}
          addLabel={t('addService')}
          onChange={(items) => update((x) => ((x.services.items = items), x))}
        />
      </>
    ),
    about: (
      <>
        <BlockTitle value={c.about.title} fallback={labels.about} onChange={(v) => update((x) => ((x.about.title = v), x))} />
        <Field title={t('aboutText')}>
          <textarea className={input} rows={5} maxLength={1500} value={c.about.text} onChange={(e) => update((x) => ((x.about.text = e.target.value), x))} />
        </Field>
        <PhotoField title={t('aboutPhoto')} value={c.about.photo} onChange={(p) => update((x) => ((x.about.photo = p), x))} onError={(m) => setMessage({ ok: false, text: err(m) })} />
      </>
    ),
    method: (
      <>
        <BlockTitle value={c.method.title} fallback={labels.method} onChange={(v) => update((x) => ((x.method.title = v), x))} />
        <TitledList items={c.method.items} max={LIMITS.method} addLabel={t('addStep')} onChange={(items) => update((x) => ((x.method.items = items), x))} />
      </>
    ),
    testimonials: (
      <>
        <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {t('testimonialsWarning')}
        </p>
        <BlockTitle value={c.testimonials.title} fallback={labels.testimonials} onChange={(v) => update((x) => ((x.testimonials.title = v), x))} />
        {c.testimonials.items.map((item, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-gray-200 p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field title={t('testimonialName')}>
                <input className={input} maxLength={60} value={item.name} onChange={(e) => update((x) => ((x.testimonials.items[i].name = e.target.value), x))} />
              </Field>
              <Field title={t('testimonialStars')}>
                <select className={input} value={item.stars} onChange={(e) => update((x) => ((x.testimonials.items[i].stars = Number(e.target.value)), x))}>
                  <option value={0}>{t('noStars')}</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {'★'.repeat(n)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field title={t('testimonialText')}>
              <textarea className={input} rows={3} maxLength={500} value={item.text} onChange={(e) => update((x) => ((x.testimonials.items[i].text = e.target.value), x))} />
            </Field>
            <RowActions
              onUp={i > 0 ? () => update((x) => (swap(x.testimonials.items, i, i - 1), x)) : undefined}
              onDown={i < c.testimonials.items.length - 1 ? () => update((x) => (swap(x.testimonials.items, i, i + 1), x)) : undefined}
              onRemove={() => update((x) => (x.testimonials.items.splice(i, 1), x))}
            />
          </div>
        ))}
        {c.testimonials.items.length < LIMITS.testimonials && (
          <AddButton label={t('addTestimonial')} onClick={() => update((x) => (x.testimonials.items.push({ name: '', text: '', stars: 5 }), x))} />
        )}
        <Field title={t('googleUrl')}>
          <input className={input} type="url" inputMode="url" placeholder="https://g.page/…" value={c.testimonials.googleUrl} onChange={(e) => update((x) => ((x.testimonials.googleUrl = e.target.value), x))} />
        </Field>
      </>
    ),
    gallery: (
      <>
        <BlockTitle value={c.gallery.title} fallback={labels.gallery} onChange={(v) => update((x) => ((x.gallery.title = v), x))} />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {c.gallery.photos.map((p, i) => (
            <div key={p} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={landingPhotoUrl(p)} alt="" className="aspect-square w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => update((x) => (x.gallery.photos.splice(i, 1), x))}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                aria-label={t('remove')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {c.gallery.photos.length < LIMITS.gallery && (
          <PhotoField
            title=""
            value=""
            addLabel={t('galleryAdd')}
            onChange={(p) => p && update((x) => (x.gallery.photos.push(p), x))}
            onError={(m) => setMessage({ ok: false, text: err(m) })}
          />
        )}
        <p className="text-xs text-gray-500">{t('galleryHint', { max: LIMITS.gallery })}</p>
      </>
    ),
    hours: (
      <>
        <BlockTitle value={c.hours.title} fallback={labels.hours} onChange={(v) => update((x) => ((x.hours.title = v), x))} />
        {c.hours.rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Field title={t('hoursDay')}>
              <input className={input} maxLength={40} placeholder={t('hoursDayPh')} value={row.day} onChange={(e) => update((x) => ((x.hours.rows[i].day = e.target.value), x))} />
            </Field>
            <Field title={t('hoursHours')}>
              <input className={input} maxLength={60} placeholder={t('hoursHoursPh')} value={row.hours} onChange={(e) => update((x) => ((x.hours.rows[i].hours = e.target.value), x))} />
            </Field>
            <button type="button" onClick={() => update((x) => (x.hours.rows.splice(i, 1), x))} className="mb-1 rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label={t('remove')}>
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
        {c.hours.rows.length < LIMITS.hours && <AddButton label={t('addHours')} onClick={() => update((x) => (x.hours.rows.push({ day: '', hours: '' }), x))} />}
        <Field title={t('hoursNote')}>
          <input className={input} maxLength={200} value={c.hours.note} onChange={(e) => update((x) => ((x.hours.note = e.target.value), x))} />
        </Field>
      </>
    ),
    contacts: (
      <>
        <BlockTitle value={c.contacts.title} fallback={labels.contacts} onChange={(v) => update((x) => ((x.contacts.title = v), x))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field title={t('contactsWhatsapp')}>
            <input className={input} type="tel" placeholder="+39 …" value={c.contacts.whatsapp} onChange={(e) => update((x) => ((x.contacts.whatsapp = e.target.value), x))} />
          </Field>
          <Field title={t('contactsPhone')}>
            <input className={input} type="tel" placeholder="+39 …" value={c.contacts.phone} onChange={(e) => update((x) => ((x.contacts.phone = e.target.value), x))} />
          </Field>
          <Field title={t('contactsEmail')}>
            <input className={input} type="email" value={c.contacts.email} onChange={(e) => update((x) => ((x.contacts.email = e.target.value), x))} />
          </Field>
          <Field title={t('contactsCity')}>
            <input className={input} maxLength={80} value={c.contacts.city} onChange={(e) => update((x) => ((x.contacts.city = e.target.value), x))} />
          </Field>
        </div>
        <Field title={t('contactsAddress')}>
          <input className={input} maxLength={160} value={c.contacts.address} onChange={(e) => update((x) => ((x.contacts.address = e.target.value), x))} />
        </Field>
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--gold)]" checked={c.contacts.form} onChange={(e) => update((x) => ((x.contacts.form = e.target.checked), x))} />
          <span>
            {t('contactsForm')}
            <span className="block text-xs text-gray-500">{t('contactsFormHint')}</span>
          </span>
        </label>
      </>
    ),
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-4">
        <BusinessProfileImport profile={businessProfile} onImport={importProfile} />

        {/* Stato e indirizzo pubblico */}
        <section className="rounded-2xl bg-[var(--ink)] p-5 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                status === 'published' ? 'bg-emerald-500/20 text-emerald-300' : status === 'suspended' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/70'
              }`}
            >
              {t(status === 'published' ? 'statusPublished' : status === 'suspended' ? 'statusSuspended' : 'statusDraft')}
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--gold)]"
                checked={isPublished}
                onChange={(e) => {
                  setIsPublished(e.target.checked)
                  touch()
                }}
              />
              {t('publish')}
            </label>
          </div>
          {initial.suspended && <p className="mt-3 rounded-xl bg-red-500/15 p-3 text-sm text-red-100">{t('suspendedText', { reason: initial.suspendedReason || '—' })}</p>}
          <p className="mt-3 text-xs text-white/60">{t('publishHint')}</p>
          {savedSlug && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-bright)]">{t('yourLink')}</p>
              <p className="mt-1 break-all font-mono text-sm">{publicUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t('copied') : t('copy')}
                </button>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">
                  <ExternalLink className="h-4 w-4" /> {t('open')}
                </a>
                <button type="button" onClick={downloadQr} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">
                  <Download className="h-4 w-4" /> {t('downloadQr')}
                </button>
                <button type="button" onClick={sharePage} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gold)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:brightness-110">
                  <Share2 className="h-4 w-4" /> {t('share')}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Testi con l'AI */}
        <section className="rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold)]/5 p-4 sm:p-5">
          <button type="button" onClick={() => setAiOpen(!aiOpen)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={aiOpen}>
            <span className="flex items-center gap-2 text-base font-bold text-gray-900">
              <Sparkles className="h-5 w-5 text-[var(--gold)]" /> {t('sectionAi')}
            </span>
            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
          </button>
          {aiOpen && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-700">{t('aiIntro')}</p>
              <Field title={t('aiBusiness')}>
                <textarea className={input} rows={2} maxLength={300} placeholder={t('aiBusinessPh')} value={ai.business} onChange={(e) => setAi({ ...ai, business: e.target.value })} />
              </Field>
              <Field title={t('aiCity')}>
                <input className={input} maxLength={80} placeholder={t('aiCityPh')} value={ai.city} onChange={(e) => setAi({ ...ai, city: e.target.value })} />
              </Field>
              <Field title={t('aiAudience')}>
                <input className={input} maxLength={300} placeholder={t('aiAudiencePh')} value={ai.audience} onChange={(e) => setAi({ ...ai, audience: e.target.value })} />
              </Field>
              <Field title={t('aiServices')}>
                <textarea className={input} rows={3} maxLength={800} placeholder={t('aiServicesPh')} value={ai.services} onChange={(e) => setAi({ ...ai, services: e.target.value })} />
              </Field>
              <Field title={t('aiStrengths')}>
                <textarea className={input} rows={2} maxLength={500} placeholder={t('aiStrengthsPh')} value={ai.strengths} onChange={(e) => setAi({ ...ai, strengths: e.target.value })} />
              </Field>
              <p className="text-xs text-gray-500">{t('aiNote', { language: LANDING_LOCALE_NAMES[contentLocale] })}</p>
              <button
                type="button"
                onClick={runAi}
                disabled={aiBusy || !ai.business.trim() || !ai.services.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-white disabled:opacity-50 sm:w-auto"
              >
                {aiBusy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 text-[var(--gold-bright)]" />}
                {aiBusy ? t('aiGenerating') : t('aiGenerate')}
              </button>
            </div>
          )}
        </section>

        <Card title={t('sectionAddress')}>
          <Field title={t('slugLabel')} hint={t('slugHint')}>
            <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-300 focus-within:border-[var(--gold)] focus-within:ring-2 focus-within:ring-[var(--gold)]/30">
              <span className="flex items-center bg-gray-100 px-3 text-sm text-gray-500">kumani.io/p/</span>
              <input className="min-w-0 flex-1 px-3 py-2.5 text-gray-900 focus:outline-none" value={slug} onChange={(e) => onSlugChange(e.target.value)} autoCapitalize="none" spellCheck={false} />
            </div>
          </Field>
          {slugStatus === 'checking' && <p className="text-sm text-gray-500">…</p>}
          {slugStatus === 'ok' && <p className="flex items-center gap-1 text-sm text-emerald-700"><Check className="h-4 w-4" /> {t('slugFree')}</p>}
          {slugStatus !== 'idle' && slugStatus !== 'checking' && slugStatus !== 'ok' && <p className="text-sm text-red-600">{err(slugStatus)}</p>}
          <Field title={t('contentLocaleLabel')} hint={t('contentLocaleHint')}>
            <select
              className={input}
              value={contentLocale}
              onChange={(e) => {
                setContentLocale(e.target.value as LandingLocale)
                touch()
              }}
            >
              {LANDING_LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LANDING_LOCALE_NAMES[l]}
                </option>
              ))}
            </select>
          </Field>
        </Card>

        <Card title={t('sectionStyle')}>
          {/* Stili pronti per tipo di attività: modello, colore, sfondo e carattere in un tocco */}
          <div>
            <span className={label}>{t('presetsTitle')}</span>
            <p className="mb-2 text-xs text-gray-500">{t('presetsHint')}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LANDING_PRESETS.map((p) => {
                const active = template === p.template && accent === p.accent && c.style.bg === p.bg && c.style.font === p.font
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setTemplate(p.template)
                      setAccent(p.accent)
                      update((x) => ((x.style = { ...x.style, bg: p.bg, font: p.font }), x))
                    }}
                    className={`group relative h-20 overflow-hidden rounded-xl border-2 text-left ${active ? 'border-[var(--gold)] ring-2 ring-[var(--gold)]/30' : 'border-transparent'}`}
                    style={{ backgroundImage: heroBackground({ bg: p.bg, bgPhoto: '', font: p.font }) ?? undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    aria-pressed={active}
                  >
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-black/55 px-2 py-1.5 text-xs font-semibold text-white">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.accent }} />
                      {t(`preset_${p.key}`)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LANDING_TEMPLATES.map((tpl) => {
              const th = landingTheme(tpl, accent)
              return (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => {
                    setTemplate(tpl)
                    touch()
                  }}
                  className={`overflow-hidden rounded-xl border-2 text-left ${template === tpl ? 'border-[var(--gold)]' : 'border-gray-200'}`}
                  aria-pressed={template === tpl}
                >
                  <div className="h-12" style={{ background: th.heroBg }}>
                    <div className="mx-2 pt-3">
                      <div className="h-1.5 w-10 rounded" style={{ background: th.heroText, opacity: 0.8 }} />
                      <div className="mt-1.5 h-2.5 w-8 rounded" style={{ background: tpl === 'colore' ? th.onAccent : th.accent }} />
                    </div>
                  </div>
                  <div className="h-5" style={{ background: th.bg }} />
                  <p className="border-t border-gray-100 bg-white px-2 py-1.5 text-xs font-semibold text-gray-800">{t(`template_${tpl}`)}</p>
                </button>
              )
            })}
          </div>
          <div>
            <span className={label}>{t('accentLabel')}</span>
            <div className="flex flex-wrap items-center gap-2">
              {LANDING_ACCENTS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setAccent(color)
                    touch()
                  }}
                  className={`h-9 w-9 rounded-full border-2 ${accent === color ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-900/20' : 'border-white shadow'}`}
                  style={{ background: color }}
                  aria-label={color}
                  aria-pressed={accent === color}
                />
              ))}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => {
                    setAccent(e.target.value.toLowerCase())
                    touch()
                  }}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                />
                {t('customColor')}
              </label>
            </div>
          </div>
          {/* Sfondo della presentazione: nessuno, foto a tema, sfumatura o una tua foto */}
          <div>
            <span className={label}>{t('bgTitle')}</span>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {['', ...LANDING_BG_KEYS].map((k) => (
                <button
                  key={k || 'none'}
                  type="button"
                  onClick={() => update((x) => ((x.style.bg = k), x))}
                  title={k ? t(`bg_${k}`) : t('bgNone')}
                  aria-label={k ? t(`bg_${k}`) : t('bgNone')}
                  aria-pressed={c.style.bg === k}
                  className={`flex aspect-square items-center justify-center rounded-lg border-2 text-[10px] font-semibold text-gray-600 ${c.style.bg === k ? 'border-[var(--gold)] ring-2 ring-[var(--gold)]/30' : 'border-gray-200'}`}
                  style={k ? { backgroundImage: heroBackground({ bg: k, bgPhoto: '', font: 'modern' }) ?? undefined, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: landingTheme(template, accent).heroBg }}
                >
                  {!k && <span className="rounded bg-white/80 px-1">{t('bgNone')}</span>}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <PhotoField
                title=""
                value={c.style.bgPhoto}
                addLabel={c.style.bgPhoto ? undefined : t('bgCustom')}
                onChange={(p) => update((x) => ((x.style = { ...x.style, bgPhoto: p, bg: p ? 'custom' : x.style.bg === 'custom' ? '' : x.style.bg }), x))}
                onError={(m) => setMessage({ ok: false, text: err(m) })}
              />
            </div>
          </div>
          {/* Carattere dei titoli */}
          <div>
            <span className={label}>{t('fontTitle')}</span>
            <div className="flex gap-2">
              {LANDING_FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => update((x) => ((x.style.font = f), x))}
                  aria-pressed={c.style.font === f}
                  className={`rounded-xl border-2 px-4 py-2 text-lg ${c.style.font === f ? 'border-[var(--gold)] bg-[var(--gold)]/10' : 'border-gray-200'} ${f === 'elegant' ? landingSerif.className : ''}`}
                >
                  {t(`font_${f}`)}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card title={t('sectionHero')}>
          <Field title={t('heroName')}>
            <input className={input} maxLength={80} value={c.hero.name} onChange={(e) => update((x) => ((x.hero.name = e.target.value), x))} />
          </Field>
          <Field title={t('heroTitle')}>
            <input className={input} maxLength={100} value={c.hero.title} onChange={(e) => update((x) => ((x.hero.title = e.target.value), x))} />
          </Field>
          <Field title={t('heroSubtitle')}>
            <input className={input} maxLength={160} value={c.hero.subtitle} onChange={(e) => update((x) => ((x.hero.subtitle = e.target.value), x))} />
          </Field>
          <Field title={t('heroText')}>
            <textarea className={input} rows={4} maxLength={600} value={c.hero.text} onChange={(e) => update((x) => ((x.hero.text = e.target.value), x))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoField title={t('heroPhoto')} value={c.hero.photo} onChange={(p) => update((x) => ((x.hero.photo = p), x))} onError={(m) => setMessage({ ok: false, text: err(m) })} />
            <PhotoField title={t('heroLogo')} value={c.hero.logo} square onChange={(p) => update((x) => ((x.hero.logo = p), x))} onError={(m) => setMessage({ ok: false, text: err(m) })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field title={t('ctaKind')}>
              <select className={input} value={c.hero.ctaKind} onChange={(e) => update((x) => ((x.hero.ctaKind = e.target.value as LandingContent['hero']['ctaKind']), x))}>
                {CTA_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`cta_${k}`)}
                  </option>
                ))}
              </select>
            </Field>
            {c.hero.ctaKind !== 'none' && (
              <Field title={t('ctaLabel')}>
                <input className={input} maxLength={40} value={c.hero.ctaLabel} onChange={(e) => update((x) => ((x.hero.ctaLabel = e.target.value), x))} />
              </Field>
            )}
          </div>
          {c.hero.ctaKind !== 'none' && (
            <Field title={t(`ctaValue_${c.hero.ctaKind}`)}>
              <input
                className={input}
                type={c.hero.ctaKind === 'email' ? 'email' : c.hero.ctaKind === 'link' ? 'url' : 'tel'}
                value={c.hero.ctaValue}
                onChange={(e) => update((x) => ((x.hero.ctaValue = e.target.value), x))}
              />
            </Field>
          )}
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--gold)]" disabled={!menuUrl} checked={c.links.menu && !!menuUrl} onChange={(e) => update((x) => ((x.links.menu = e.target.checked), x))} />
            <span>
              {t('menuLink')}
              {!menuUrl && <span className="block text-xs text-gray-500">{t('menuLinkMissing')}</span>}
            </span>
          </label>
        </Card>

        <Card title={t('sectionBlocks')}>
          <p className="text-sm text-gray-600">{t('blocksHint')}</p>
          <div className="space-y-3">
            {c.order.map((key, i) => (
              <BlockCard
                key={key}
                title={t(`block_${key}`)}
                on={c[key].on}
                onToggle={() => update((x) => ((x[key].on = !x[key].on), x))}
                onUp={i > 0 ? () => moveSection(key, -1) : undefined}
                onDown={i < c.order.length - 1 ? () => moveSection(key, 1) : undefined}
              >
                {blockEditors[key]}
              </BlockCard>
            ))}
          </div>
        </Card>

        <Card title={t('sectionSocial')} defaultOpen={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'website'] as const).map((k) => (
              <Field key={k} title={t(`social_${k}`)}>
                <input className={input} type="url" inputMode="url" placeholder="https://…" value={c.social[k]} onChange={(e) => update((x) => ((x.social[k] = e.target.value), x))} />
              </Field>
            ))}
          </div>
        </Card>

        <Card title={t('sectionFooter')} defaultOpen={false}>
          <p className="text-sm text-gray-600">{t('footerHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field title={t('footerBusiness')}>
              <input className={input} maxLength={120} value={c.footer.businessName} onChange={(e) => update((x) => ((x.footer.businessName = e.target.value), x))} />
            </Field>
            <Field title={t('footerVat')}>
              <input className={input} maxLength={30} value={c.footer.vat} onChange={(e) => update((x) => ((x.footer.vat = e.target.value), x))} />
            </Field>
          </div>
        </Card>

        <Card title={t('sectionSeo')} defaultOpen={false}>
          <Field title={t('seoDescription')} hint={t('seoHint')}>
            <textarea className={input} rows={2} maxLength={170} value={c.seo.description} onChange={(e) => update((x) => ((x.seo.description = e.target.value), x))} />
          </Field>
        </Card>

        {/* Salva: sempre a portata di mano */}
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 font-bold text-[var(--ink)] disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} {saving ? t('saving') : t('save')}
          </button>
          <button type="button" onClick={() => setShowPreview(true)} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-800 lg:hidden">
            <Eye className="h-5 w-5" /> {t('preview')}
          </button>
          <span className={`text-sm ${message ? (message.ok ? 'text-emerald-700' : 'text-red-600') : 'text-gray-500'}`} role="status">
            {message?.text ?? (dirty ? t('unsaved') : '')}
          </span>
        </div>
      </div>

      {/* Anteprima: a fianco sul computer, a tutto schermo sul telefono */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-600">
            <Eye className="h-4 w-4" /> {t('preview')}
          </p>
          <div className="h-[calc(100vh-9rem)] overflow-y-auto rounded-[2rem] border-8 border-gray-900 bg-white shadow-xl">{preview}</div>
        </div>
      </aside>
      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 lg:hidden" role="dialog" aria-modal="true" aria-label={t('preview')}>
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="font-semibold">{t('preview')}</span>
            <button type="button" onClick={() => setShowPreview(false)} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold">
              <X className="h-4 w-4" /> {t('closePreview')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-white">{preview}</div>
        </div>
      )}
    </div>
  )
}

// ---- Pezzi dell'editor ----

function BlockTitle({ value, fallback, onChange }: { value: string; fallback: string; onChange: (v: string) => void }) {
  const t = useTranslations('landingEditor')
  return (
    <Field title={t('blockTitle')}>
      <input className={input} maxLength={80} placeholder={t('blockTitlePh', { fallback })} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function TitledList({ items, max, addLabel, onChange }: { items: TitledText[]; max: number; addLabel: string; onChange: (items: TitledText[]) => void }) {
  const t = useTranslations('landingEditor')
  const set = (i: number, patch: Partial<TitledText>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-gray-200 p-3">
          <Field title={t('itemTitle')}>
            <input className={input} maxLength={80} value={item.title} onChange={(e) => set(i, { title: e.target.value })} />
          </Field>
          <Field title={t('itemText')}>
            <textarea className={input} rows={2} maxLength={400} value={item.text} onChange={(e) => set(i, { text: e.target.value })} />
          </Field>
          <RowActions
            onUp={i > 0 ? () => onChange(swapped(items, i, i - 1)) : undefined}
            onDown={i < items.length - 1 ? () => onChange(swapped(items, i, i + 1)) : undefined}
            onRemove={() => onChange(items.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {items.length < max && <AddButton label={addLabel} onClick={() => onChange([...items, { title: '', text: '' }])} />}
    </>
  )
}

function RowActions({ onUp, onDown, onRemove }: { onUp?: () => void; onDown?: () => void; onRemove: () => void }) {
  const t = useTranslations('landingEditor')
  return (
    <div className="flex justify-end gap-1">
      <IconButton label={t('moveUp')} onClick={onUp}>
        <ArrowUp className="h-4 w-4" />
      </IconButton>
      <IconButton label={t('moveDown')} onClick={onDown}>
        <ArrowDown className="h-4 w-4" />
      </IconButton>
      <IconButton label={t('remove')} onClick={onRemove} danger>
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </div>
  )
}

function BlockCard({ title, on, onToggle, onUp, onDown, children }: { title: string; on: boolean; onToggle: () => void; onUp?: () => void; onDown?: () => void; children: ReactNode }) {
  const t = useTranslations('landingEditor')
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded-xl border ${on ? 'border-gray-200' : 'border-dashed border-gray-300 bg-gray-50'}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2 text-left font-semibold text-gray-900" aria-expanded={open}>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} /> {title}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}
          aria-pressed={on}
        >
          {on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {on ? t('show') : t('hidden')}
        </button>
        <IconButton label={t('moveUp')} onClick={onUp}>
          <ArrowUp className="h-4 w-4" />
        </IconButton>
        <IconButton label={t('moveDown')} onClick={onDown}>
          <ArrowDown className="h-4 w-4" />
        </IconButton>
      </div>
      {open && <div className="space-y-3 border-t border-gray-100 p-3">{children}</div>}
    </div>
  )
}

function PhotoField({
  title,
  value,
  onChange,
  onError,
  square,
  addLabel,
}: {
  title: string
  value: string
  onChange: (path: string) => void
  onError: (code: string) => void
  square?: boolean
  addLabel?: string
}) {
  const t = useTranslations('landingEditor')
  const [busy, setBusy] = useState(false)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    const resized = await resizeImageFile(file, square ? 512 : 1600, 0.85, { keepTransparency: square })
    if (!resized) {
      setBusy(false)
      return onError('photoError')
    }
    const fd = new FormData()
    fd.append('file', resized)
    const r = await uploadLandingPhoto(fd)
    setBusy(false)
    if (!r.success) return onError(r.message)
    onChange(r.path)
  }
  return (
    <div>
      {title && <span className={label}>{title}</span>}
      <div className="flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={landingPhotoUrl(value)} alt="" className={`h-16 rounded-lg object-cover ${square ? 'w-16' : 'w-24'}`} />
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : value ? <Camera className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {busy ? t('photoUploading') : addLabel ?? (value ? t('photoChange') : t('photoChoose'))}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-sm font-semibold text-red-600">
            {t('photoRemove')}
          </button>
        )}
      </div>
    </div>
  )
}

function swap<T>(list: T[], i: number, j: number) {
  ;[list[i], list[j]] = [list[j], list[i]]
}
function swapped<T>(list: T[], i: number, j: number): T[] {
  const copy = [...list]
  swap(copy, i, j)
  return copy
}

function AddButton({ label: text, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-400 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[var(--gold)] hover:text-gray-900">
      <Plus className="h-4 w-4" /> {text}
    </button>
  )
}

function IconButton({ label: text, onClick, danger, children }: { label: string; onClick?: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={text}
      title={text}
      className={`rounded-lg p-1.5 text-gray-500 disabled:opacity-30 ${danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-gray-100 hover:text-gray-900'}`}
    >
      {children}
    </button>
  )
}
