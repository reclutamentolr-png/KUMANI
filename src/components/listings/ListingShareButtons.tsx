'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Link2, Mail, MessageCircle, Send, Share2 } from 'lucide-react'

// Condivisione di un annuncio della Bacheca. Il link apre la Bacheca con
// l'annuncio già aperto (?listing=...); chi non ha fatto l'accesso passa
// prima dal login e poi torna all'annuncio.
export default function ListingShareButtons({ listingId, title }: { listingId: string; title: string }) {
  const t = useTranslations('marketplace')
  const [url, setUrl] = useState('')
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [copied, setCopied] = useState(false)

  // Calcolati dopo il montaggio (il popup può essere reso anche dal server)
  useEffect(() => {
    queueMicrotask(() => {
      setUrl(`${window.location.origin}${window.location.pathname}?listing=${listingId}`)
      setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
    })
  }, [listingId])

  if (!url) return null

  const text = t('shareListingText', { title })
  const fullText = `${text} ${url}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t('copyLink'), url)
    }
  }

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text, url })
    } catch {
      // Condivisione annullata
    }
  }

  const button =
    'flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold-pale)]'

  return (
    <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
        <Share2 className="h-3.5 w-3.5 text-[var(--gold)]" /> {t('shareListing')}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {canNativeShare && (
          <button type="button" onClick={nativeShare} className={`${button} col-span-2 sm:col-span-3`}>
            <Share2 className="h-4 w-4" /> {t('shareListingNative')}
          </button>
        )}
        <a href={`https://wa.me/?text=${encodeURIComponent(fullText)}`} target="_blank" rel="noopener noreferrer" className={button}>
          <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={button}
        >
          <Send className="h-4 w-4 text-sky-500" /> Telegram
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={button}
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#1877f2] text-[10px] font-bold text-white">f</span> Facebook
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(fullText)}`} className={button}>
          <Mail className="h-4 w-4 text-[var(--gold)]" /> Email
        </a>
        <button type="button" onClick={copy} className={`${button} col-span-2 sm:col-span-2`}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
          {copied ? t('linkCopied') : t('copyLink')}
        </button>
      </div>
    </div>
  )
}
