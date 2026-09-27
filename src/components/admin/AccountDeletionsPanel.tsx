'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Ban, LoaderCircle, RefreshCw, Trash2, UserX } from 'lucide-react'
import {
  adminCancelDeletion,
  adminExecuteDeletion,
  adminListDeletionRequests,
  type AdminDeletionRequest,
} from '@/app/actions/admin'

type Tab = 'pending' | 'handled'

const STATUS_LABEL: Record<AdminDeletionRequest['status'], { label: string; className: string }> = {
  pending: { label: 'In attesa', className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Eseguita', className: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Annullata', className: 'bg-gray-100 text-gray-700' },
}

const SOURCE_LABEL: Record<string, string> = { stripe: 'Stripe', voucher: 'Voucher', admin: 'Staff' }

const fullName = (u: { first_name: string | null; last_name: string | null; email: string | null } | null) =>
  u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email || '—' : '—'
const when = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—'
const day = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium' }).format(new Date(iso)) : '—'
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

function planLabel(user: NonNullable<AdminDeletionRequest['user']>) {
  const status = user.subscription_status ?? 'free'
  if (status === 'free' || !status) return 'Gratuito'
  const source = user.subscription_source ? ` · ${SOURCE_LABEL[user.subscription_source] ?? user.subscription_source}` : ''
  const until = user.subscription_expires_at ? ` · fino al ${day(user.subscription_expires_at)}` : ''
  return `${status}${source}${until}`
}

// Admin → Cancellazione account: richieste GDPR (art. 17) inviate dagli
// utenti dal profilo. L'esecuzione è irreversibile: abbonamenti Stripe
// annullati, file e contenuti personali cancellati, profilo anonimizzato e
// accesso chiuso. Va completata entro 30 giorni dalla richiesta.
export default function AccountDeletionsPanel({ onChanged }: { onChanged?: () => void }) {
  const [tab, setTab] = useState<Tab>('pending')
  const [items, setItems] = useState<AdminDeletionRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async (current: Tab) => {
    setError(null)
    setItems(null)
    const result = await adminListDeletionRequests(current)
    setItems(result.items)
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento dal server a ogni cambio di scheda (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
  }, [load, tab])

  const execute = async (item: AdminDeletionRequest) => {
    const name = fullName(item.user)
    const ok = confirm(
      `ATTENZIONE: operazione IRREVERSIBILE.\n\n` +
        `Stai per cancellare l'account di ${name} (${item.user?.email ?? '—'}):\n` +
        `• abbonamenti Stripe annullati subito, senza rimborso\n` +
        `• file e contenuti personali cancellati\n` +
        `• punti e coupon persi, eventi futuri e Kordate aperte annullati\n` +
        `• profilo anonimizzato (resta un segnaposto nella rete) e accesso chiuso\n\n` +
        `Non si potrà tornare indietro. Continuare?`,
    )
    if (!ok) return
    const typed = prompt('Per confermare scrivi ELIMINA')
    if ((typed ?? '').trim().toUpperCase() !== 'ELIMINA') {
      alert('Conferma non corretta: nessuna operazione eseguita.')
      return
    }
    setWorking(item.id)
    try {
      const result = await adminExecuteDeletion(item.id, notes[item.id] ?? '')
      const warnings = result.warnings?.length ? `\n\nNote:\n• ${result.warnings.join('\n• ')}` : ''
      if (!result.success) alert(`Errore: ${result.error ?? ''}${warnings}`)
      else alert(`Account cancellato.${warnings}`)
    } catch (err) {
      alert('Errore: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setWorking(null)
    }
    await load(tab)
    onChanged?.()
  }

  const cancel = async (item: AdminDeletionRequest) => {
    const note = (notes[item.id] ?? '').trim()
    if (!note) {
      alert('Scrivi una nota con il motivo dell’annullamento (es. richiesta ritirata dall’utente).')
      return
    }
    if (!confirm(`Annullare la richiesta di cancellazione di ${fullName(item.user)}? L'account resterà attivo.`)) return
    setWorking(item.id)
    try {
      const result = await adminCancelDeletion(item.id, note)
      if (!result.success) alert('Errore: ' + (result.error ?? ''))
    } finally {
      setWorking(null)
    }
    await load(tab)
    onChanged?.()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <UserX className="h-6 w-6" /> Cancellazione account
        </h2>
        <p className="mt-1 text-gray-600">
          Richieste di cancellazione inviate dagli utenti dal proprio profilo (GDPR, art. 17). Vanno gestite entro 30 giorni. L&apos;esecuzione è
          irreversibile: annulla gli abbonamenti Stripe, cancella file e contenuti personali, anonimizza il profilo (resta un segnaposto nella
          rete) e chiude l&apos;accesso. Restano solo i dati che la legge impone di conservare.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'pending', label: 'In attesa' },
            { key: 'handled', label: 'Gestite' },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t.key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => load(tab)}
          className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <RefreshCw className="h-4 w-4" /> Aggiorna
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {items === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          {tab === 'pending' ? 'Nessuna richiesta in attesa.' : 'Nessuna richiesta gestita.'}
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const pending = item.status === 'pending'
            const status = STATUS_LABEL[item.status]
            const age = daysSince(item.requested_at)
            const busy = working === item.id
            return (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-gray-900">{fullName(item.user)}</p>
                    <p className="text-xs text-gray-500">{item.user?.email ?? '— (account non più presente)'}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${status.className}`}>{status.label}</span>
                    <p className="mt-1">Richiesta il {when(item.requested_at)}</p>
                    {pending && (
                      <p className={age >= 25 ? 'font-semibold text-red-600' : ''}>
                        {age} giorni fa · scadenza {day(new Date(new Date(item.requested_at).getTime() + 30 * 86_400_000).toISOString())}
                      </p>
                    )}
                    {item.processed_at && (
                      <p>
                        Gestita il {when(item.processed_at)}
                        {item.processor ? ` da ${fullName(item.processor)}` : item.status === 'cancelled' ? " dall'utente" : ''}
                      </p>
                    )}
                  </div>
                </div>

                {item.user && (
                  <dl className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase text-gray-500">Iscritto il</dt>
                      <dd className="text-gray-900">{day(item.user.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase text-gray-500">Piano</dt>
                      <dd className="text-gray-900">{planLabel(item.user)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase text-gray-500">Invitati diretti</dt>
                      <dd className="text-gray-900">{item.user.invitees}</dd>
                    </div>
                  </dl>
                )}

                <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  <p className="text-xs font-semibold uppercase text-gray-500">Motivo</p>
                  <p className="mt-1 whitespace-pre-line">{item.reason || '— (non indicato)'}</p>
                </div>

                {pending && item.user?.is_admin && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    L&apos;utente è un amministratore completo: la cancellazione verrà rifiutata finché non gli vengono tolti i privilegi.
                  </p>
                )}

                {pending ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={notes[item.id] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                      rows={2}
                      maxLength={1000}
                      placeholder="Nota dello Staff (obbligatoria se annulli, facoltativa se esegui)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || !item.user_id}
                        onClick={() => execute(item)}
                        className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Esegui cancellazione
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => cancel(item)}
                        className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Ban className="h-3.5 w-3.5" /> Annulla richiesta
                      </button>
                    </div>
                  </div>
                ) : (
                  item.staff_note && (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      <span className="font-semibold">Nota dello Staff:</span> {item.staff_note}
                    </p>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
