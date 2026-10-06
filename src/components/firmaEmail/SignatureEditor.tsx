'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ClipboardCopy, Code2, Download, Link2, Palette, RotateCcw, Share2, User, Image as ImageIcon, Phone } from 'lucide-react'
import { completeFirmaEmail } from '@/app/actions/firmaEmail'
import SignatureInstructions from '@/components/firmaEmail/SignatureInstructions'
import BusinessProfileImport from '@/components/businessProfile/BusinessProfileImport'
import { BUSINESS_SOCIALS, businessFullAddress, businessWebsiteUrl, type BusinessProfile } from '@/lib/businessProfile'
import { clearDraft, parseDraft, saveDraft } from '@/components/firmaEmail/draft'
import {
  DEFAULT_BRAND_COLOR,
  SIGNATURE_TEMPLATES,
  SOCIAL_KEYS,
  SOCIAL_NAMES,
  buildSignatureDocument,
  buildSignatureHtml,
  buildSignatureText,
  emptySignature,
  safeColor,
  safeUrl,
  socialHref,
  type SignatureData,
  type SignatureLabels,
  type SignatureTemplate,
  type SocialKey,
} from '@/lib/emailSignature'

export interface Prefill {
  fullName: string
  role: string
  email: string
  phone: string
}

type TextField = Exclude<keyof SignatureData, 'social' | 'includeCardLink' | 'color'>
type Status = 'copied' | 'htmlCopied' | 'downloaded' | 'copyFailed' | null

const cut = (value: string) => value.trim().slice(0, 300)

// Dati della Scheda attività dentro la firma: si sovrascrive solo dove la
// Scheda ha un valore. Con `contacts` riprende anche telefono ed email.
function withBusiness(base: SignatureData, p: BusinessProfile, contacts: boolean): SignatureData {
  const next: SignatureData = { ...base, social: { ...base.social } }
  const put = (field: 'company' | 'phone' | 'mobile' | 'email' | 'website' | 'address' | 'logoUrl', value: string) => {
    if (value.trim()) next[field] = cut(value)
  }
  put('company', p.companyName)
  put('website', businessWebsiteUrl(p.website))
  put('address', businessFullAddress(p))
  put('logoUrl', p.logoUrl ?? '')
  if (/^#[0-9a-f]{6}$/i.test(p.accent.trim())) next.color = safeColor(p.accent)
  for (const key of BUSINESS_SOCIALS) {
    const value = p.socials[key]
    if (value?.trim()) next.social[key] = cut(value)
  }
  if (contacts) {
    put('phone', p.phone)
    put('email', p.email)
    if (p.whatsapp.trim() && p.whatsapp.trim() !== p.phone.trim()) put('mobile', p.whatsapp)
  }
  return next
}

// Senza bozza: dati personali + quelli della Scheda (nome, sito, indirizzo,
// logo, colore, social); telefono ed email restano quelli personali.
function fromPrefill(prefill: Prefill, business: BusinessProfile | null): SignatureData {
  const base = { ...emptySignature(), ...prefill }
  return business ? withBusiness(base, business, false) : base
}

// Copia come testo formattato; se il browser non lo permette, seleziona una
// copia nascosta della firma e usa la copia classica.
async function copyRich(html: string, text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ])
      return true
    }
  } catch {
    // si passa alla copia tramite selezione
  }
  const holder = document.createElement('div')
  holder.contentEditable = 'true'
  holder.style.position = 'fixed'
  holder.style.left = '-9999px'
  holder.style.top = '0'
  holder.innerHTML = html // HTML costruito da buildSignatureHtml: ogni campo è già escapato
  document.body.appendChild(holder)
  const selection = window.getSelection()
  let ok = false
  try {
    const range = document.createRange()
    range.selectNodeContents(holder)
    selection?.removeAllRanges()
    selection?.addRange(range)
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    selection?.removeAllRanges()
    holder.remove()
  }
  return ok
}

async function copyPlain(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // si passa alla copia tramite selezione
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  return ok
}

export default function SignatureEditor({
  prefill,
  cardUrl,
  rawDraft,
  business,
}: {
  prefill: Prefill
  cardUrl: string | null
  rawDraft: string | null
  business: BusinessProfile | null
}) {
  const t = useTranslations('firmaEmail')
  const [initial] = useState(() => parseDraft(rawDraft, fromPrefill(prefill, business)))
  const [data, setData] = useState<SignatureData>(() => initial?.data ?? fromPrefill(prefill, business))
  const [template, setTemplate] = useState<SignatureTemplate>(() => initial?.template ?? 'classic')
  const [status, setStatus] = useState<Status>(null)
  const [frameHeight, setFrameHeight] = useState(180)
  const awarded = useRef(false)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const labels: SignatureLabels = useMemo(
    () => ({
      phone: t('sigPhone'),
      mobile: t('sigMobile'),
      email: t('sigEmail'),
      web: t('sigWeb'),
      whatsapp: t('sigWhatsapp'),
      cardLink: t('sigCardLink'),
    }),
    [t],
  )

  const html = useMemo(() => buildSignatureHtml(data, template, labels, cardUrl), [data, template, labels, cardUrl])
  const plain = useMemo(() => buildSignatureText(data, labels, cardUrl), [data, labels, cardUrl])
  const documentHtml = useMemo(() => buildSignatureDocument(html, t('docTitle')), [html, t])

  // Bozza nel browser a ogni modifica
  useEffect(() => {
    saveDraft({ data, template })
  }, [data, template])

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current)
    },
    [],
  )

  const flash = (next: Status) => {
    setStatus(next)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus(null), 2500)
  }

  const award = () => {
    if (awarded.current) return
    awarded.current = true
    void completeFirmaEmail()
  }

  const setField = (field: TextField, value: string) => setData(prev => ({ ...prev, [field]: value }))
  const setSocial = (key: SocialKey, value: string) => setData(prev => ({ ...prev, social: { ...prev.social, [key]: value } }))

  const handleCopySignature = async () => {
    if (!html) return
    const ok = await copyRich(html, plain)
    flash(ok ? 'copied' : 'copyFailed')
    if (ok) award()
  }

  const handleCopyHtml = async () => {
    if (!html) return
    const ok = await copyPlain(html)
    flash(ok ? 'htmlCopied' : 'copyFailed')
    if (ok) award()
  }

  const handleDownload = () => {
    if (!html) return
    const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'firma-email.html'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    flash('downloaded')
    award()
  }

  const handleReset = () => {
    clearDraft()
    setData(fromPrefill(prefill, business))
    setTemplate('classic')
  }

  const invalid = (value: string, imageOnly = false) => value.trim() !== '' && !safeUrl(value, imageOnly)

  const input = (field: TextField, label: string, opts: { type?: string; placeholder?: string; autoComplete?: string; urlCheck?: 'web' | 'image' } = {}) => (
    <Field
      label={label}
      error={opts.urlCheck && invalid(data[field], opts.urlCheck === 'image') ? t('invalidUrl') : null}
    >
      <input
        type={opts.type ?? 'text'}
        value={data[field]}
        onChange={e => setField(field, e.target.value)}
        placeholder={opts.placeholder}
        autoComplete={opts.autoComplete ?? 'off'}
        maxLength={300}
        className={inputClass}
      />
    </Field>
  )

  const noContent = !html
  const color = safeColor(data.color)

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {/* Modulo */}
      <div className="space-y-5">
        <BusinessProfileImport profile={business} onImport={p => setData(prev => withBusiness(prev, p, true))} />

        <Section icon={<Palette className="h-5 w-5" />} title={t('sectionTemplate')}>
          <div className="grid grid-cols-3 gap-2">
            {SIGNATURE_TEMPLATES.map(id => {
              const active = template === id
              const name = id === 'classic' ? t('templateClassic') : id === 'compact' ? t('templateCompact') : t('templateModern')
              const hint = id === 'classic' ? t('templateClassicHint') : id === 'compact' ? t('templateCompactHint') : t('templateModernHint')
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTemplate(id)}
                  aria-pressed={active}
                  className={`rounded-2xl border p-3 text-left transition ${
                    active
                      ? 'border-[var(--gold)] bg-[var(--gold-pale)]/60 shadow-sm'
                      : 'border-black/10 bg-white hover:border-[var(--gold)]/50'
                  }`}
                >
                  <span className="block text-sm font-semibold text-[var(--ink)]">{name}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-[var(--muted)]">{hint}</span>
                </button>
              )
            })}
          </div>
        </Section>

        <Section icon={<User className="h-5 w-5" />} title={t('sectionIdentity')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">{input('fullName', t('fullName'), { autoComplete: 'name' })}</div>
            {input('role', t('role'), { autoComplete: 'organization-title' })}
            {input('company', t('company'), { autoComplete: 'organization' })}
          </div>
        </Section>

        <Section icon={<Phone className="h-5 w-5" />} title={t('sectionContacts')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {input('phone', t('phone'), { type: 'tel', autoComplete: 'tel' })}
            {input('mobile', t('mobile'), { type: 'tel' })}
            {input('email', t('email'), { type: 'email', autoComplete: 'email' })}
            {input('website', t('website'), { type: 'url', placeholder: 'https://', autoComplete: 'url', urlCheck: 'web' })}
            <div className="sm:col-span-2">{input('address', t('address'), { autoComplete: 'street-address' })}</div>
          </div>
        </Section>

        <Section icon={<ImageIcon className="h-5 w-5" />} title={t('sectionImages')}>
          <p className="mb-3 text-xs leading-5 text-[var(--muted)]">{t('imagesHint')}</p>
          <div className="grid gap-3">
            {input('logoUrl', t('logoUrl'), { type: 'url', placeholder: 'https://', urlCheck: 'image' })}
            {input('photoUrl', t('photoUrl'), { type: 'url', placeholder: 'https://', urlCheck: 'image' })}
          </div>
        </Section>

        <Section icon={<Palette className="h-5 w-5" />} title={t('sectionBrand')}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 text-sm font-medium text-[var(--ink)]">
              <input
                type="color"
                value={color}
                onChange={e => setData(prev => ({ ...prev, color: e.target.value }))}
                className="h-11 w-14 cursor-pointer rounded-lg border border-black/10 bg-white p-1"
              />
              {t('brandColor')}
              <span className="font-mono text-xs text-[var(--muted)]">{color}</span>
            </label>
            {color !== DEFAULT_BRAND_COLOR ? (
              <button
                type="button"
                onClick={() => setData(prev => ({ ...prev, color: DEFAULT_BRAND_COLOR }))}
                className="rounded-full border border-[var(--gold)]/40 px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--gold-pale)]/60"
              >
                {t('resetColor')}
              </button>
            ) : null}
          </div>
        </Section>

        <Section icon={<Share2 className="h-5 w-5" />} title={t('sectionSocial')}>
          <p className="mb-3 text-xs leading-5 text-[var(--muted)]">{t('socialHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SOCIAL_KEYS.map(key => (
              <Field
                key={key}
                label={SOCIAL_NAMES[key]}
                error={data.social[key].trim() && !socialHref(key, data.social[key]) ? t('invalidUrl') : null}
              >
                <input
                  type="text"
                  value={data.social[key]}
                  onChange={e => setSocial(key, e.target.value)}
                  placeholder="https://"
                  autoComplete="off"
                  maxLength={300}
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
        </Section>

        <Section icon={<Link2 className="h-5 w-5" />} title={t('cardToggle')}>
          <label className={`flex items-start gap-3 ${cardUrl ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
            <input
              type="checkbox"
              role="switch"
              checked={Boolean(cardUrl) && data.includeCardLink}
              disabled={!cardUrl}
              onChange={e => setData(prev => ({ ...prev, includeCardLink: e.target.checked }))}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-black/15 transition peer-checked:bg-[var(--gold)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--gold)]/50 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
            />
            <span className="text-sm leading-6 text-[var(--ink)]">
              {cardUrl ? t('cardToggleHint') : t('cardUnavailable')}
              {cardUrl ? <span className="block break-all text-xs text-[var(--muted)]">{cardUrl}</span> : null}
            </span>
          </label>
        </Section>
      </div>

      {/* Anteprima e azioni */}
      <div className="space-y-5 lg:sticky lg:top-24">
        <section className="rounded-3xl border border-[var(--gold)]/25 bg-[var(--paper)] p-5 shadow-sm sm:p-6">
          <h3 className="mb-1 text-lg font-bold text-[var(--ink)]">{t('preview')}</h3>
          <p className="mb-4 text-xs leading-5 text-[var(--muted)]">{t('previewHint')}</p>
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
            {noContent ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">{t('previewEmpty')}</p>
            ) : (
              <iframe
                title={t('preview')}
                srcDoc={documentHtml}
                sandbox="allow-same-origin"
                className="block w-full"
                style={{ height: frameHeight }}
                onLoad={e => {
                  const body = e.currentTarget.contentDocument?.body
                  if (body) setFrameHeight(Math.max(120, body.scrollHeight + 4))
                }}
              />
            )}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ActionButton primary disabled={noContent} onClick={handleCopySignature} icon={<ClipboardCopy className="h-4 w-4" />}>
              {t('copySignature')}
            </ActionButton>
            <ActionButton disabled={noContent} onClick={handleCopyHtml} icon={<Code2 className="h-4 w-4" />}>
              {t('copyHtml')}
            </ActionButton>
            <ActionButton disabled={noContent} onClick={handleDownload} icon={<Download className="h-4 w-4" />}>
              {t('download')}
            </ActionButton>
          </div>

          <div aria-live="polite" className="mt-3 min-h-5 text-center text-sm">
            {status === 'copyFailed' ? (
              <span className="text-red-700">{t('copyFailed')}</span>
            ) : status ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <Check className="h-4 w-4" />
                {t(status)}
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-3 text-xs text-[var(--muted)]">
            <span>{t('draftNote')}</span>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 font-medium text-[var(--ink)] transition hover:text-[var(--gold)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('reset')}
            </button>
          </div>
        </section>

        <SignatureInstructions />
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition placeholder:text-black/30 focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/25'

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-black/5 bg-[var(--paper)] p-5 shadow-sm sm:p-6">
      <h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
        <span className="text-[var(--gold)]">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({ label, error, children }: { label: string; error: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  )
}

function ActionButton({
  primary,
  disabled,
  onClick,
  icon,
  children,
}: {
  primary?: boolean
  disabled: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? 'bg-[var(--ink)] text-[var(--gold-bright)] hover:shadow-lg'
          : 'border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]/50'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
