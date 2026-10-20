'use client'

import { useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Copy, Download, LoaderCircle, Mail, Share2, X } from 'lucide-react'
import ScaledVoucherFront from './ScaledVoucherFront'
import { CARD_CUSTOM_MAX, CARD_DESIGNS, CARD_NAME_MAX, CARD_PHRASES, cardLink, type CardOptions } from '@/lib/voucherCard'
import type { VoucherPrintTexts } from '@/components/voucherPrint/VoucherPrintCard'

// «Biglietto» di un voucher Base o Pro (Wallet dei Kumani e Admin): grafica,
// frase, «per» e «da», poi il link da mandare (WhatsApp o copia) e
// l'immagine del biglietto. Chi apre il link vede il biglietto e attiva il
// voucher con un tocco (/biglietto/CODICE).
export default function VoucherCardShare({
  code,
  plan,
  siteUrl,
  defaultFrom = '',
  className = '',
}: {
  code: string
  plan: 'base' | 'pro'
  siteUrl: string
  defaultFrom?: string
  className?: string
}) {
  const t = useTranslations('voucherCard')
  const tp = useTranslations('voucherPrint')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [o, setO] = useState<CardOptions>({ design: 'A', phrase: 'p2', custom: '', to: '', from: defaultFrom })
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const planName = plan === 'pro' ? 'Pro' : 'Base'
  const link = cardLink(siteUrl, locale, code, o)
  const phrase = o.phrase === 'custom' ? o.custom.trim() || tp('customPlaceholder') : tp(`phrases.${o.phrase}`)
  const texts: VoucherPrintTexts = {
    voucher: tp('card.voucher'),
    gift: tp('card.gift'),
    oneYear: tp('card.oneYear'),
    planLine: tp(plan === 'pro' ? 'card.planPro' : 'card.planBase'),
    codeLabel: tp('card.codeLabel'),
    codeShort: tp('card.codeShort'),
    howToLong: '',
    howToShort: '',
    scan: '',
  }
  const set = (patch: Partial<CardOptions>) => setO((prev) => ({ ...prev, ...patch }))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt(t('copy'), link)
    }
  }

  // Immagine verticale 1080×1350 (bene su WhatsApp e Instagram): la grafica
  // del voucher, la frase, «per» e «da» e dove aprirlo
  const download = async () => {
    if (!cardRef.current) return
    setBusy(true)
    try {
      const { toPng } = await import('html-to-image')
      await document.fonts.ready
      const front = await toPng(cardRef.current, { pixelRatio: 1, cacheBust: true })
      const img = new Image()
      img.src = front
      await img.decode()
      const W = 1080
      const H = 1350
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const g = c.getContext('2d')!
      const bg = g.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.4, H)
      bg.addColorStop(0, '#1f1b13')
      bg.addColorStop(1, '#0b0b0b')
      g.fillStyle = bg
      g.fillRect(0, 0, W, H)
      g.textAlign = 'center'
      g.fillStyle = '#e7c56a'
      let y = 120
      if (o.to.trim()) {
        g.font = '600 46px Georgia, serif'
        g.fillText(t('forName', { name: o.to.trim() }), W / 2, y)
        y += 40
      }
      const cw = 900
      const ch = (img.height / img.width) * cw
      g.drawImage(img, (W - cw) / 2, y + 20, cw, ch)
      y += ch + 110
      // Frase su più righe
      g.fillStyle = '#f5e8bd'
      g.font = 'italic 44px Georgia, serif'
      const words = `«${phrase}»`.split(' ')
      let line = ''
      for (const w of words) {
        const test = line ? `${line} ${w}` : w
        if (g.measureText(test).width > 900 && line) {
          g.fillText(line, W / 2, y)
          y += 58
          line = w
        } else line = test
      }
      g.fillText(line, W / 2, y)
      y += 80
      if (o.from.trim()) {
        g.fillStyle = '#e7c56a'
        g.font = '600 38px Georgia, serif'
        g.fillText(t('fromName', { name: o.from.trim() }), W / 2, y)
      }
      g.fillStyle = '#d9b25a'
      g.font = '700 34px system-ui, sans-serif'
      g.fillText(t('imageCta', { plan: planName }), W / 2, H - 120)
      g.fillStyle = 'rgba(255,255,255,0.7)'
      g.font = '500 30px system-ui, sans-serif'
      g.fillText(`${t('codeLabel')}: ${code}`, W / 2, H - 70)
      const a = document.createElement('a')
      a.href = c.toDataURL('image/png')
      a.download = `KUMANI_biglietto_${code}.png`
      a.click()
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
  const chip = (on: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-300 bg-white text-[var(--ink)] hover:border-[var(--gold)]'}`

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className || 'inline-flex items-center gap-1 font-semibold text-[var(--gold)] hover:text-[var(--ink)]'}>
        <Mail className="h-3.5 w-3.5" /> {t('button')}
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t('title')} onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('title')}</h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{t('intro')}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Anteprima */}
            <div className="mt-4 rounded-2xl bg-[var(--ink)] p-4 text-center">
              {o.to.trim() && <p className="mb-2 font-serif text-lg font-semibold text-[var(--gold-bright)]">{t('forName', { name: o.to.trim() })}</p>}
              <ScaledVoucherFront ref={cardRef} design={o.design} plan={plan} texts={texts} />
              <p className="mt-3 font-serif text-base italic leading-snug text-[#f5e8bd]">«{phrase}»</p>
              {o.from.trim() && <p className="mt-1 font-serif text-sm font-semibold text-[var(--gold-bright)]">{t('fromName', { name: o.from.trim() })}</p>}
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{tp('design')}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {CARD_DESIGNS.map((d) => (
                <button key={d} type="button" onClick={() => set({ design: d })} aria-pressed={o.design === d} className={chip(o.design === d)}>
                  {tp(`designs.${d}`)}
                </button>
              ))}
            </div>

            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]" htmlFor={`card-phrase-${code}`}>
              {t('phrase')}
            </label>
            <select id={`card-phrase-${code}`} value={o.phrase} onChange={(e) => set({ phrase: e.target.value as CardOptions['phrase'] })} className={`${input} mt-1.5`}>
              {CARD_PHRASES.map((p) => (
                <option key={p} value={p}>
                  {tp(`phrases.${p}`)}
                </option>
              ))}
              <option value="custom">{tp('phraseCustom')}</option>
            </select>
            {o.phrase === 'custom' && (
              <textarea value={o.custom} onChange={(e) => set({ custom: e.target.value })} maxLength={CARD_CUSTOM_MAX} rows={2} placeholder={tp('customPlaceholder')} className={`${input} mt-2`} />
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                {t('to')}
                <input value={o.to} onChange={(e) => set({ to: e.target.value })} maxLength={CARD_NAME_MAX} placeholder={t('toPlaceholder')} className={`${input} mt-1.5 normal-case tracking-normal`} />
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                {t('from')}
                <input value={o.from} onChange={(e) => set({ from: e.target.value })} maxLength={CARD_NAME_MAX} placeholder={t('fromPlaceholder')} className={`${input} mt-1.5 normal-case tracking-normal`} />
              </label>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(t('whatsappText', { plan: planName, link }))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700"
              >
                <Share2 className="h-4 w-4" /> {t('whatsapp')}
              </a>
              <button type="button" onClick={copy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 font-bold text-[var(--gold-bright)]">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t('copied') : t('copy')}
              </button>
              <button type="button" onClick={download} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/60 px-4 font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-60 sm:col-span-2">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t('download')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
