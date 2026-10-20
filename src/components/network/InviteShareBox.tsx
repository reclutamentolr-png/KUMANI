'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import CopyButton from '@/components/CopyButton'
import NativeShareButton from '@/components/NativeShareButton'

type Variant = 'short' | 'code'

// Riquadro «Invita» della rete: il Kumano sceglie quale link mandare, il
// link corto (kumani.io/i/…, conta le aperture) o quello con il codice invito
// in vista (kumani.io/ref/CODICE). Portano alla stessa pagina d'invito.
export default function InviteShareBox({
  links,
  messages,
  shareText,
  texts,
}: {
  links: Record<Variant, string>
  // Messaggio WhatsApp già scritto, con l'uno o l'altro link
  messages: Record<Variant, string>
  shareText: string
  texts: { short: string; code: string; label: string; whatsapp: string }
}) {
  const [variant, setVariant] = useState<Variant>('short')
  const url = links[variant]
  const tab = (value: Variant) =>
    `flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${variant === value ? 'bg-[var(--gold-bright)] text-[var(--ink)]' : 'text-white/75 hover:text-white'}`
  return (
    <>
      <div role="radiogroup" aria-label={texts.label} className="relative mt-5 flex gap-1 rounded-lg border border-[var(--gold)]/35 bg-white/5 p-1">
        <button type="button" role="radio" aria-checked={variant === 'short'} onClick={() => setVariant('short')} className={tab('short')}>
          {texts.short}
        </button>
        <button type="button" role="radio" aria-checked={variant === 'code'} onClick={() => setVariant('code')} className={tab('code')}>
          {texts.code}
        </button>
      </div>
      <div className="relative mt-2 flex gap-2">
        <input
          readOnly
          value={url}
          aria-label={texts.label}
          className="min-w-0 flex-1 rounded-lg border border-[var(--gold)]/35 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/60"
        />
        <CopyButton text={url} />
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(messages[variant])}`}
        target="_blank"
        rel="noopener noreferrer"
        className="relative mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] hover:brightness-110"
      >
        <MessageCircle className="h-4 w-4" /> {texts.whatsapp}
      </a>
      <NativeShareButton url={url} title="KUMANI" text={shareText} variant="glass" copyFallback={false} className="relative mt-2 w-full" />
    </>
  )
}
