'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, Download, ExternalLink, FileText, LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import BusinessCardCanvas, { BLEED, CARD_H, CARD_W, FULL_H, FULL_W, type CardDesign, type CardSide } from './BusinessCardCanvas'
import { saveBusinessCard, type BusinessCardSettings } from '@/app/actions/businessCard'

// Documenti → Il mio biglietto da visita: scelta del modello, contatti da
// mostrare nella pagina del QR, download in PDF (per la tipografia, con il
// margine di taglio) e come immagine.

type Props = {
  cardUrl: string
  cardPath: string
  initial: BusinessCardSettings
  hasPhone: boolean
  hasEmail: boolean
}

const LOGO = '/brand/logo-gold-hd.png'

export default function BusinessCardEditor({ cardUrl, cardPath, initial, hasPhone, hasEmail }: Props) {
  const t = useTranslations('businessCard')
  const [settings, setSettings] = useState<BusinessCardSettings>(initial)
  const [qrSvg, setQrSvg] = useState('')
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)
  const front = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // qrcode caricato solo quando serve, fuori dal bundle iniziale
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toString(cardUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#00000000' } }))
      .then(setQrSvg)
  }, [cardUrl])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setScale(el.clientWidth / FULL_W)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const texts = {
    tagline: t('cardTagline'),
    scanMe: t('cardScanMe'),
    scanContacts: t('cardScanContacts'),
    scanTitle: t('cardScanTitle'),
    scanText: t('cardScanText'),
  }

  const update = async (patch: Partial<BusinessCardSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    setSaved(false)
    const res = await saveBusinessCard(next)
    if (res.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else setError(true)
  }

  const sides: CardSide[] = settings.design === 'C' ? ['front', 'back'] : ['front']
  const refFor = (side: CardSide) => (side === 'front' ? front : back)

  const render = async (side: CardSide) => {
    const { toPng } = await import('html-to-image')
    await document.fonts.ready
    // Doppia risoluzione: circa 600 dpi, nitido anche in stampa
    return toPng(refFor(side).current!, { width: FULL_W, height: FULL_H, pixelRatio: 2, cacheBust: true, style: { transform: 'none' } })
  }

  const download = (href: string, name: string) => {
    const a = document.createElement('a')
    a.href = href
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const fileBase = `KUMANI_biglietto_${settings.design}`

  const exportPdf = async () => {
    setBusy('pdf')
    setError(false)
    try {
      const { jsPDF } = await import('jspdf')
      // 85×55 mm + 3 mm di margine di taglio per lato
      const pdf = new jsPDF({ unit: 'mm', format: [91, 61], orientation: 'landscape' })
      for (const [i, side] of sides.entries()) {
        if (i > 0) pdf.addPage([91, 61], 'landscape')
        pdf.addImage(await render(side), 'PNG', 0, 0, 91, 61)
      }
      download(URL.createObjectURL(pdf.output('blob')), `${fileBase}_stampa.pdf`)
    } catch (e) {
      console.error('[biglietto]', e)
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  // Immagine senza margine di taglio (per inviarla o stamparla in casa)
  const exportPng = async () => {
    setBusy('png')
    setError(false)
    try {
      for (const side of sides) {
        const full = await render(side)
        const img = new Image()
        img.src = full
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = CARD_W * 2
        canvas.height = CARD_H * 2
        canvas.getContext('2d')!.drawImage(img, BLEED * 2, BLEED * 2, CARD_W * 2, CARD_H * 2, 0, 0, CARD_W * 2, CARD_H * 2)
        download(canvas.toDataURL('image/png'), `${fileBase}${sides.length > 1 ? (side === 'front' ? '_fronte' : '_retro') : ''}.png`)
      }
    } catch (e) {
      console.error('[biglietto]', e)
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(true)
    }
  }

  const designs: CardDesign[] = ['A', 'B', 'C']
  const toggle = (key: 'show_phone' | 'show_whatsapp' | 'show_email', label: string, available: boolean) => (
    <label key={key} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${available ? 'cursor-pointer border-[var(--gold)]/25 bg-white' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
      <span className="text-sm font-semibold">{label}</span>
      <input type="checkbox" disabled={!available} checked={available && settings[key]} onChange={(e) => update({ [key]: e.target.checked })} className="h-5 w-5 accent-[var(--gold)]" />
    </label>
  )

  return (
    <div className="space-y-6">
      {/* Modello */}
      <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[var(--ink)]">{t('designTitle')}</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {designs.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => update({ design: d })}
              aria-pressed={settings.design === d}
              className={`rounded-xl border-2 px-3 py-3 text-left transition ${settings.design === d ? 'border-[var(--gold)] bg-[var(--gold-pale)]' : 'border-[var(--gold)]/20 hover:border-[var(--gold)]/60'}`}
            >
              <span className="block text-sm font-bold text-[var(--ink)]">{t(`design${d}`)}</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">{t(`design${d}Hint`)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Anteprima */}
      <section className="space-y-3">
        <div ref={box} className="w-full">
          {sides.map((side) => (
            <div key={side} className="mb-3">
              {sides.length > 1 && <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{t(side === 'front' ? 'front' : 'backSide')}</p>}
              <div className="relative overflow-hidden rounded-xl shadow-lg" style={{ height: CARD_H * scale, width: CARD_W * scale }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: FULL_W, height: FULL_H, marginLeft: -BLEED * scale, marginTop: -BLEED * scale }}>
                  <BusinessCardCanvas ref={refFor(side)} design={settings.design} side={side} texts={texts} qrSvg={qrSvg} logoUrl={LOGO} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={exportPdf} disabled={busy !== null || !qrSvg} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-extrabold text-[var(--ink)] shadow-sm transition hover:brightness-105 disabled:opacity-60">
            {busy === 'pdf' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />} {busy === 'pdf' ? t('generating') : t('downloadPdf')}
          </button>
          <button type="button" onClick={exportPng} disabled={busy !== null || !qrSvg} className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-white px-5 py-3 font-bold text-[var(--ink)] transition hover:border-[var(--gold)] disabled:opacity-60">
            {busy === 'png' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5 text-[var(--gold)]" />} {busy === 'png' ? t('generating') : t('downloadImage')}
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">{t('printHint')}</p>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t('error')}</p>}
      </section>

      {/* Pagina del QR */}
      <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[var(--ink)]">{t('pageTitle')}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('pageIntro')}</p>
        <div className="mt-4 space-y-2">
          {toggle('show_phone', t('showPhone'), hasPhone)}
          {toggle('show_whatsapp', t('showWhatsapp'), hasPhone)}
          {toggle('show_email', t('showEmail'), hasEmail)}
        </div>
        {(!hasPhone || !hasEmail) && <p className="mt-2 text-xs text-[var(--muted)]">{t('missingData')}</p>}
        <p className="mt-2 h-4 text-xs font-semibold text-emerald-700">{saved ? t('saved') : ''}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={cardPath} target="_blank" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--gold-bright)]">
            <ExternalLink className="h-4 w-4" /> {t('openPage')}
          </Link>
          <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/50 px-4 py-2 text-sm font-bold text-[var(--ink)]">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-[var(--gold)]" />} {copied ? t('copied') : t('copyLink')}
          </button>
        </div>
      </section>
    </div>
  )
}
