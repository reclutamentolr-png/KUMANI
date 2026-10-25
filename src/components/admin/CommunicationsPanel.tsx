'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellRing, CheckCircle2, Eye, LoaderCircle, Mail, MailX, RefreshCw, Send, X } from 'lucide-react'
import { notify } from '@/lib/adminNotify'
import { askConfirm } from '@/lib/confirm'
import {
  adminEmailUnsubscribes,
  adminListCommunications,
  adminPreviewCommunicationEmail,
  adminResubscribeEmail,
  adminSendCommunicationEmail,
  adminSendCommunicationPush,
  adminTestCommunicationEmail,
  type CommunicationRow,
  type UnsubscribeRow,
} from '@/app/actions/adminCommunications'

// Admin → Comunicazioni: messaggi a tutti gli iscritti già pronti (notifica
// push e/o email). «Da inviare» finché un canale non è partito; «Inviati» con
// data e numeri. «Non vogliono email»: chi ha usato il link nelle email.

type Tab = 'todo' | 'sent' | 'unsub'

const when = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50'

export default function CommunicationsPanel() {
  const [tab, setTab] = useState<Tab>('todo')
  const [items, setItems] = useState<CommunicationRow[]>([])
  const [counts, setCounts] = useState({ emailPeople: 0, emailExcluded: 0, pushPeople: 0 })
  const [unsubs, setUnsubs] = useState<UnsubscribeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [r, u] = await Promise.all([adminListCommunications(), adminEmailUnsubscribes()])
    if (r.error) notify('Errore: ' + r.error)
    setItems(r.items)
    setCounts({ emailPeople: r.emailPeople, emailExcluded: r.emailExcluded, pushPeople: r.pushPeople })
    setUnsubs(u.rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dal server all'apertura
    load()
  }, [load])

  // Da inviare: almeno un canale previsto non è ancora partito
  const pending = (c: CommunicationRow) => (!!c.push_title && !c.push_sent_at) || (!!c.email_subject && !c.email_sent_at)
  const todo = items.filter(pending)
  const sent = items.filter((c) => c.push_sent_at || c.email_sent_at)

  const sendPush = async (c: CommunicationRow) => {
    if (!(await askConfirm(`Inviare la notifica «${c.push_title}» a tutte le persone con le notifiche attive (circa ${counts.pushPeople})? Non si può annullare.`, { tone: 'warning' }))) return
    setBusy(c.id + 'push')
    const r = await adminSendCommunicationPush(c.id)
    setBusy(null)
    if (!r.success) return notify('Errore: ' + r.error)
    notify(`Notifica inviata a ${r.recipients} persone (${r.sent} dispositivi)`)
    load()
  }

  const sendEmail = async (c: CommunicationRow) => {
    if (!(await askConfirm(`Inviare l’email «${c.email_subject}» a ${counts.emailPeople} iscritti? ${counts.emailExcluded ? `${counts.emailExcluded} hanno scelto di non riceverle e saranno esclusi. ` : ''}Non si può annullare.`, { tone: 'warning' }))) return
    setBusy(c.id + 'email')
    const r = await adminSendCommunicationEmail(c.id)
    setBusy(null)
    if (!r.success) return notify('Errore: ' + r.error)
    notify(`Email inviata a ${r.sent} iscritti${r.failed ? `, ${r.failed} non partite` : ''}`)
    load()
  }

  const test = async (c: CommunicationRow) => {
    setBusy(c.id + 'test')
    const r = await adminTestCommunicationEmail(c.id)
    setBusy(null)
    notify(r.success ? `Prova inviata a ${r.to}` : 'Errore: ' + r.error)
  }

  const showPreview = async (c: CommunicationRow) => {
    setBusy(c.id + 'preview')
    const r = await adminPreviewCommunicationEmail(c.id)
    setBusy(null)
    if (r.html) setPreview(r.html)
    else notify('Errore: ' + r.error)
  }

  const resubscribe = async (row: UnsubscribeRow) => {
    if (!(await askConfirm(`Rimettere ${row.name || row.email} tra chi riceve le email? Fallo solo se te l’ha chiesto.`))) return
    const r = await adminResubscribeEmail(row.user_id)
    if (!r.success) return notify('Errore: ' + r.error)
    notify('Fatto')
    load()
  }

  const card = (c: CommunicationRow) => {
    const isOpen = open === c.id
    return (
      <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{c.title}</p>
            <p className="text-xs text-gray-500">
              Preparata il {when(c.created_at)}
              {c.note ? ` · ${c.note}` : ''}
            </p>
          </div>
          <button type="button" onClick={() => setOpen(isOpen ? null : c.id)} className="text-xs font-semibold text-[var(--gold)] hover:underline">
            {isOpen ? 'Chiudi il testo' : 'Leggi il testo'}
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {c.push_title && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                <BellRing className="h-3.5 w-3.5" /> Notifica push
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{c.push_title}</p>
              <p className="text-sm text-gray-700">{c.push_body}</p>
              <p className="mt-1 text-xs text-gray-500">Apre: {c.push_url || '/dashboard'}</p>
              <div className="mt-2">
                {c.push_sent_at ? (
                  <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Inviata il {when(c.push_sent_at)}
                    {c.push_result ? ` · ${c.push_result.recipients ?? 0} persone, ${c.push_result.sent ?? 0} dispositivi` : ''}
                  </p>
                ) : (
                  <button type="button" disabled={!!busy} onClick={() => sendPush(c)} className={`${btn} bg-gray-900 text-white hover:bg-gray-700`}>
                    {busy === c.id + 'push' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Invia la notifica a tutti
                  </button>
                )}
              </div>
            </div>
          )}
          {c.email_subject && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                <Mail className="h-3.5 w-3.5" /> Email · da {c.email_from}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{c.email_subject}</p>
              {c.email_preheader && <p className="text-sm text-gray-700">{c.email_preheader}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={!!busy} onClick={() => showPreview(c)} className={`${btn} border border-gray-300 text-gray-700 hover:bg-white`}>
                  {busy === c.id + 'preview' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Anteprima
                </button>
                <button type="button" disabled={!!busy} onClick={() => test(c)} className={`${btn} border border-gray-300 text-gray-700 hover:bg-white`}>
                  {busy === c.id + 'test' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Mandami una prova
                </button>
                {c.email_sent_at ? (
                  <p className="flex w-full items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Inviata il {when(c.email_sent_at)}
                    {c.email_result ? ` · ${c.email_result.sent ?? 0} iscritti${c.email_result.failed ? `, ${c.email_result.failed} non partite` : ''}${c.email_result.excluded ? `, ${c.email_result.excluded} esclusi` : ''}` : ''}
                  </p>
                ) : (
                  <button type="button" disabled={!!busy} onClick={() => sendEmail(c)} className={`${btn} bg-gray-900 text-white hover:bg-gray-700`}>
                    {busy === c.id + 'email' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Invia l’email a tutti
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {isOpen && c.email_body && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-sm text-gray-800">{c.email_body}</pre>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Comunicazioni a tutti gli iscritti</h2>
          <p className="text-sm text-gray-600">
            Messaggi già pronti: li invii quando vuoi, una volta sola. Email a {counts.emailPeople} iscritti
            {counts.emailExcluded ? ` (${counts.emailExcluded} non vogliono email)` : ''} · notifiche a {counts.pushPeople} persone con le notifiche attive.
          </p>
        </div>
        <button type="button" onClick={load} className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}>
          <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['todo', `Da inviare (${todo.length})`],
            ['sent', `Inviati (${sent.length})`],
            ['unsub', `Non vogliono email (${unsubs.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Caricamento…
        </p>
      ) : tab === 'unsub' ? (
        unsubs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">Nessuno ha scelto di non ricevere le email.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Persona</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Quando</th>
                  <th className="px-4 py-2">Da quale email</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {unsubs.map((u) => (
                  <tr key={u.user_id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-semibold text-gray-900">
                      <span className="inline-flex items-center gap-1.5">
                        <MailX className="h-4 w-4 text-gray-400" /> {u.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{u.email || '—'}</td>
                    <td className="px-4 py-2 text-gray-700">{when(u.unsubscribed_at)}</td>
                    <td className="px-4 py-2 text-gray-500">{u.from_title || '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" onClick={() => resubscribe(u)} className="text-xs font-semibold text-[var(--gold)] hover:underline">
                        Rimetti
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">Non ricevono le comunicazioni via email; le notifiche push restano come le hanno impostate.</p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {(tab === 'todo' ? todo : sent).length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">{tab === 'todo' ? 'Nessun messaggio da inviare.' : 'Nessun messaggio inviato.'}</p>
          )}
          {(tab === 'todo' ? todo : sent).map(card)}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Anteprima email">
          <div className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
              <p className="text-sm font-semibold text-gray-900">Anteprima (con un nome di esempio)</p>
              <button type="button" onClick={() => setPreview(null)} className="rounded p-1 hover:bg-gray-100" aria-label="Chiudi">
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe title="Anteprima email" srcDoc={preview} sandbox="" className="min-h-0 flex-1" />
          </div>
        </div>
      )}
    </div>
  )
}
