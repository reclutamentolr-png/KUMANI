'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, Camera, Check, LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import BrandCamera from './BrandCamera'
import { saveBrand, type BrandState } from '@/app/actions/brand'
import {
  BRAND_ROLES,
  BRAND_SERVICES,
  BRAND_SERVICES_SOON,
  DEFAULT_PALETTE,
  HARMONIES,
  colorsFromImage,
  contrastPairs,
  fixContrast,
  harmonyPalette,
  hueOf,
  paletteFromSwatches,
  qrColor,
  readableOn,
  type BrandFollow,
  type BrandPalette,
  type BrandRole,
  type Harmony,
} from '@/lib/brand'

// camera = colori presi dal vivo con la fotocamera (insegna, bancone, vetrina…)
type Source = 'logo' | 'camera' | 'harmony' | 'hand'
const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm'
const primaryBtn = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-5 text-base font-bold text-[var(--gold-bright)] disabled:opacity-50'
const ghostBtn = 'inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--gold)]/40 bg-white px-5 text-base font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]'

export default function BrandWizard({ initial }: { initial: BrandState }) {
  const t = useTranslations('brand')
  const firstTime = !initial.palette
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [source, setSource] = useState<Source>(initial.logoUrl ? 'logo' : 'harmony')
  const [palette, setPalette] = useState<BrandPalette>(initial.palette ?? DEFAULT_PALETTE)
  const [active, setActive] = useState<BrandRole>('primary')
  const [logoSwatches, setLogoSwatches] = useState<string[] | null>(null)
  const [logoError, setLogoError] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraSwatches, setCameraSwatches] = useState<string[]>([])
  const [harmony, setHarmony] = useState<Harmony>('contrast')
  const [baseColor, setBaseColor] = useState(initial.palette?.primary ?? '#7a2e1f')
  // Prima volta: tutti i servizi proposti; poi le scelte salvate
  const [follow, setFollow] = useState<BrandFollow>(() => (firstTime ? Object.fromEntries(BRAND_SERVICES.map((s) => [s, true])) : initial.follow))
  // Colori toccati a mano: i colori del logo non li sovrascrivono più
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Colori del logo: calcolati qui nel browser, una volta sola
  useEffect(() => {
    if (source !== 'logo' || !initial.logoUrl || logoSwatches !== null) return
    let alive = true
    colorsFromImage(initial.logoUrl)
      .then((swatches) => {
        if (!alive) return
        setLogoSwatches(swatches)
        if (firstTime && !touched && swatches.length) changePalette(paletteFromSwatches(swatches))
      })
      .catch(() => alive && (setLogoError(true), setLogoSwatches([])))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, initial.logoUrl, logoSwatches, firstTime])

  const generated = useMemo(() => harmonyPalette(hueOf(baseColor), harmony), [baseColor, harmony])
  const candidates = source === 'logo' ? (logoSwatches ?? []) : source === 'camera' ? cameraSwatches : source === 'harmony' ? generated.swatches : []
  const pairs = contrastPairs(palette)
  const bad = pairs.filter((p) => !p.ok).length
  const onPrimary = readableOn(palette.primary)
  const qr = qrColor(palette)

  // Ogni cambiamento dei colori va salvato di nuovo
  function changePalette(next: BrandPalette) {
    setPalette(next)
    setSaved(false)
  }
  const setRole = (role: BrandRole, hex: string) => {
    setTouched(true)
    changePalette({ ...palette, [role]: hex.toLowerCase() })
  }
  const pickHarmony = (h: Harmony) => {
    setHarmony(h)
    setTouched(true)
    changePalette(harmonyPalette(hueOf(baseColor), h).palette)
  }
  const fixPair = (role: BrandRole, against: string, min: number) => setRole(role, fixContrast(palette[role], against, min))

  const save = async () => {
    setSaving(true)
    setError(null)
    const result = await saveBrand(palette, follow)
    setSaving(false)
    if (!result.success) {
      setError(t(`errors.${result.message === 'planRequired' ? 'planRequired' : 'saveError'}`))
      return
    }
    setSaved(true)
  }

  const tab = (on: boolean) =>
    `min-h-11 rounded-xl px-2 text-sm font-bold transition-colors ${on ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`
  const chip = (on: boolean) =>
    `min-h-10 rounded-full px-4 text-sm font-bold ${on ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-[var(--gold)]/35 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]'}`

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-3 gap-2" aria-label={t('stepsLabel')}>
        {([1, 2, 3] as const).map((n) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => setStep(n)}
              aria-current={step === n ? 'step' : undefined}
              className={`flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-bold ${step === n ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-[var(--gold)]/30 bg-white text-[var(--muted)]'}`}
            >
              {n} · {t(`steps.s${n}`)}
            </button>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <>
          {cameraOpen && (
            <BrandCamera
              onClose={() => setCameraOpen(false)}
              onColors={(swatches) => {
                setCameraOpen(false)
                setCameraSwatches(swatches)
                setTouched(true)
                changePalette(paletteFromSwatches(swatches))
              }}
            />
          )}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--gold)]/25 bg-white p-1 sm:grid-cols-4" role="group" aria-label={t('sourceLabel')}>
            {(['logo', 'camera', 'harmony', 'hand'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={source === s} onClick={() => setSource(s)} className={tab(source === s)}>
                {t(`sources.${s}`)}
              </button>
            ))}
          </div>

          {source === 'logo' && (
            <section className={`${card} flex items-center gap-4`}>
              {initial.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={initial.logoUrl} crossOrigin="anonymous" alt={t('logoAlt')} className="h-20 w-20 shrink-0 rounded-2xl border border-[var(--gold)]/25 bg-white object-contain p-1" />
              ) : null}
              <div className="min-w-0">
                <p className="font-bold text-[var(--ink)]">{initial.logoUrl ? t('logoTitle') : t('noLogoTitle')}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {!initial.logoUrl ? t('noLogoText') : logoError ? t('logoError') : logoSwatches === null ? t('logoReading') : t('logoText')}
                </p>
                {!initial.logoUrl && (
                  <Link href="/scheda-attivita" className="mt-2 inline-block text-sm font-bold text-[#8a6a1f] hover:text-[var(--ink)]">
                    {t('noLogoCta')}
                  </Link>
                )}
              </div>
            </section>
          )}

          {source === 'camera' && (
            <section className={`${card} space-y-3`}>
              <p className="font-bold text-[var(--ink)]">{t('cameraTitle')}</p>
              <p className="text-sm text-[var(--muted)]">{t('cameraText')}</p>
              {cameraSwatches.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label={t('cameraSwatches')}>
                  {cameraSwatches.map((hex) => (
                    <span key={hex} className="h-9 w-9 rounded-lg border border-black/10" style={{ background: hex }} title={hex} />
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setCameraOpen(true)} className={primaryBtn}>
                <Camera className="h-5 w-5" /> {t(cameraSwatches.length ? 'cameraAgain' : 'cameraOpen')}
              </button>
            </section>
          )}

          {source === 'harmony' && (
            <section className={`${card} space-y-3`}>
              <p className="font-bold text-[var(--ink)]">{t('harmonyTitle')}</p>
              <label className="flex items-center gap-3 text-sm font-semibold text-[var(--muted)]">
                <input
                  type="color"
                  value={baseColor}
                  onChange={(e) => {
                    setBaseColor(e.target.value)
                    setTouched(true)
                    changePalette(harmonyPalette(hueOf(e.target.value), harmony).palette)
                  }}
                  className="h-11 w-16 cursor-pointer rounded-lg border border-[var(--gold)]/35"
                />
                {t('harmonyBase')}
              </label>
              <div className="flex flex-wrap gap-2">
                {HARMONIES.map((h) => (
                  <button key={h} type="button" aria-pressed={harmony === h} onClick={() => pickHarmony(h)} className={chip(harmony === h)}>
                    {t(`harmonies.${h}`)}
                  </button>
                ))}
              </div>
              <p className="text-sm text-[var(--muted)]">{t(`harmonyHints.${harmony}`)}</p>
            </section>
          )}

          {source === 'hand' && (
            <section className={card}>
              <p className="font-bold text-[var(--ink)]">{t('handTitle')}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{t('handText')}</p>
            </section>
          )}

          <section className={`${card} space-y-2`}>
            <h2 className="text-base font-extrabold text-[var(--ink)]">{t('rolesTitle')}</h2>
            <p className="text-sm text-[var(--muted)]">{t('rolesText')}</p>
            {BRAND_ROLES.map((role) => (
              <div
                key={role}
                className={`flex items-center gap-3 rounded-2xl p-2 ${active === role ? 'border-2 border-[var(--ink)] bg-[var(--gold-pale)]/50' : 'border border-[var(--gold)]/20'}`}
              >
                <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-black/10 focus-within:ring-2 focus-within:ring-[var(--ink)] focus-within:ring-offset-2" style={{ background: palette[role] }}>
                  <span className="sr-only">{t('pickColor', { role: t(`roles.${role}`) })}</span>
                  <input type="color" value={palette[role]} onChange={(e) => setRole(role, e.target.value)} onFocus={() => setActive(role)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
                <button type="button" onClick={() => setActive(role)} aria-pressed={active === role} className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left">
                  <span className="min-w-0">
                    <span className="block font-bold text-[var(--ink)]">{t(`roles.${role}`)}</span>
                    <span className="block text-xs text-[var(--muted)]">{t(`roleHints.${role}`)}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-[var(--muted)]">{palette[role]}</span>
                </button>
              </div>
            ))}
            {candidates.length > 0 && (
              <>
                <p className="pt-2 text-sm font-bold text-[var(--ink)]">{t(source === 'logo' ? 'candidatesLogo' : 'candidatesHarmony', { role: t(`roles.${active}`) })}</p>
                <div className="flex flex-wrap gap-2.5">
                  {candidates.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setRole(active, hex)}
                      aria-label={t('useColor', { color: hex, role: t(`roles.${active}`) })}
                      className={`h-11 w-11 rounded-full ${Object.values(palette).includes(hex) ? 'ring-2 ring-[var(--ink)] ring-offset-2' : 'border border-black/15'}`}
                      style={{ background: hex }}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          <Preview palette={palette} onPrimary={onPrimary} />

          <button type="button" onClick={() => setStep(2)} className={primaryBtn}>
            {t('next2')}
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <section className={`flex items-center gap-3 rounded-3xl p-4 ${bad === 0 ? 'bg-[#e7f4ea] text-[#14532d]' : 'bg-red-50 text-red-900'}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white" aria-hidden="true">
              {bad === 0 ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            </span>
            <span>
              <span className="block font-extrabold">{bad === 0 ? t('allReadable') : t('someUnreadable', { count: bad })}</span>
              <span className="block text-sm">{bad === 0 ? t('allReadableText') : t('someUnreadableText')}</span>
            </span>
          </section>
          {pairs.map((p) => {
            const min = p.id === 'accentOnBackground' ? 3 : 4.5
            return (
              <section key={p.id} className={`${card} space-y-3`}>
                <div className="rounded-2xl border border-black/5 p-4" style={{ background: p.bg, color: p.fg }}>
                  <p className="text-lg font-extrabold">{t(`pairs.${p.id}.sample`)}</p>
                  <p className="text-sm">{t('sampleText')}</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-bold text-[var(--ink)]">{t(`pairs.${p.id}.label`)}</span>
                    <span className={`block text-sm font-semibold ${p.ok ? 'text-[#1d6b34]' : 'text-red-700'}`}>
                      {p.ok ? t('readable') : t('unreadable')} · {p.ratio.toFixed(1).replace('.', ',')}:1
                    </span>
                  </span>
                  {!p.ok && (
                    <button type="button" onClick={() => fixPair(p.fixRole, p.against, min)} className="min-h-11 shrink-0 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)]">
                      {t('fix')}
                    </button>
                  )}
                </div>
              </section>
            )
          })}
          <p className="text-xs text-[var(--muted)]">{t('wcagNote')}</p>
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <button type="button" onClick={() => setStep(1)} className={ghostBtn}>
              {t('back')}
            </button>
            <button type="button" onClick={() => setStep(3)} className={primaryBtn}>
              {t('next3')}
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <ServicePreviews palette={palette} onPrimary={onPrimary} qr={qr} />
          <section className={card}>
            <h2 className="text-base font-extrabold text-[var(--ink)]">{t('servicesTitle')}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('servicesText')}</p>
            <ul className="mt-2 divide-y divide-[var(--gold)]/15">
              {BRAND_SERVICES.map((s) => (
                <li key={s}>
                  <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-bold text-[var(--ink)]">{t(`services.${s}.name`)}</span>
                      <span className="block text-xs text-[var(--muted)]">{t(`services.${s}.hint`)}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={!!follow[s]}
                      onChange={() => {
                        setFollow((prev) => ({ ...prev, [s]: !prev[s] }))
                        setSaved(false)
                      }}
                      className="h-5 w-5 shrink-0 accent-[var(--ink)]"
                    />
                  </label>
                </li>
              ))}
              {BRAND_SERVICES_SOON.map((s) => (
                <li key={s} className="flex min-h-14 items-center justify-between gap-3 py-2 opacity-55">
                  <span>
                    <span className="block font-bold text-[var(--ink)]">{t(`soon.${s}`)}</span>
                    <span className="block text-xs text-[var(--muted)]">{t('soonHint')}</span>
                  </span>
                  <input type="checkbox" disabled className="h-5 w-5" aria-label={t('soonHint')} />
                </li>
              ))}
            </ul>
          </section>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          {saved ? (
            <section role="status" className="rounded-3xl bg-[#e7f4ea] p-5 text-[#14532d]">
              <p className="font-extrabold">{t('savedTitle')}</p>
              <p className="mt-1 text-sm">{t('savedText')}</p>
              <Link href="/scheda-attivita" className="mt-3 inline-block text-sm font-bold underline-offset-2 hover:underline">
                {t('backToProfile')}
              </Link>
            </section>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <button type="button" onClick={() => setStep(2)} className={ghostBtn}>
                {t('back')}
              </button>
              <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
                {saving && <LoaderCircle className="h-5 w-5 animate-spin" />}
                {t('save')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Preview({ palette, onPrimary }: { palette: BrandPalette; onPrimary: string }) {
  const t = useTranslations('brand')
  return (
    <section className="space-y-2 rounded-3xl border border-black/10 p-5" style={{ background: palette.background, color: palette.text }}>
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] opacity-75">{t('preview')}</p>
      <p className="text-2xl font-bold">{t('previewTitle')}</p>
      <p className="text-sm">{t('previewText')}</p>
      <span className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-extrabold" style={{ background: palette.primary, color: onPrimary, borderBottom: `3px solid ${palette.accent}` }}>
        {t('previewButton')}
      </span>
    </section>
  )
}

// Miniature dei servizi con i colori scelti
function ServicePreviews({ palette, onPrimary, qr }: { palette: BrandPalette; onPrimary: string; qr: string }) {
  const t = useTranslations('brand')
  const label = (key: string) => <p className="px-3 pb-2.5 pt-1.5 text-[11px] font-extrabold text-[var(--muted)]">{t(`services.${key}.name`)}</p>
  return (
    <div className="grid grid-cols-2 gap-3" aria-hidden="true">
      <div className="overflow-hidden rounded-2xl border border-[var(--gold)]/25" style={{ background: palette.background }}>
        <div className="px-3 py-2.5 text-sm font-bold" style={{ background: palette.primary, color: onPrimary }}>
          {t('previewTitle')}
        </div>
        <div className="space-y-1.5 px-3 py-2" style={{ color: palette.text }}>
          <p className="text-[11px]">{t('previewShort')}</p>
          <span className="inline-block rounded-md px-2 py-1 text-[10px] font-extrabold" style={{ background: palette.primary, color: onPrimary, borderBottom: `2px solid ${palette.accent}` }}>
            {t('previewButton')}
          </span>
        </div>
        {label('landing')}
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-white">
        <div className="h-2.5" style={{ background: palette.primary }} />
        <div className="h-0.5" style={{ background: palette.accent }} />
        <div className="space-y-1.5 px-3 py-2">
          <p className="text-xs font-extrabold" style={{ color: palette.primary }}>
            {t('previewQuote')}
          </p>
          <span className="block h-1.5 rounded bg-gray-200" />
          <span className="block h-1.5 w-2/3 rounded bg-gray-200" />
        </div>
        {label('quotes')}
      </div>
      <div className="flex flex-col items-center rounded-2xl border border-[var(--gold)]/25 bg-white pt-3">
        <svg width="76" height="76" viewBox="0 0 7 7" shapeRendering="crispEdges">
          <rect width="7" height="7" fill="#ffffff" />
          <path fill={qr} d="M0 0h3v3H0zM4 0h3v3H4zM0 4h3v3H0zM4 4h1v1H4zM6 4h1v1H6zM5 5h1v1H5zM4 6h1v1H4zM6 6h1v1H6zM3 3h1v1H3zM3 1h1v1H3zM1 3h1v1H1z" />
          <path fill="#ffffff" d="M1 1h1v1H1zM5 1h1v1H5zM1 5h1v1H1z" />
        </svg>
        <div className="self-start">{label('qr')}</div>
      </div>
      <div className="space-y-1.5 rounded-2xl border border-[var(--gold)]/25 px-3 pt-3" style={{ background: palette.background }}>
        <span className="mx-auto block h-8 w-8 rounded-full" style={{ background: palette.primary }} />
        <span className="block rounded-md py-1 text-center text-[10px] font-extrabold" style={{ background: palette.primary, color: onPrimary }}>
          {t('previewLink')}
        </span>
        <span className="block rounded-md border bg-white py-1 text-center text-[10px] font-extrabold" style={{ borderColor: palette.accent, color: palette.text }}>
          WhatsApp
        </span>
        <div className="-mx-3">{label('bio')}</div>
      </div>
    </div>
  )
}
