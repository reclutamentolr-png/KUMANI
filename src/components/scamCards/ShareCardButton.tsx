'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Share2 } from 'lucide-react'
import { cardSlug, type ScamCard } from '@/lib/scamCards/cards'

// «Avvisa qualcuno»: manda la carta (pagina pubblica, leggibile da tutti) con
// il codice d'invito di chi condivide. Sul telefono la condivisione del
// telefono; altrove WhatsApp.
export default function ShareCardButton({ card, inviteCode, className = '' }: { card: ScamCard; inviteCode: string | null; className?: string }) {
  const t = useTranslations('scamCards')
  const locale = useLocale()
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const path = `${locale === 'it' ? '' : `/${locale}`}/carte/${cardSlug(card)}${inviteCode ? `?invito=${encodeURIComponent(inviteCode)}` : ''}`
    const url = `${window.location.origin}${path}`
    const text = t('shareText', { name: card.name })
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try {
        await nav.share({ title: card.name, text, url })
        return
      } catch (error) {
        // Chiusa dall'utente: niente altro
        if ((error as Error)?.name === 'AbortError') return
      }
    }
    const opened = window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener,noreferrer')
    if (!opened) {
      // Finestra bloccata: si copia il link
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      } catch {
        // niente da fare
      }
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-[var(--ink)] bg-white px-5 font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)] ${className}`}
    >
      {copied ? <Check className="h-5 w-5" aria-hidden /> : <Share2 className="h-5 w-5" aria-hidden />}
      {copied ? t('shareCopied') : t('shareButton')}
    </button>
  )
}
