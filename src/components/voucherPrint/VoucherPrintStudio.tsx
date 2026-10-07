'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, LoaderCircle, Printer } from 'lucide-react'
import VoucherPrintCard, {
  BLEED_MM,
  FORMATS,
  PX_PER_MM,
  QR_DARK,
  formatPx,
  type VoucherDesign,
  type VoucherFormat,
  type VoucherPrintTexts,
} from './VoucherPrintCard'

// Stampa dei voucher: scelta di grafica, frase e formato con anteprima,
// poi due PDF: per la tipografia (un voucher per pagina, fronte e retro,
// con 3 mm di abbondanza) e da stampare a casa (fogli A4 con i segni di
// taglio, retro speculare per la stampa fronte-retro).
// Usato in Admin (lotti di voucher) e dai Kumani per i propri voucher.

const PHRASES = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const
const CUSTOM_MAX = 110
const DESIGNS: VoucherDesign[] = ['A', 'B', 'C']

type Props = {
  codes: string[]
  plan: 'base' | 'pro'
  siteUrl: string
  fileBase: string
  // Admin: riga «Offerto da …» per i lotti dei negozianti (testi Admin in italiano)
  offeredByDefault?: string
  admin?: boolean
}

type Slot = { x: number; y: number; w: number; h: number }

export default function VoucherPrintStudio({ codes, plan, siteUrl, fileBase, offeredByDefault, admin }: Props) {
  const t = useTranslations('voucherPrint')
  const [design, setDesign] = useState<VoucherDesign>('A')
  const [format, setFormat] = useState<VoucherFormat>('card')
  const [phraseKey, setPhraseKey] = useState<(typeof PHRASES)[number] | 'custom'>('p1')
  const [custom, setCustom] = useState('')
  const [showOffered, setShowOffered] = useState(Boolean(offeredByDefault))
  const [offered, setOffered] = useState(offeredByDefault ?? '')
  const [qrSvg, setQrSvg] = useState('')
  const [busy, setBusy] = useState<'printer' | 'home' | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(false)
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)

  const site = siteUrl.replace(/\/+$/, '')
  const siteLabel = site.replace(/^https?:\/\//, '')
  const urlFor = (code: string) => `${site}/register?voucher=${encodeURIComponent(code)}`
  const sample = codes[0] ?? 'KV-XXXXXXXXXX'

  const phrase = phraseKey === 'custom' ? custom.trim() || t('customPlaceholder') : t(`phrases.${phraseKey}`)
  const offeredBy = showOffered && offered.trim() ? t('offeredBy', { business: offered.trim() }) : undefined
  const texts: VoucherPrintTexts = {
    voucher: t('card.voucher'),
    gift: t('card.gift'),
    oneYear: t('card.oneYear'),
    planLine: t(plan === 'pro' ? 'card.planPro' : 'card.planBase'),
    codeLabel: t('card.codeLabel'),
    codeShort: t('card.codeShort'),
    howToLong: t('card.howToLong', { site: siteLabel }),
    howToShort: t('card.howToShort', { site: siteLabel }),
    scan: t('card.scan'),
  }

  useEffect(() => {
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toString(urlFor(sample), { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: QR_DARK[design], light: '#00000000' } })
      )
      .then(setQrSvg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample, design])

  const cardProps = { design, format, plan, phrase, offeredBy, texts }
  const px = formatPx(format)
  const { w: trimWmm, h: trimHmm } = FORMATS[format]
  const fullWmm = trimWmm + BLEED_MM * 2
  const fullHmm = trimHmm + BLEED_MM * 2

  // Posizione (in mm, con l'abbondanza) degli spazi di codice e QR sul retro
  const slotOf = (name: 'code' | 'qr'): { slot: Slot; el: HTMLElement } => {
    const root = backRef.current!
    const el = root.querySelector<HTMLElement>(`[data-slot="${name}"]`)!
    const r0 = root.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { el, slot: { x: (r.left - r0.left) / PX_PER_MM, y: (r.top - r0.top) / PX_PER_MM, w: r.width / PX_PER_MM, h: r.height / PX_PER_MM } }
  }

  // Codice disegnato su una piccola immagine nitida, con il font della grafica
  const codeImage = (code: string, el: HTMLElement, slot: Slot) => {
    const cs = getComputedStyle(el)
    const scale = 4
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(slot.w * PX_PER_MM * scale)
    canvas.height = Math.ceil(slot.h * PX_PER_MM * scale)
    const c = canvas.getContext('2d')!
    c.scale(scale, scale)
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    if ('letterSpacing' in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing
    c.fillStyle = cs.color
    c.textBaseline = 'middle'
    c.fillText(code, 0, (slot.h * PX_PER_MM) / 2)
    return canvas.toDataURL('image/png')
  }

  const run = async (layout: 'printer' | 'home') => {
    if (!codes.length) return
    setBusy(layout)
    setError(false)
    setProgress(0)
    try {
      const [{ toPng }, { jsPDF }, { default: QRCode }] = await Promise.all([import('html-to-image'), import('jspdf'), import('qrcode')])
      await document.fonts.ready
      const opts = { width: px.fullW, height: px.fullH, pixelRatio: 2, cacheBust: true }
      const frontPng = await toPng(frontRef.current!, opts)
      const backPng = await toPng(backRef.current!, opts)
      const code = slotOf('code')
      const qr = slotOf('qr')
      const qrColor = QR_DARK[design]

      // Moduli del QR come rettangoli vettoriali (righe unite), nitidi a ogni dimensione
      const drawQr = (pdf: InstanceType<typeof jsPDF>, value: string, x: number, y: number, size: number) => {
        const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
        const n = modules.size
        const cell = size / n
        pdf.setFillColor(qrColor)
        for (let row = 0; row < n; row++) {
          let col = 0
          while (col < n) {
            if (!modules.get(row, col)) {
              col++
              continue
            }
            const start = col
            while (col < n && modules.get(row, col)) col++
            // Leggera sovrapposizione con la riga sotto: niente righine chiare tra i moduli
            const join = row < n - 1 ? 0.04 : 0
            pdf.rect(x + start * cell, y + row * cell, (col - start) * cell, cell + join, 'F')
          }
        }
      }

      let pdf: InstanceType<typeof jsPDF>
      if (layout === 'printer') {
        const orientation = fullWmm > fullHmm ? 'landscape' : 'portrait'
        pdf = new jsPDF({ unit: 'mm', format: [fullWmm, fullHmm], orientation, compress: true })
        for (const [i, value] of codes.entries()) {
          if (i > 0) pdf.addPage([fullWmm, fullHmm], orientation)
          pdf.addImage(frontPng, 'PNG', 0, 0, fullWmm, fullHmm, 'front', 'FAST')
          pdf.addPage([fullWmm, fullHmm], orientation)
          pdf.addImage(backPng, 'PNG', 0, 0, fullWmm, fullHmm, 'back', 'FAST')
          pdf.addImage(codeImage(value, code.el, code.slot), 'PNG', code.slot.x, code.slot.y, code.slot.w, code.slot.h)
          drawQr(pdf, urlFor(value), qr.slot.x, qr.slot.y, qr.slot.w)
          if (i % 10 === 9) {
            setProgress(i + 1)
            await new Promise((r) => setTimeout(r, 0))
          }
        }
      } else {
        // Immagini rifilate (senza abbondanza) per i fogli A4
        const trimmed = async (src: string) => {
          const img = new Image()
          img.src = src
          await img.decode()
          const canvas = document.createElement('canvas')
          canvas.width = px.trimW * 2
          canvas.height = px.trimH * 2
          canvas.getContext('2d')!.drawImage(img, px.bleed * 2, px.bleed * 2, px.trimW * 2, px.trimH * 2, 0, 0, px.trimW * 2, px.trimH * 2)
          return canvas.toDataURL('image/png')
        }
        const frontT = await trimmed(frontPng)
        const backT = await trimmed(backPng)
        const grid = format === 'card' ? { cols: 2, rows: 5, gx: 6, gy: 2 } : { cols: 1, rows: 2, gx: 0, gy: 10 }
        const gridW = grid.cols * trimWmm + (grid.cols - 1) * grid.gx
        const gridH = grid.rows * trimHmm + (grid.rows - 1) * grid.gy
        const x0 = (210 - gridW) / 2
        const y0 = (297 - gridH) / 2
        const perPage = grid.cols * grid.rows
        const cellX = (col: number) => x0 + col * (trimWmm + grid.gx)
        const cellY = (row: number) => y0 + row * (trimHmm + grid.gy)

        // Segni di taglio sui margini del foglio, in linea con i bordi dei voucher
        const marks = () => {
          pdf.setDrawColor(150)
          pdf.setLineWidth(0.1)
          for (let col = 0; col < grid.cols; col++)
            for (const x of [cellX(col), cellX(col) + trimWmm]) {
              pdf.line(x, Math.max(y0 - 6, 1), x, y0 - 1.5)
              pdf.line(x, y0 + gridH + 1.5, x, Math.min(y0 + gridH + 6, 296))
            }
          for (let row = 0; row < grid.rows; row++)
            for (const y of [cellY(row), cellY(row) + trimHmm]) {
              pdf.line(Math.max(x0 - 6, 1), y, x0 - 1.5, y)
              pdf.line(x0 + gridW + 1.5, y, Math.min(x0 + gridW + 6, 209), y)
            }
        }

        pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
        for (let start = 0; start < codes.length; start += perPage) {
          const batch = codes.slice(start, start + perPage)
          if (start > 0) pdf.addPage('a4', 'portrait')
          batch.forEach((_, i) => pdf.addImage(frontT, 'PNG', cellX(i % grid.cols), cellY(Math.floor(i / grid.cols)), trimWmm, trimHmm, 'frontT', 'FAST'))
          marks()
          pdf.addPage('a4', 'portrait')
          batch.forEach((value, i) => {
            // Retro speculare: stampando fronte-retro sul lato lungo combacia con il fronte
            const x = 210 - cellX(i % grid.cols) - trimWmm
            const y = cellY(Math.floor(i / grid.cols))
            pdf.addImage(backT, 'PNG', x, y, trimWmm, trimHmm, 'backT', 'FAST')
            pdf.addImage(codeImage(value, code.el, code.slot), 'PNG', x + code.slot.x - BLEED_MM, y + code.slot.y - BLEED_MM, code.slot.w, code.slot.h)
            drawQr(pdf, urlFor(value), x + qr.slot.x - BLEED_MM, y + qr.slot.y - BLEED_MM, qr.slot.w)
          })
          marks()
          setProgress(Math.min(start + perPage, codes.length))
          await new Promise((r) => setTimeout(r, 0))
        }
      }

      const a = document.createElement('a')
      a.href = URL.createObjectURL(pdf.output('blob'))
      a.download = `${fileBase}_${design}_${format === 'card' ? 'biglietto' : 'cartolina'}_${layout === 'printer' ? 'tipografia' : 'A4'}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      console.error('[voucher-print]', e)
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-2 text-left text-sm transition ${
      active ? 'border-[var(--gold)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 bg-white text-[var(--ink)] hover:border-[var(--gold)]/60'
    }`

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-5">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('design')}</p>
          <div className="grid grid-cols-3 gap-2">
            {DESIGNS.map((d) => (
              <button key={d} type="button" onClick={() => setDesign(d)} className={chip(design === d)}>
                <span className="block font-bold">{d}</span>
                <span className="block text-xs opacity-80">{t(`designs.${d}`)}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('format')}</p>
          <div className="grid grid-cols-2 gap-2">
            {(['card', 'postcard'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFormat(f)} className={chip(format === f)}>
                <span className="block font-semibold">{t(`formats.${f}`)}</span>
                <span className="block text-xs opacity-80">{f === 'card' ? '85 × 55 mm' : '148 × 105 mm (A6)'}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('phrase')}</p>
          <div className="space-y-1.5">
            {PHRASES.map((p) => (
              <label key={p} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--paper)]">
                <input type="radio" name="voucher-phrase" checked={phraseKey === p} onChange={() => setPhraseKey(p)} className="mt-1 accent-[var(--gold)]" />
                <span>{t(`phrases.${p}`)}</span>
              </label>
            ))}
            <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--paper)]">
              <input type="radio" name="voucher-phrase" checked={phraseKey === 'custom'} onChange={() => setPhraseKey('custom')} className="mt-1 accent-[var(--gold)]" />
              <span className="font-semibold">{t('phraseCustom')}</span>
            </label>
            {phraseKey === 'custom' && (
              <div>
                <textarea
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.slice(0, CUSTOM_MAX))}
                  rows={2}
                  placeholder={t('customPlaceholder')}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm text-[var(--ink)]"
                />
                <p className="text-right text-xs text-[var(--muted)]">
                  {custom.length}/{CUSTOM_MAX}
                </p>
              </div>
            )}
          </div>
        </section>

        {admin && (
          <section>
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <input type="checkbox" checked={showOffered} onChange={(e) => setShowOffered(e.target.checked)} className="accent-[var(--gold)]" />
              Mostra «Offerto da …» sul retro
            </label>
            {showOffered && (
              <input
                value={offered}
                onChange={(e) => setOffered(e.target.value.slice(0, 60))}
                placeholder="Nome dell'attività"
                className="mt-2 w-full rounded-lg border border-gray-300 p-2.5 text-sm text-[var(--ink)]"
              />
            )}
          </section>
        )}
      </div>

      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-2">
          {(['front', 'back'] as const).map((side) => (
            <div key={side}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t(side)}</p>
              <Preview format={format}>
                <VoucherPrintCard {...cardProps} side={side} code={sample} qrSvg={qrSvg} />
              </Preview>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--gold)]/30 bg-white p-4">
          {codes.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t('noCodes')}</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-[var(--ink)]">{t('count', { count: codes.length })}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run('printer')}
                  className="flex items-start gap-3 rounded-xl bg-[var(--ink)] p-3 text-left text-[var(--gold-bright)] transition hover:opacity-90 disabled:opacity-60"
                >
                  {busy === 'printer' ? <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin" /> : <Download className="mt-0.5 h-5 w-5 shrink-0" />}
                  <span>
                    <span className="block font-bold">{t('pdfPrinter')}</span>
                    <span className="block text-xs text-white/70">{t('pdfPrinterHint')}</span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run('home')}
                  className="flex items-start gap-3 rounded-xl border border-[var(--gold)]/50 bg-white p-3 text-left text-[var(--ink)] transition hover:border-[var(--gold)] disabled:opacity-60"
                >
                  {busy === 'home' ? <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin" /> : <Printer className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />}
                  <span>
                    <span className="block font-bold">{t('pdfHome')}</span>
                    <span className="block text-xs text-[var(--muted)]">{t(format === 'card' ? 'pdfHomeHintCard' : 'pdfHomeHintPostcard')}</span>
                  </span>
                </button>
              </div>
              {busy && codes.length > 10 && <p className="mt-2 text-xs text-[var(--muted)]">{t('progress', { done: progress, total: codes.length })}</p>}
              {error && <p className="mt-2 text-sm font-semibold text-red-600">{t('error')}</p>}
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{t('goldNote')}</p>
            </>
          )}
        </div>
      </div>

      {/* Modelli a grandezza piena per il PDF (fuori dallo schermo) */}
      <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}>
        <VoucherPrintCard ref={frontRef} {...cardProps} side="front" code={sample} qrSvg={qrSvg} />
        <VoucherPrintCard ref={backRef} {...cardProps} side="back" code={sample} qrSvg={qrSvg} blank />
      </div>
    </div>
  )
}

// Anteprima rifilata (senza abbondanza), adattata alla larghezza disponibile
function Preview({ format, children }: { format: VoucherFormat; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const px = formatPx(format)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const scale = width / px.trimW
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-md shadow-md" style={{ height: px.trimH * scale }}>
      {width > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: 'top left', transform: `scale(${scale}) translate(-${px.bleed}px, -${px.bleed}px)` }}>{children}</div>
      )}
    </div>
  )
}
