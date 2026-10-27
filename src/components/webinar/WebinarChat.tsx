'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { EyeOff, Loader2, Send, X } from 'lucide-react'
import { WEBINAR_MESSAGE_MAX, type WebinarMessage } from '@/lib/webinar'
import WebinarName from '@/components/webinar/WebinarName'

// Chat del webinar: domande di chi guarda, risposte di chi presenta
export default function WebinarChat({
  messages,
  hiddenIds,
  onSend,
  onHide,
  onClose,
  disabled,
  title,
  placeholder,
}: {
  messages: WebinarMessage[]
  hiddenIds: number[]
  onSend: (body: string) => Promise<string | null>
  onHide?: (id: number) => void
  // Nasconde la chat (si riapre dal pulsante «Chat» della barra)
  onClose?: () => void
  disabled?: boolean
  title: string
  placeholder: string
}) {
  const t = useTranslations('webinar')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const stickRef = useRef(true)

  const visible = messages.filter((m) => !hiddenIds.includes(m.id))

  // Resta in fondo ai messaggi nuovi, se non si stava rileggendo più su
  useEffect(() => {
    const list = listRef.current
    if (list && stickRef.current) list.scrollTop = list.scrollHeight
  }, [visible.length])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    const err = await onSend(body)
    setBusy(false)
    if (err) setError(err)
    else {
      setDraft('')
      stickRef.current = true
    }
  }

  return (
    <section aria-label={title} className="flex min-h-0 flex-1 flex-col rounded-2xl bg-[#1b1915] p-3 text-white">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="flex-1 text-xs font-extrabold uppercase tracking-wide text-white/70">{title}</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('chatHide')}
            title={t('chatHide')}
            className="-my-1 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <ol
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
        aria-live="polite"
        className="min-h-[120px] flex-1 space-y-2 overflow-y-auto pr-1"
      >
        {visible.length === 0 && <li className="text-sm text-white/55">{t('chatEmpty')}</li>}
        {visible.map((m) => (
          <li key={m.id} className={`group flex items-start gap-2 text-sm leading-snug ${m.isHost ? 'rounded-xl bg-[var(--gold)]/12 px-2.5 py-2' : ''}`}>
            <p className="min-w-0 flex-1 break-words">
              <strong className="mr-1.5">
                <WebinarName name={m.name} kumano={m.kumano} />
                {m.isHost && <span className="ml-1 text-xs font-semibold text-white/60">· {t('hostTag')}</span>}
              </strong>
              {m.body}
            </p>
            {onHide && !m.isHost && (
              <button
                type="button"
                onClick={() => onHide(m.id)}
                aria-label={t('hideMessage')}
                title={t('hideMessage')}
                className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
              >
                <EyeOff className="h-4 w-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-300">
          {error}
        </p>
      )}
      <form onSubmit={send} className="mt-2 flex gap-2">
        <label htmlFor="webinar-chat-input" className="sr-only">
          {placeholder}
        </label>
        <input
          id="webinar-chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={WEBINAR_MESSAGE_MAX}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-full border-0 bg-[#2a2620] px-4 text-base text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-[var(--gold)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || busy || !draft.trim()}
          aria-label={t('send')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--gold-bright)] text-[var(--ink)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
        </button>
      </form>
    </section>
  )
}
