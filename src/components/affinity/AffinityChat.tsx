'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle, Send, ShieldCheck, X } from 'lucide-react'
import { loadAffinityChat, sendAffinityMessage, type ChatMessage } from '@/app/actions/affinityFriends'
import { useAffinityRealtime } from '@/lib/useAffinityRealtime'

// Chat tra due persone che si sono dette sì. Nessun numero o email: tutto
// resta in piattaforma. I nuovi messaggi arrivano in tempo reale.
export default function AffinityChat({ introId, name, onClose }: { introId: string; name: string; onClose: () => void }) {
  const t = useTranslations('affinity')
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const data = await loadAffinityChat(introId)
    if (data) setMessages(data)
  }, [introId])

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono, come KuManagementPanel).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  // Nuovo messaggio (o pagina tornata visibile): si rilegge la chat.
  useAffinityRealtime(refresh)

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    setError(null)
    const result = await sendAffinityMessage(introId, text)
    setSending(false)
    if (result === 'ok') {
      setText('')
      refresh()
    } else {
      setError(result === 'rate_limited' ? t('f_chatRateLimited') : t('f_chatError'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:h-[70vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="font-bold text-[var(--ink)]">{name}</p>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100" aria-label={t('f_close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="flex items-center gap-1.5 bg-[var(--gold-pale)] px-4 py-2 text-[11px] leading-4 text-[var(--ink)]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" /> {t('f_chatSafety')}
        </p>
        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {messages === null ? (
            <div className="flex justify-center py-10">
              <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">{t('f_chatEmpty', { name })}</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                <p
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                    m.mine ? 'rounded-br-md bg-[var(--ink)] text-white' : 'rounded-bl-md bg-gray-100 text-gray-900'
                  }`}
                >
                  {m.body}
                </p>
              </div>
            ))
          )}
          <div ref={bottom} />
        </div>
        {error && <p className="px-4 pb-1 text-xs font-semibold text-amber-700">{error}</p>}
        <form onSubmit={send} className="flex items-end gap-2 border-t border-gray-100 p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={1}
            placeholder={t('f_chatPlaceholder')}
            className="max-h-28 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)] disabled:opacity-40"
            aria-label={t('f_send')}
          >
            {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
