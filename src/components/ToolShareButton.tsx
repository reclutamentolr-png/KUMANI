'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Clapperboard, Link2, Share2 } from 'lucide-react'
import { getShareableTools } from '@/lib/shareableTools'
import { getMyShareLink } from '@/app/actions/shareLinks'
import { locales } from '../../i18n'

// Pulsante "Condividi" fisso in basso a sinistra dentro ogni strumento del
// marketplace (in basso a destra ci sono già lettore audio e pulsanti "+").
// Riconosce lo strumento dall'indirizzo. Se il servizio ha il video ufficiale
// (Admin → Video dei servizi) apre un piccolo menu:
// - «Invia il video»: messaggio già scritto con il link corto kumani.io/v/CODICE
//   (video da YouTube, chi consiglia e iscrizione con il suo invito);
// - «Condividi il servizio»: la pagina pubblica /strumenti/[strumento] con il
//   codice invito, come prima.
// Condivisione nativa del telefono; dove non c'è (computer) copia il testo.
export default function ToolShareButton({ referralCode, videoTools }: { referralCode: string | null; videoTools: string[] }) {
  const pathname = usePathname()
  const t = useTranslations('toolShare')
  const tv = useTranslations('shareVideo')
  const tm = useTranslations('marketplace')
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  // Codice corto preparato quando si apre il menu: al tocco su «Invia il
  // video» la condivisione parte subito (Safari la vuole dentro il tocco)
  const [slug, setSlug] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && locales.includes(segments[0])) segments.shift()
  const tool = segments[0] === 'marketplace' ? getShareableTools(tm).find((item) => item.toolName === segments[1] && (item.publicPage || videoTools.includes(item.toolName))) : undefined
  const hasVideo = !!tool && !!referralCode && videoTools.includes(tool.toolName)

  const toolName = tool?.toolName
  useEffect(() => {
    if (!open || !toolName || slug) return
    let alive = true
    getMyShareLink(toolName).then((result) => {
      if (alive && result) setSlug(result.slug)
    })
    return () => {
      alive = false
    }
  }, [open, toolName, slug])

  // Il menu si chiude toccando fuori
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  if (!tool) return null
  // NEXUS: sul telefono in basso c'è la tastiera del gioco
  const keyboard = tool.toolName === 'nexus'

  const send = async (text: string, url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${tool.title} · KUMANI`, text, url })
      } catch {
        // Condivisione annullata dall'utente.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Appunti non disponibili: niente da fare.
    }
  }

  // Senza prefisso di lingua: chi riceve il link lo apre nella propria lingua.
  const shareService = () => {
    setOpen(false)
    send(t('shareText', { tool: tool.title }), `${window.location.origin}/strumenti/${tool.toolName}${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ''}`)
  }
  const shareVideo = () => {
    if (!slug) return
    setOpen(false)
    send(tv('message', { tool: tool.title }), `${window.location.origin}/v/${slug}`)
  }

  const label = copied ? t('linkCopied') : t('shareButton')
  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50'

  return (
    <div ref={box} className={`tool-share-fab fixed bottom-4 left-4 z-40 ${keyboard ? 'hidden sm:block' : ''} print:hidden`}>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-2xl border border-[var(--gold)]/40 bg-[var(--ink)] p-1.5 shadow-[0_18px_45px_rgba(23,23,23,0.45)]">
          <button type="button" onClick={shareVideo} disabled={!slug} className={item}>
            <Clapperboard className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            <span>
              <span className="block">{tv('sendVideo')}</span>
              <span className="block text-xs font-normal text-white/60">{tv('sendVideoHint')}</span>
            </span>
          </button>
          {/* Sezioni della Community: niente pagina pubblica, solo il video */}
          {tool.publicPage && (
            <button type="button" onClick={shareService} className={item}>
              <Link2 className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
              <span>{tv('shareService')}</span>
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={hasVideo ? () => setOpen((v) => !v) : shareService}
        aria-label={label}
        aria-expanded={hasVideo ? open : undefined}
        title={label}
        // Sul telefono solo l'icona, in basso a sinistra: non copre i contenuti
        className="flex h-12 w-12 items-center justify-center gap-2 rounded-full border border-[var(--gold)]/40 bg-[var(--ink)] text-sm font-semibold text-white shadow-[0_12px_35px_rgba(23,23,23,0.35)] transition-all hover:-translate-y-0.5 hover:text-[var(--gold-bright)] sm:h-auto sm:w-auto sm:px-4 sm:py-3"
      >
        {copied ? <Check className="h-5 w-5 text-green-400 sm:h-4 sm:w-4" /> : <Share2 className="h-5 w-5 text-[var(--gold-bright)] sm:h-4 sm:w-4" />}
        <span className="hidden sm:inline">{label}</span>
      </button>
    </div>
  )
}
