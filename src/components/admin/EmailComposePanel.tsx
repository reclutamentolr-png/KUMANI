'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, LoaderCircle, Mail, RefreshCw, Send, X } from 'lucide-react'
import { adminListSentEmails, adminSendEmail, type SentEmailRow } from '@/app/actions/adminEmailSend'
import { KUMANI_MAILBOXES } from '@/lib/contactInfo'
import AdminUserPicker from '@/components/admin/AdminUserPicker'
import { notify } from '@/lib/adminNotify'
import type { StaffUserHit } from '@/app/actions/admin'
import { askConfirm } from '@/lib/confirm'

// Admin → Invio Email: si scrive un'email da support@, privacy@ o
// info@kumani.io. Le risposte arrivano all'indirizzo scelto (e quindi nella
// Gmail di KUMANI). Sotto, lo storico degli invii.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function EmailComposePanel() {
  const [from, setFrom] = useState<string>(KUMANI_MAILBOXES[0].address)
  const [to, setTo] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [copyToSelf, setCopyToSelf] = useState(true)
  const [picked, setPicked] = useState<StaffUserHit | null>(null)
  const [sending, setSending] = useState(false)
  const [rows, setRows] = useState<SentEmailRow[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const applyHistory = useCallback((result: Awaited<ReturnType<typeof adminListSentEmails>>) => {
    if (!result.success) setHistoryError(result.error ?? 'Errore')
    else {
      setHistoryError(null)
      setRows(result.rows ?? [])
    }
  }, [])

  useEffect(() => {
    adminListSentEmails().then(applyHistory)
  }, [applyHistory])

  // Aggiunge uno o più indirizzi scritti (separati da virgola, spazio o a capo)
  const addAddresses = (text: string) => {
    const list = text
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    const bad = list.filter((e) => !EMAIL_RE.test(e))
    if (bad.length) notify(`Indirizzi non validi: ${bad.join(', ')}`)
    const good = list.filter((e) => EMAIL_RE.test(e))
    if (good.length) setTo((prev) => [...new Set([...prev, ...good])].slice(0, 20))
    setDraft(bad.join(', '))
  }

  const pickUser = (user: StaffUserHit | null) => {
    setPicked(null)
    if (!user) return
    if (!user.email) {
      notify('Questo utente non ha un’email')
      return
    }
    setTo((prev) => [...new Set([...prev, user.email!.toLowerCase()])].slice(0, 20))
  }

  const mailbox = KUMANI_MAILBOXES.find((m) => m.address === from)!

  const send = async () => {
    const recipients = [...to]
    if (draft.trim()) {
      const extra = draft.split(/[\s,;]+/).filter((e) => EMAIL_RE.test(e.trim()))
      recipients.push(...extra)
    }
    if (recipients.length === 0) {
      notify('Aggiungi almeno un destinatario')
      return
    }
    if (!(await askConfirm(`Inviare l’email da ${from} a ${recipients.length} destinatar${recipients.length === 1 ? 'io' : 'i'}?`))) return
    setSending(true)
    const result = await adminSendEmail({ from, to: recipients, subject, body, copyToSelf })
    setSending(false)
    if (!result.success) {
      notify('Errore: ' + (result.error ?? ''))
      return
    }
    notify(
      `Email inviata a ${result.sent} destinatar${result.sent === 1 ? 'io' : 'i'}${result.failed?.length ? `. Non inviata a: ${result.failed.join(', ')}` : ''}`,
      result.failed?.length ? undefined : 'success',
    )
    setTo([])
    setDraft('')
    setSubject('')
    setBody('')
    adminListSentEmails().then(applyHistory)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Invio Email</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Scrivi un’email da uno degli indirizzi di KUMANI. Ogni destinatario la riceve da solo (non vede gli altri) e le risposte arrivano all’indirizzo scelto, quindi nella Gmail di KUMANI.
        </p>
      </div>

      <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900">Da</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {KUMANI_MAILBOXES.map((m) => (
              <button
                key={m.address}
                type="button"
                onClick={() => setFrom(m.address)}
                className={`rounded-lg border p-3 text-left transition ${from === m.address ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white hover:border-gray-400'}`}
              >
                <p className="font-mono text-sm font-semibold">{m.address}</p>
                <p className={`text-xs ${from === m.address ? 'text-gray-300' : 'text-gray-500'}`}>
                  {m.name} · {m.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900">A</p>
          {to.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {to.map((e) => (
                <span key={e} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-800">
                  {e}
                  <button type="button" onClick={() => setTo((prev) => prev.filter((x) => x !== e))} aria-label={`Togli ${e}`} className="text-gray-400 hover:text-gray-800">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="grid gap-2 lg:grid-cols-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addAddresses(draft)
                }
              }}
              onBlur={() => draft.trim() && addAddresses(draft)}
              placeholder="Scrivi un’email e premi Invio (anche più, separate da virgola)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <AdminUserPicker scope="matrix" selected={picked} onSelect={pickUser} placeholder="…oppure cerca un utente KUMANI" />
          </div>
          <p className="mt-1 text-xs text-gray-500">Massimo 20 destinatari per invio. Per comunicazioni a tutti gli utenti usa “Messaggi agli utenti”.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900" htmlFor="email-subject">
            Oggetto
          </label>
          <input
            id="email-subject"
            type="text"
            value={subject}
            maxLength={200}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900" htmlFor="email-body">
            Messaggio
          </label>
          <textarea
            id="email-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            maxLength={20000}
            placeholder={'Buongiorno,\n\n…'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6"
          />
          <p className="mt-1 text-xs text-gray-500">
            Testo semplice: una riga vuota crea un nuovo paragrafo e i link diventano cliccabili. In fondo viene aggiunta la firma <b>{mailbox.name}</b> · {mailbox.address}.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={copyToSelf} onChange={(e) => setCopyToSelf(e.target.checked)} />
          Manda una copia a {from} (arriva nella Gmail di KUMANI)
        </label>

        <button
          type="button"
          onClick={send}
          disabled={sending || !subject.trim() || !body.trim() || (to.length === 0 && !draft.trim())}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
        >
          {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Invia da {from}
        </button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Mail className="h-5 w-5" /> Email inviate
          </h3>
          <button type="button" onClick={() => adminListSentEmails().then(applyHistory)} className="text-gray-500 hover:text-gray-900" aria-label="Aggiorna">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {historyError && <p className="text-sm text-amber-700">{historyError}</p>}
        {rows && rows.length === 0 && <p className="text-sm text-gray-500">Nessuna email inviata finora.</p>}
        <div className="divide-y divide-gray-100">
          {(rows ?? []).map((r) => (
            <div key={r.id} className="py-2">
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-start justify-between gap-3 text-left">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{r.subject}</p>
                  <p className="truncate text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleString('it-IT')} · da {r.from_address} · a {r.to_addresses.join(', ')}
                    {r.sender ? ` · ${r.sender}` : ''}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  <span className={r.failed.length ? 'text-amber-700' : 'text-emerald-700'}>
                    {r.sent_count}/{r.to_addresses.length} inviate
                  </span>
                  {open === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>
              {open === r.id && (
                <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm">
                  <p className="whitespace-pre-wrap text-gray-800">{r.body}</p>
                  {r.failed.length > 0 && <p className="mt-2 text-xs text-amber-700">Non inviata a: {r.failed.join(', ')}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
