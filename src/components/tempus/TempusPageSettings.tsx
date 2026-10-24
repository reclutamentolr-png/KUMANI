'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, Download, ExternalLink, LoaderCircle, MessageCircle } from 'lucide-react'
import { checkTempusSlug, saveTempusPage } from '@/app/actions/tempus'
import type { TempusSettings } from '@/lib/tempus'
import { card, field, label, primary, secondary } from './ui'

export default function TempusPageSettings({
  settings,
  businessName,
  hasServices,
  publicBase,
  onSettings,
}: {
  settings: TempusSettings
  businessName: string
  hasServices: boolean
  publicBase: string
  onSettings: (s: TempusSettings) => void
}) {
  const t = useTranslations('tempus')
  const [form, setForm] = useState({ slug: settings.slug, title: settings.title, intro: settings.intro, show_prices: settings.show_prices, is_published: settings.is_published })
  const [slugError, setSlugError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState('')
  const link = `${publicBase}${settings.slug}`

  // Controllo dell'indirizzo mentre si scrive (quello vero è al salvataggio)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'indirizzo salvato è sempre valido
    if (form.slug === settings.slug) return setSlugError('')
    const timer = setTimeout(async () => {
      const res = await checkTempusSlug(form.slug)
      setSlugError(res.ok ? '' : t(`error_${res.message}`))
    }, 400)
    return () => clearTimeout(timer)
  }, [form.slug, settings.slug, t])

  useEffect(() => {
    let alive = true
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(link, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#171717', light: '#ffffff' } }))
      .then((url) => alive && setQr(url))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [link])

  const save = async (patch: Partial<typeof form> = {}) => {
    const next = { ...form, ...patch }
    setBusy(true)
    setError('')
    const res = await saveTempusPage({ ...settings, ...next })
    setBusy(false)
    if (!res.success) return setError(t(`error_${res.message}`))
    onSettings(res.settings)
    setForm({ slug: res.settings.slug, title: res.settings.title, intro: res.settings.intro, show_prices: res.settings.show_prices, is_published: res.settings.is_published })
    setSaved(true)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // appunti non disponibili
    }
  }

  const shareText = t('shareMessage', { business: settings.title || businessName || '', url: link })

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('publishTitle')}</h3>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{settings.is_published ? t('publishedText') : t('unpublishedText')}</p>
          </div>
          <button
            type="button"
            onClick={() => save({ is_published: !settings.is_published })}
            disabled={busy || (!settings.is_published && !hasServices) || settings.suspended}
            className={settings.is_published ? secondary : primary}
          >
            {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
            {settings.is_published ? t('unpublish') : t('publish')}
          </button>
        </div>
        {!hasServices && !settings.is_published && <p className="mt-2 text-sm text-[var(--muted)]">{t('setupServicesFirst')}</p>}

        <div className="mt-5 rounded-2xl bg-[var(--paper)] p-4">
          <p className="text-sm font-semibold text-[var(--ink)]">{t('yourLink')}</p>
          <p className="mt-1 break-all font-mono text-sm text-[var(--ink)]">{link}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className={secondary}>
              {copied ? <Check className="h-4 w-4 text-green-700" /> : <Copy className="h-4 w-4" />} {copied ? t('copied') : t('copyLink')}
            </button>
            <a href={link} target="_blank" rel="noopener noreferrer" className={secondary}>
              <ExternalLink className="h-4 w-4" /> {settings.is_published ? t('openPage') : t('previewPage')}
            </a>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className={secondary}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            {qr && (
              <a href={qr} download={`prenota-${settings.slug}.png`} className={secondary}>
                <Download className="h-4 w-4" /> {t('downloadQr')}
              </a>
            )}
          </div>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={t('qrAlt')} className="mt-4 h-40 w-40 rounded-xl border border-gray-200 bg-white" />
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">{t('linkTips')}</p>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('pageTitle')}</h3>
        <div className="mt-4 space-y-4">
          <label className={label}>
            {t('slugLabel')}
            <div className="mt-1 flex items-center rounded-xl border-2 border-gray-200 bg-white focus-within:border-[var(--gold)]">
              <span className="pl-3 text-sm text-[var(--muted)]">…/prenota/</span>
              <input
                value={form.slug}
                onChange={(e) => {
                  setSaved(false)
                  setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) })
                }}
                className="min-w-0 flex-1 rounded-r-xl bg-transparent px-1 py-2.5 font-bold text-[var(--ink)] focus:outline-none"
              />
            </div>
            {slugError ? <span className="mt-1 block text-xs font-semibold text-red-700">{slugError}</span> : form.slug !== settings.slug && settings.is_published ? <span className="mt-1 block text-xs text-amber-800">{t('slugChangeWarning')}</span> : null}
          </label>
          <label className={label}>
            {t('pageName')}
            <input value={form.title} onChange={(e) => (setSaved(false), setForm({ ...form, title: e.target.value.slice(0, 80) }))} className={field} placeholder={businessName || t('pageNamePlaceholder')} />
          </label>
          <label className={label}>
            {t('pageIntro')}
            <textarea value={form.intro} onChange={(e) => (setSaved(false), setForm({ ...form, intro: e.target.value.slice(0, 600) }))} rows={3} className={field} placeholder={t('pageIntroPlaceholder')} />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={form.show_prices} onChange={(e) => (setSaved(false), setForm({ ...form, show_prices: e.target.checked }))} className="h-4 w-4 accent-[var(--gold)]" />
            {t('showPrices')}
          </label>
          <p className="text-xs text-[var(--muted)]">{t('businessDataHint')}</p>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={() => save()} disabled={busy || !!slugError} className={primary}>
            {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
            {t('save')}
          </button>
          {saved && <span className="text-sm font-semibold text-green-700">{t('saved')}</span>}
        </div>
      </div>
    </div>
  )
}
