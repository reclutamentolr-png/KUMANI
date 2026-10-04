'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Inbox, Mail, MailOpen, MessageCircle, Phone, Trash2 } from 'lucide-react'
import { deleteLandingMessage, markLandingMessageRead, type LandingMessage } from '@/app/actions/landing'

// Casella dei messaggi arrivati dal modulo "Scrivimi" della Landing Page.
// Aprendo un messaggio si segna come letto; da qui si risponde con un tocco
// (email, WhatsApp o chiamata, in base al contatto lasciato).
export default function LandingInbox({ initial }: { initial: LandingMessage[] }) {
  const t = useTranslations('landingEditor')
  const locale = useLocale()
  const [messages, setMessages] = useState(initial)
  const [open, setOpen] = useState<string | null>(null)

  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  const digits = (v: string) => v.replace(/[^\d+]/g, '')

  const toggle = async (m: LandingMessage) => {
    setOpen(open === m.id ? null : m.id)
    if (!m.read_at) {
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x)))
      await markLandingMessageRead(m.id)
      // La dashboard e il menu aggiornano il numero dei non letti
      window.dispatchEvent(new Event('refreshLandingUnread'))
    }
  }

  const remove = async (id: string) => {
    if (!confirm(t('inboxDeleteConfirm'))) return
    const r = await deleteLandingMessage(id)
    if (r.success) setMessages((list) => list.filter((x) => x.id !== id))
  }

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
        <Inbox className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="font-semibold text-gray-800">{t('inboxEmpty')}</p>
        <p className="mt-1 text-sm">{t('inboxEmptyHint')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const expanded = open === m.id
        const phone = !isEmail(m.sender_contact) && digits(m.sender_contact).length >= 6 ? digits(m.sender_contact) : null
        return (
          <li key={m.id} className={`rounded-2xl border bg-white shadow-sm ${m.read_at ? 'border-gray-200' : 'border-[var(--gold)]'}`}>
            <button type="button" onClick={() => toggle(m)} className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={expanded}>
              {m.read_at ? <MailOpen className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" /> : <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className={`text-gray-900 ${m.read_at ? 'font-medium' : 'font-bold'}`}>{m.sender_name}</span>
                  <span className="text-xs text-gray-500">{fmt.format(new Date(m.created_at))}</span>
                </span>
                <span className={`mt-0.5 block text-sm text-gray-600 ${expanded ? 'whitespace-pre-line' : 'truncate'}`}>{m.message}</span>
              </span>
            </button>
            {expanded && (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-3">
                <span className="mr-auto break-all text-sm text-gray-700">{m.sender_contact}</span>
                {isEmail(m.sender_contact) && (
                  <a href={`mailto:${m.sender_contact}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white">
                    <Mail className="h-4 w-4" /> {t('inboxReplyEmail')}
                  </a>
                )}
                {phone && (
                  <>
                    <a href={`https://wa.me/${phone.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                    <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800">
                      <Phone className="h-4 w-4" /> {t('inboxCall')}
                    </a>
                  </>
                )}
                <button type="button" onClick={() => remove(m.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-50" aria-label={t('remove')}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
