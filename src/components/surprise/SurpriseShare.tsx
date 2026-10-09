'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, Download, Mail, MessageCircle, Share2 } from 'lucide-react'

// Invio della sorpresa attiva: WhatsApp, email, condivisione del telefono,
// copia del link e QR code da stampare o mostrare.
export default function SurpriseShare({ url, recipientName }: { url: string; recipientName: string }) {
  const t = useTranslations('surprise')
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(false)
  const text = t('shareMessage', { name: recipientName || '', url })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- funzione disponibile solo nel browser
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(url, { width: 600, margin: 1, errorCorrectionLevel: 'M' }).then(setQr))
  }, [url])

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold'
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
          <MessageCircle className="h-5 w-5" /> {t('whatsapp')}
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(t('emailSubject'))}&body=${encodeURIComponent(text)}`} className={`${btn} bg-[var(--ink)] text-white hover:brightness-125`}>
          <Mail className="h-5 w-5" /> {t('email')}
        </a>
        {canShare && (
          <button type="button" onClick={() => navigator.share({ title: t('emailSubject'), text, url }).catch(() => {})} className={`${btn} border border-gray-300 bg-white`}>
            <Share2 className="h-5 w-5" /> {t('shareOther')}
          </button>
        )}
        <button type="button" onClick={copy} className={`${btn} border border-gray-300 bg-white`}>
          {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />} {copied ? t('copied') : t('copyLink')}
        </button>
      </div>
      <p className="break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600">{url}</p>
      {qr && (
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR generato nel browser */}
          <img src={qr} alt="QR" className="h-28 w-28" />
          <div className="text-sm text-gray-600">
            <p>{t('qrText')}</p>
            <a href={qr} download="sorpresa-qr.png" className="mt-2 inline-flex items-center gap-1 font-semibold text-[var(--ink)] underline">
              <Download className="h-4 w-4" /> {t('downloadQr')}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
