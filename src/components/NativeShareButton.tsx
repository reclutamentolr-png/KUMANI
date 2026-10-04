'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Share2 } from 'lucide-react'

// "Condividi…": apre il menu di condivisione del telefono, dove ci sono anche
// Instagram (Direct e Storie), WhatsApp, Telegram, Messenger e le altre app.
// Instagram non ha un indirizzo web di condivisione: questo è l'unico modo.
// Sul computer, dove il menu spesso non c'è, copia il link (copyFallback)
// oppure non compare.
export default function NativeShareButton({
  url,
  title,
  text,
  variant = 'gold',
  copyFallback = true,
  iconOnly = false,
  className = '',
}: {
  url: string
  title?: string
  text?: string
  variant?: 'gold' | 'dark' | 'light' | 'glass'
  copyFallback?: boolean
  // Solo l'icona (es. la riga di stato della Home)
  iconOnly?: boolean
  className?: string
}) {
  const t = useTranslations('share')
  const [canShare, setCanShare] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function'))
  }, [])

  if (!canShare && !copyFallback) return null

  const share = async () => {
    if (canShare) {
      try {
        await navigator.share({ title, text, url })
      } catch {
        // Condivisione annullata
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text ? `${text} ${url}` : url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt(t('copy'), url)
    }
  }

  const styles = {
    gold: 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] hover:brightness-105',
    dark: 'bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]',
    light: 'border border-[var(--gold)]/50 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]',
    glass: 'bg-white/20 text-white backdrop-blur hover:bg-white/30',
  }[variant]

  if (iconOnly)
    return (
      <button
        type="button"
        onClick={share}
        aria-label={copied ? t('copied') : canShare ? t('native') : t('copy')}
        title={copied ? t('copied') : canShare ? t('native') : t('copy')}
        className={`rounded-lg p-2 transition ${copied ? 'bg-green-500 text-white' : 'bg-[var(--gold-pale)] text-[var(--ink)] hover:bg-[var(--gold)]/25'} ${className}`}
      >
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      </button>
    )

  return (
    <button
      type="button"
      onClick={share}
      title={canShare ? t('nativeHint') : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${styles} ${className}`}
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      <span className="flex flex-col items-start leading-tight">
        <span>{copied ? t('copied') : canShare ? t('native') : t('copy')}</span>
        {canShare && !copied && <span className="text-[10px] font-semibold opacity-75">{t('nativeHint')}</span>}
      </span>
    </button>
  )
}
