'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Download, FileText, LoaderCircle } from 'lucide-react'
import QRCode from 'qrcode'
import FlyerCanvas, { type FlyerTexts } from './FlyerCanvas'
import { flyerKey, type FlyerConfig, type FlyerPlan } from '@/lib/flyers'

// Anteprima del volantino e download come immagine (PNG) o PDF, creati nel
// browser al momento: testi ufficiali aggiornati e QR con il link di invito.

type Props = { config: FlyerConfig; plan: FlyerPlan; title: string; inviteUrl: string | null; screenshotLang: 'it' | 'en' }

export default function FlyerView({ config, plan, title, inviteUrl, screenshotLang }: Props) {
  const t = useTranslations('flyers')
  const locale = useLocale()
  const node = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [qrSvg, setQrSvg] = useState('')
  const [scale, setScale] = useState(0.3)
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null)
  const [error, setError] = useState(false)

  const target = inviteUrl ?? 'https://kumani.io'
  useEffect(() => {
    QRCode.toString(target, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#171717', light: '#00000000' } }).then(setQrSvg)
  }, [target])

  // L'anteprima si adatta alla larghezza della pagina
  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setScale(el.clientWidth / 1080)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const k = flyerKey(config.tool)
  const money = (eur: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: eur % 1 ? 2 : 0 }).format(eur)
  const texts: FlyerTexts = {
    name: title,
    sub: t(`tools.${k}.sub`),
    tagline: t(`tools.${k}.tagline`),
    points: [1, 2, 3].map((n) => [t(`tools.${k}.p${n}`), t(`tools.${k}.p${n}d`)] as [string, string]),
    note: t.has(`tools.${k}.note`) ? t(`tools.${k}.note`) : null,
    category: t(`cat_${config.category}`),
    planLabel: plan.plan === 'free' ? t('includedFree') : plan.plan === 'pro' ? t('includedPro') : t('includedBase'),
    priceLabel: plan.plan === 'free' ? t('priceFree') : t('pricePerYear', { price: money(plan.planPrice) }),
    passLabel: plan.plan === 'free' ? t('freeNote') : plan.plan === 'pro' ? t('proTrial') : plan.passPrice ? t('passAlso', { price: money(plan.passPrice) }) : null,
    cta: t('cta'),
    url: 'kumani.io',
    tagLine: t('tagLine'),
  }
  const imageUrl = config.style === 'photo' ? (config.photo ?? null) : config.style === 'phone' && config.shot ? `/guides/${screenshotLang}/${config.shot}.webp` : null
  const fileBase = `KUMANI_${config.tool}_${locale}`

  const exportAs = async (kind: 'png' | 'pdf') => {
    if (!node.current) return
    setBusy(kind)
    setError(false)
    try {
      const { toPng } = await import('html-to-image')
      await document.fonts.ready
      const png = await toPng(node.current, { width: 1080, height: 1350, pixelRatio: 1, cacheBust: true, style: { transform: 'none' } })
      const a = document.createElement('a')
      if (kind === 'png') {
        a.href = png
        a.download = `${fileBase}.png`
      } else {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF({ unit: 'px', format: [1080, 1350], hotfixes: ['px_scaling'] })
        pdf.addImage(png, 'PNG', 0, 0, 1080, 1350)
        a.href = URL.createObjectURL(pdf.output('blob'))
        a.download = `${fileBase}.pdf`
      }
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      console.error('[volantino]', e)
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div ref={box} className="relative w-full overflow-hidden rounded-2xl shadow-lg" style={{ height: 1350 * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 1080, height: 1350 }}>
          <FlyerCanvas ref={node} config={config} texts={texts} qrSvg={qrSvg} logoUrl="/brand/logo-gold.png" imageUrl={imageUrl} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => exportAs('png')}
          disabled={busy !== null || !qrSvg}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-extrabold text-[var(--ink)] shadow-sm transition hover:brightness-105 disabled:opacity-60"
        >
          {busy === 'png' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} {busy === 'png' ? t('generating') : t('image')}
        </button>
        <button
          type="button"
          onClick={() => exportAs('pdf')}
          disabled={busy !== null || !qrSvg}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-white px-5 py-3 font-bold text-[var(--ink)] transition hover:border-[var(--gold)] disabled:opacity-60"
        >
          {busy === 'pdf' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5 text-[var(--gold)]" />} {busy === 'pdf' ? t('generating') : t('pdf')}
        </button>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t('error')}</p>}
      <p className="text-sm text-[var(--muted)]">{inviteUrl ? t('previewIntro') : t('noCode')}</p>
    </div>
  )
}
