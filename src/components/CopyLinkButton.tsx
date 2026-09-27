'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function CopyLinkButton({
  url,
  colorClassName = 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 text-[var(--ink)] font-bold',
}: {
  url: string
  // Lets a specific tool page override the accent color (this component is
  // shared across several tools with their own individual color schemes);
  // defaults to the KUMANI gold gradient.
  colorClassName?: string
}) {
  const t = useTranslations('marketplace')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
      } else {
        // navigator.clipboard is only available in secure contexts (HTTPS or
        // localhost) — fall back to the legacy approach so this still works
        // when testing over the LAN IP (e.g. scanning a QR from a phone).
        const textarea = document.createElement('textarea')
        textarea.value = url
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Error copying:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${colorClassName}`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? t('copied') : t('copy')}
    </button>
  )
}
