'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, MessageSquare, RotateCcw, Send } from 'lucide-react'

type WhatsAppTemplatesProps = {
  referralUrl: string
}

const IDS = [1, 2, 3, 4] as const

// Messaggi pronti da modificare prima dell'invio: il link di invito resta
// sempre dentro (se viene cancellato si aggiunge in fondo).
export default function WhatsAppTemplates({ referralUrl }: WhatsAppTemplatesProps) {
  const t = useTranslations('whatsappPage')
  const original = (id: number) => t(`template${id}Message`, { url: referralUrl })
  const [texts, setTexts] = useState<Record<number, string>>({})
  const [copiedId, setCopiedId] = useState<number | null>(null)

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
    <div className="space-y-4">
      {IDS.map((id) => {
        const edited = texts[id] !== undefined && texts[id] !== original(id)
        return (
          <div key={id} className="bg-white rounded-2xl border border-[var(--gold)]/25 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-[var(--ink)]">{t(`template${id}Title`)}</h3>
                  <span className="inline-block mt-1 text-xs bg-[var(--gold)]/15 text-[var(--ink)] px-2 py-0.5 rounded-full font-semibold">{t(`template${id}Tone`)}</span>
                </div>
                <MessageSquare className="w-6 h-6 shrink-0 text-[var(--gold)]" />
              </div>

              <label htmlFor={`wa-text-${id}`} className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                {t('messageLabel')}
              </label>
              <textarea
                id={`wa-text-${id}`}
                value={textOf(id)}
                onChange={(e) => setTexts((prev) => ({ ...prev, [id]: e.target.value.slice(0, 1500) }))}
                rows={7}
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
                  className="flex-1 flex min-h-11 cursor-pointer items-center justify-center gap-2 px-4 py-2.5 bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white rounded-lg font-semibold transition-colors"
                  aria-live="polite"
                >
                  <Copy className="w-4 h-4" />
                  {copiedId === id ? t('copied') : t('copyMsg')}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(finalText(id))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#1ebe5a] text-white rounded-lg font-semibold transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {t('sendWhatsApp')}
                </a>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
