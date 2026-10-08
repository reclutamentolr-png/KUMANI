'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellRing, LoaderCircle, RefreshCw, Send, Smartphone } from 'lucide-react'
import { adminPushOverview, adminPushUserStatus, adminSendPushCampaign, type PushAudience } from '@/app/actions/push'
import { notify } from '@/lib/adminNotify'
import AdminUserPicker from '@/components/admin/AdminUserPicker'
import type { StaffUserHit } from '@/app/actions/admin'
import { askConfirm } from '@/lib/confirm'

// Admin → Notifiche push: avvisi dello Staff sui telefoni e computer dei
// Kumani che hanno attivato le notifiche (e non hanno spento "Avvisi dello
// Staff"). Le notifiche automatiche (punti, scadenze, eventi) partono da sole.

const AUDIENCES: { value: PushAudience; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'active', label: 'Solo con abbonamento attivo' },
  { value: 'inactive', label: 'Solo senza abbonamento attivo' },
  { value: 'user', label: 'Una persona' },
]

const LANGUAGES = [
  ['all', 'Tutte le lingue'],
  ['it', 'Italiano'],
  ['en', 'English'],
  ['fr', 'Français'],
  ['es', 'Español'],
  ['pt', 'Português'],
  ['de', 'Deutsch'],
  ['ru', 'Русский'],
] as const

const AUDIENCE_LABEL = Object.fromEntries(AUDIENCES.map((a) => [a.value, a.label]))

type Overview = NonNullable<Awaited<ReturnType<typeof adminPushOverview>>>

export default function PushPanel() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/dashboard')
  const [audience, setAudience] = useState<PushAudience>('all')
  const [locale, setLocale] = useState('all')
  const [sending, setSending] = useState(false)
  const [person, setPerson] = useState<StaffUserHit | null>(null)
  const [personStatus, setPersonStatus] = useState<{ devices: number; staffOff: boolean } | null>(null)

  const pickPerson = async (user: StaffUserHit | null) => {
    setPerson(user)
    setPersonStatus(null)
    if (user) setPersonStatus(await adminPushUserStatus(user.id))
  }
  const personName = person ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.email || person.referral_code || '' : ''
  const personReachable = Boolean(personStatus && personStatus.devices > 0 && !personStatus.staffOff)

  const load = useCallback(async () => {
    setLoading(true)
    setData(await adminPushOverview())
    setLoading(false)
  }, [])

  useEffect(() => {
    adminPushOverview().then((overview) => {
      setData(overview)
      setLoading(false)
    })
  }, [])

  const send = async () => {
    if (!title.trim() || !body.trim()) return
    if (audience === 'user' && !person) return
    const langLabel = LANGUAGES.find(([code]) => code === locale)?.[1]
    const target = audience === 'user' ? personName : `${AUDIENCE_LABEL[audience]} · ${langLabel}`
    if (!(await askConfirm(`Inviare la notifica a: ${target}?`))) return
    setSending(true)
    const r = await adminSendPushCampaign({ title, body, url, audience, locale, userId: person?.id })
    setSending(false)
    if (!r.success) {
      notify(r.error ?? 'Invio non riuscito.')
      return
    }
    notify(audience === 'user' ? `Inviata a ${personName} (${r.sent} dispositivi${r.failed ? `, ${r.failed} non raggiunti` : ''}).` : `Inviata a ${r.recipients} persone (${r.sent} dispositivi${r.failed ? `, ${r.failed} non raggiunti` : ''}).`, 'success')
    setTitle('')
    setBody('')
    load()
  }

  if (loading && !data) return <div className="flex justify-center py-12"><LoaderCircle className="h-6 w-6 animate-spin text-gray-400" /></div>
  if (!data) return <p className="text-sm text-red-600">Non autorizzato.</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><BellRing className="h-6 w-6" /> Notifiche push</h2>
          <p className="mt-1 text-sm text-gray-500">Messaggi che compaiono sul telefono o sul computer anche con KUMANI chiusa. Arrivano solo a chi le ha attivate dal proprio profilo.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Aggiorna
        </button>
      </div>

      {!data.configured && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Notifiche non configurate: mancano le chiavi <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> e <code>VAPID_PRIVATE_KEY</code> (vanno anche su Vercel).
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Persone con notifiche attive</p>
          <p className="text-2xl font-bold text-gray-900">{data.people}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Dispositivi</p>
          <p className="flex items-center gap-1.5 text-2xl font-bold text-gray-900"><Smartphone className="h-5 w-5 text-gray-400" /> {data.devices}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Per lingua</p>
          <p className="mt-1 text-sm text-gray-800">
            {Object.entries(data.byLocale).length ? Object.entries(data.byLocale).map(([l, n]) => `${l.toUpperCase()} ${n}`).join(' · ') : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="font-semibold text-gray-900">Nuovo avviso</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">A chi</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value as PushAudience)} className="w-full rounded-lg border border-gray-300 p-2 text-sm">
              {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          {audience !== 'user' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Lingua del dispositivo</label>
              <select value={locale} onChange={(e) => setLocale(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-sm">
                {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </div>
          )}
        </div>
        {audience === 'user' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Persona</label>
            <AdminUserPicker scope="matrix" selected={person} onSelect={pickPerson} />
            {person && personStatus && (
              <p className={`mt-1 text-xs ${personReachable ? 'text-emerald-700' : 'text-amber-700'}`}>
                {personStatus.devices === 0
                  ? 'Non ha attivato le notifiche su nessun dispositivo: non riceverà nulla.'
                  : personStatus.staffOff
                    ? 'Ha disattivato gli avvisi di KUMANI: non riceverà nulla.'
                    : `Notifiche attive su ${personStatus.devices} ${personStatus.devices === 1 ? 'dispositivo' : 'dispositivi'}.`}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-gray-500">Il testo parte così come lo scrivi: per un avviso in più lingue, invialo una volta per ogni lingua.</p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Titolo <span className="text-gray-400">({title.length}/80)</span></label>
          <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-sm" placeholder="Es. Nuovo servizio disponibile" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Testo <span className="text-gray-400">({body.length}/240)</span></label>
          <textarea value={body} maxLength={240} rows={3} onChange={(e) => setBody(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Pagina che si apre toccando la notifica</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 font-mono text-sm" placeholder="/dashboard" />
          <p className="mt-1 text-xs text-gray-500">Solo pagine di KUMANI, es. /dashboard, /documenti, /events. La lingua si aggiunge da sola.</p>
        </div>
        {(title || body) && (
          <div className="rounded-xl bg-gray-900 p-3 text-white">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Anteprima</p>
            <p className="mt-1 text-sm font-semibold">{title || 'Titolo'}</p>
            <p className="text-sm text-gray-200">{body || 'Testo'}</p>
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={send} disabled={sending || !title.trim() || !body.trim() || !data.configured || (audience === 'user' && !personReachable)} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Invia notifica
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 font-semibold text-gray-900">Avvisi inviati</h3>
        {data.campaigns.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun avviso inviato.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.campaigns.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString('it-IT')}</p>
                </div>
                <p className="text-sm text-gray-700">{c.body}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {c.audience === 'user' ? `A: ${c.target_name ?? 'persona'}` : `${AUDIENCE_LABEL[c.audience]} · ${c.locale ? c.locale.toUpperCase() : 'tutte le lingue'} · ${c.recipients} persone`} · {c.sent} dispositivi raggiunti{c.failed ? ` · ${c.failed} non raggiunti` : ''} · {c.url}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
