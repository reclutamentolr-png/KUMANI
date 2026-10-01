'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { Check, Copy, Download, MessageCircle, RotateCcw, Share2, X } from 'lucide-react'

type Props = {
  firstName: string | null
  lastName: string | null
  memberId: string | null
  planName: string | null
  rankLabel: string | null
  shareUrl: string
}

const W = 1080
const H = 1350
const MAX_TEXT = 280

// Va a capo per parole entro la larghezza data; al massimo maxLines righe
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    lines.push(line)
  }
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines)
    cut[maxLines - 1] = `${cut[maxLines - 1].replace(/\s+\S*$/, '')}…`
    return cut
  }
  return lines
}

// Biglietto da visita KUMANI da condividere: immagine con nome, piano,
// presentazione di KUMANI (modificabile) e QR del proprio link di invito.
export default function MembershipShareCard({ firstName, lastName, memberId, planName, rankLabel, shareUrl }: Props) {
  const t = useTranslations('wallet')
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(t('shareCardDefaultText'))
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const assets = useRef<{ logo: HTMLImageElement | null; qr: HTMLImageElement | null }>({ logo: null, qr: null })

  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim()
  // Condivisione con immagine (telefoni): altrimenti il pulsante scarica il biglietto
  const canShareFiles = open && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
  const message = `${text.trim()}\n\n${t('shareCardLinkLead')} ${shareUrl}`

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const font = getComputedStyle(document.body).fontFamily || 'Arial, sans-serif'

    // Sfondo scuro con bordo dorato
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, '#1f1d1a')
    bg.addColorStop(1, '#0f0f0f')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(W * 0.85, 120, 20, W * 0.85, 120, 520)
    glow.addColorStop(0, 'rgba(199,154,59,0.28)')
    glow.addColorStop(1, 'rgba(199,154,59,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#c79a3b'
    ctx.lineWidth = 6
    ctx.strokeRect(30, 30, W - 60, H - 60)

    ctx.textAlign = 'center'
    if (assets.current.logo) ctx.drawImage(assets.current.logo, W / 2 - 110, 80, 220, 220)

    ctx.fillStyle = '#ffffff'
    ctx.font = `bold 64px ${font}`
    ctx.fillText(fullName || 'KUMANI', W / 2, 375)
    ctx.fillStyle = '#e7c56a'
    ctx.font = `600 34px ${font}`
    const roleLine = [t('shareCardMember'), planName, rankLabel].filter(Boolean).join(' · ')
    ctx.fillText(roleLine, W / 2, 430)

    ctx.fillStyle = '#e7c56a'
    ctx.font = `italic bold 40px ${font}`
    ctx.fillText(t('shareCardHeadline'), W / 2, 520)

    ctx.fillStyle = '#e7e5e4'
    ctx.font = `36px ${font}`
    const lines = wrapLines(ctx, text.trim(), W - 200, 7)
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 600 + i * 50))

    // QR del link di invito
    const qrSize = 300
    const qrY = H - 120 - qrSize - 60
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(W / 2 - qrSize / 2 - 16, qrY - 16, qrSize + 32, qrSize + 32)
    if (assets.current.qr) ctx.drawImage(assets.current.qr, W / 2 - qrSize / 2, qrY, qrSize, qrSize)
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 32px ${font}`
    ctx.fillText(t('shareCardScan'), W / 2, H - 120)
    if (memberId) {
      ctx.fillStyle = '#e7c56a'
      ctx.font = `28px ${font}`
      ctx.fillText(t('shareCardCode', { code: memberId }), W / 2, H - 75)
    }
  }, [fullName, memberId, planName, rankLabel, t, text])

  // Logo e QR si caricano una volta all'apertura
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })
    Promise.all([
      load('/icon-512.png').catch(() => null),
      QRCode.toDataURL(shareUrl, { width: 600, margin: 0, errorCorrectionLevel: 'M' }).then(load).catch(() => null),
    ]).then(([logo, qr]) => {
      if (cancelled) return
      assets.current = { logo, qr }
      draw()
    })
    return () => {
      cancelled = true
    }
  }, [open, shareUrl, draw])

  useEffect(() => {
    if (open) draw()
  }, [open, draw])

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      draw()
      canvasRef.current?.toBlob((blob) => resolve(blob), 'image/png')
    })

  const download = async () => {
    const blob = await toBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `KUMANI-${memberId ?? 'biglietto'}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const share = async () => {
    const blob = await toBlob()
    if (!blob) return
    const file = new File([blob], `KUMANI-${memberId ?? 'biglietto'}.png`, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message })
      } else if (navigator.share) {
        await navigator.share({ text: message })
      } else {
        await download()
      }
    } catch {
      // Condivisione annullata dall'utente
    }
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Appunti non disponibili: il testo resta visibile nel riquadro
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] shadow-md hover:brightness-110"
      >
        <Share2 className="h-5 w-5" /> {t('shareCardButton')}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="relative max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 text-gray-500 hover:text-gray-900" aria-label={t('shareCardClose')}>
              <X className="h-5 w-5" />
            </button>
            <h3 className="pr-8 text-lg font-bold text-gray-900">{t('shareCardTitle')}</h3>
            <p className="mt-1 text-sm text-gray-600">{t('shareCardIntro')}</p>

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <canvas ref={canvasRef} width={W} height={H} className="w-full rounded-xl border border-gray-200 shadow-sm" />

              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-gray-800">
                  {t('shareCardTextLabel')}
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
                    rows={7}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm font-normal text-gray-800 focus:border-[var(--gold)] focus:outline-none"
                  />
                </label>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {text.length}/{MAX_TEXT}
                  </span>
                  <button type="button" onClick={() => setText(t('shareCardDefaultText'))} className="inline-flex items-center gap-1 font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                    <RotateCcw className="h-3.5 w-3.5" /> {t('shareCardReset')}
                  </button>
                </div>

                {canShareFiles && (
                  <button
                    type="button"
                    onClick={share}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--ink-soft)]"
                  >
                    <Share2 className="h-4 w-4" /> {t('shareCardShare')}
                  </button>
                )}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <MessageCircle className="h-4 w-4" /> {t('shareCardWhatsapp')}
                </a>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={download}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4" /> {t('shareCardDownload')}
                  </button>
                  <button
                    type="button"
                    onClick={copyText}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t('shareCardCopied') : t('shareCardCopy')}
                  </button>
                </div>
                <p className="text-xs text-gray-500">{t('shareCardWhatsappNote')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
