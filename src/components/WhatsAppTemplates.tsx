'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Copy, MessageSquare, RotateCcw, Send } from 'lucide-react'

type WhatsAppTemplatesProps = {
  referralUrl: string
}

// Prima i generali (il 5, «Cos’è KUMANI in breve», per chi non la conosce),
// poi quelli per argomento: truffe, scadenze, attività, community, famiglia
const IDS = [5, 1, 3, 2, 4, 6, 7, 8, 9, 10] as const

// Messaggi pronti da modificare prima dell'invio: un elenco compatto e si
// apre un messaggio alla volta. Il link di invito resta sempre dentro (se
// viene cancellato si aggiunge in fondo).
export default function WhatsAppTemplates({ referralUrl }: WhatsAppTemplatesProps) {
  const t = useTranslations('whatsappPage')
  const original = (id: number) => t(`template${id}Message`, { url: referralUrl })
  const [texts, setTexts] = useState<Record<number, string>>({})
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)

  const textOf = (id: number) => texts[id] ?? original(id)
  const finalText = (id: number) => {
    const text = textOf(id).trim()
    return text.includes(referralUrl) ? text : `${text}\n${referralUrl}`.trim()
  }

  const handleCopy = async (id: number) => {
    try {
      await navigator.clipboard.writeText(finalText(id))
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Copy error:', err)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">{t('listHint')}</p>
      {IDS.map((id) => {
        const open = openId === id
        const edited = texts[id] !== undefined && texts[id] !== original(id)
        return (
          <div key={id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${open ? 'border-[var(--gold)] shadow-md' : 'border-[var(--gold)]/25 hover:shadow-md'}`}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : id)}
              aria-expanded={open}
              aria-controls={`wa-msg-${id}`}
              className="flex w-full cursor-pointer items-center gap-3 p-4 text-left sm:p-5"
            >
              <MessageSquare className="h-6 w-6 shrink-0 text-[var(--gold)]" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-bold text-[var(--ink)]">{t(`template${id}Title`)}</span>
                  <span className="rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--ink)]">{t(`template${id}Tone`)}</span>
                </span>
                <span className="mt-0.5 block text-sm text-[var(--muted)]">{t(`template${id}Desc`)}</span>
              </span>
              <span className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-[var(--gold)]/40 px-3 text-sm font-bold text-[var(--ink)]">
                {open ? t('closeMsg') : t('openMsg')}
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {open && (
              <div id={`wa-msg-${id}`} className="border-t border-[var(--gold)]/15 p-4 sm:p-5">
                <label htmlFor={`wa-text-${id}`} className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                  {t('messageLabel')}
                </label>
                <textarea
                  id={`wa-text-${id}`}
                  value={textOf(id)}
                  onChange={(e) => setTexts((prev) => ({ ...prev, [id]: e.target.value.slice(0, 1500) }))}
                  rows={12}
                  className="mb-1 w-full resize-y rounded-lg border-l-4 border-[var(--gold)] bg-[var(--paper)] p-4 text-base text-[var(--ink-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50 sm:text-sm"
                />
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[var(--muted)]">{t('editHint')}</p>
                  {edited && (
                    <button
                      type="button"
                      onClick={() => setTexts((prev) => ({ ...prev, [id]: original(id) }))}
                      className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--ink)] underline-offset-2 hover:underline"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> {t('resetText')}
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => handleCopy(id)}
                    className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[var(--ink-soft)]"
                    aria-live="polite"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedId === id ? t('copied') : t('copyMsg')}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(finalText(id))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#1ebe5a]"
                  >
                    <Send className="h-4 w-4" />
                    {t('sendWhatsApp')}
                  </a>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
