'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Inbox, LoaderCircle, Mail, RefreshCw, RotateCcw } from 'lucide-react'
import { adminListContactMessages, adminSetContactMessageStatus, type AdminContactMessage } from '@/app/actions/admin'

type Tab = 'new' | 'handled' | 'all'

const TABS: { id: Tab; label: string }[] = [
  { id: 'new', label: 'Da gestire' },
  { id: 'handled', label: 'Gestiti' },
  { id: 'all', label: 'Tutti' },
]

const TOPIC: Record<AdminContactMessage['topic'], { label: string; className: string }> = {
  support: { label: 'Supporto', className: 'bg-[var(--ink)] text-[var(--gold-bright)]' },
  billing: { label: 'Pagamenti', className: 'bg-amber-100 text-amber-800' },
  pro: { label: 'Professionisti', className: 'bg-[var(--gold-pale)] text-[var(--ink)] ring-1 ring-[var(--gold)]/50' },
  partnership: { label: 'Partnership', className: 'bg-emerald-100 text-emerald-800' },
  privacy: { label: 'Privacy', className: 'bg-rose-100 text-rose-800' },
  other: { label: 'Altro', className: 'bg-gray-100 text-gray-700' },
}

const when = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

// Admin → Messaggi dal sito: quanto arriva dal modulo della pagina Contatti.
// Si risponde via email (link mailto) e poi si segna come gestito.
export default function ContactMessagesPanel() {
  const [tab, setTab] = useState<Tab>('new')
  const [items, setItems] = useState<AdminContactMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  const load = useCallback(async (current: Tab) => {
    setError(null)
    setItems(null)
    const result = await adminListContactMessages(current)
    setItems(result.messages)
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento dal server a ogni cambio di scheda (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
  }, [load, tab])

  const setStatus = async (item: AdminContactMessage, status: 'new' | 'handled') => {
    setWorking(item.id)
    const result = await adminSetContactMessageStatus(item.id, status)
    setWorking(null)
    if (!result.success) {
      alert('Errore: ' + (result.error ?? ''))
      return
    }
    setItems((prev) =>
      (prev ?? [])
        .map((m) => (m.id === item.id ? { ...m, status, handled_at: status === 'handled' ? new Date().toISOString() : null } : m))
        .filter((m) => tab === 'all' || m.status === tab)
    )
  }

  const replyHref = (item: AdminContactMessage) =>
    `mailto:${item.email}?subject=${encodeURIComponent(`Re: il tuo messaggio a KUMANI (${TOPIC[item.topic]?.label ?? item.topic})`)}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Inbox className="h-7 w-7" /> Messaggi dal sito
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Quello che le persone scrivono dal modulo della pagina Contatti. Rispondi via email, poi segna il messaggio come gestito.
          </p>
        </div>
        <button
          onClick={() => load(tab)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Aggiorna
        </button>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {items === null ? (
        <div className="flex justify-center py-12 text-gray-500">
          <LoaderCircle className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          {tab === 'new' ? 'Nessun messaggio da gestire. Ottimo lavoro!' : 'Nessun messaggio.'}
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const topic = TOPIC[item.topic] ?? TOPIC.other
            return (
              <li key={item.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${topic.className}`}>{topic.label}</span>
                      {item.status === 'handled' && (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Gestito</span>
                      )}
                      {item.user_id && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Utente registrato</span>
                      )}
                      {item.locale && item.locale !== 'it' && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium uppercase text-gray-600">{item.locale}</span>
                      )}
                    </div>
                    <p className="mt-2 font-semibold text-gray-900">{item.name}</p>
                    <a href={replyHref(item)} className="inline-flex items-center gap-1 break-all text-sm font-medium text-[var(--ink)] hover:text-[var(--gold)] hover:underline">
                      <Mail className="h-4 w-4 flex-shrink-0" /> {item.email}
                    </a>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>{when(item.created_at)}</div>
                    {item.handled_at && <div>Gestito il {when(item.handled_at)}</div>}
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">{item.message}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={replyHref(item)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Mail className="h-4 w-4" /> Rispondi
                  </a>
                  {item.status === 'new' ? (
                    <button
                      onClick={() => setStatus(item, 'handled')}
                      disabled={working === item.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {working === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Segna come gestito
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(item, 'new')}
                      disabled={working === item.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {working === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Riapri
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
