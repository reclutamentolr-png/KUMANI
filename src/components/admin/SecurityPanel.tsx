'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ban, CheckCircle2, EyeOff, History, LoaderCircle, RefreshCw, RotateCcw, ShieldAlert, UserX } from 'lucide-react'
import { notify } from '@/lib/adminNotify'
import { askConfirm } from '@/lib/confirm'
import {
  adminBlockIp,
  adminRunSecurityScan,
  adminSecurityAlerts,
  adminSecurityEvents,
  adminSetAlertStatus,
  adminSuspendUser,
  adminUnblockIp,
  type BlockedIpRow,
  type SecurityAlertRow,
  type SecurityEventRow,
} from '@/app/actions/adminSecurity'

// Admin → Sicurezza: avvisi su intrusi e uso scorretto (aperti dal sito in
// tempo reale e dal controllo di ogni ora), registro degli eventi degli
// ultimi 30 giorni e indirizzi IP bloccati. Soglie in Limiti e pulizia.

type Tab = 'open' | 'closed' | 'events' | 'blocked'

const SEVERITY: Record<SecurityAlertRow['severity'], { label: string; cls: string }> = {
  high: { label: 'Grave', cls: 'bg-red-100 text-red-800 border-red-200' },
  medium: { label: 'Medio', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  low: { label: 'Basso', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
}

const EVENT_LABEL: Record<string, string> = {
  probe: 'Scansione da hacker',
  not_found: 'Pagina inesistente',
  login_failed: 'Accesso fallito',
  password_check_failed: 'Password attuale sbagliata',
  admin_denied: 'Admin aperto senza permesso',
  admin_action_denied: 'Funzione Admin senza permesso',
  limit_hit: 'Limite superato',
  ai_limit: 'AI al limite del giorno',
  trial_start: 'Prova gratuita avviata',
  login: 'Accesso riuscito',
}

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: '24 ore', hours: 24 },
  { label: '7 giorni', hours: 24 * 7 },
  { label: '30 giorni', hours: 24 * 30 },
  { label: 'Sempre', hours: null },
]

const when = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Dettagli leggibili: elenchi di account come numero, il resto come testo
function DetailLine({ detail }: { detail: Record<string, unknown> }) {
  const NAMES: Record<string, string> = {
    last_path: 'ultimo indirizzo',
    events_hour: 'in un’ora',
    events_15min: 'in 15 minuti',
    events_day: 'in 24 ore',
    email: 'email',
    last_email: 'ultima email',
    last_ip: 'ultimo IP',
    ips: 'IP',
    users: 'account',
    invitees: 'invitati',
    sponsor_id: 'sponsor',
    table: 'tabella',
    count: 'elementi',
    reporters: 'segnalatori',
    awards: 'accrediti',
    points: 'punti',
    last_limit: 'limite',
    last_tool: 'servizio',
    days: 'giorni',
    permission: 'permesso',
  }
  const parts = Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const value = Array.isArray(v) ? (k === 'ips' ? v.join(', ') : `${v.length}`) : String(v)
      return `${NAMES[k] ?? k}: ${value}`
    })
  if (!parts.length) return null
  return <p className="mt-1 break-words text-xs text-gray-500">{parts.join(' · ')}</p>
}

function BlockIpButton({ ip, onDone }: { ip: string; onDone: () => void }) {
  const [hours, setHours] = useState<string>('168')
  const [busy, setBusy] = useState(false)
  const block = async () => {
    if (!(await askConfirm(`Bloccare l'indirizzo ${ip}? Da lì non si potrà aprire KUMANI.`))) return
    setBusy(true)
    const result = await adminBlockIp(ip, hours === 'null' ? null : Number(hours), 'Da avviso di sicurezza')
    setBusy(false)
    if (!result.success) return notify('Errore: ' + result.error)
    notify(`IP ${ip} bloccato`)
    onDone()
  }
  return (
    <span className="inline-flex items-center gap-1">
      <select value={hours} onChange={(e) => setHours(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs" aria-label="Durata del blocco">
        {DURATIONS.map((d) => (
          <option key={d.label} value={String(d.hours)}>
            {d.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={block} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
        <Ban className="h-3.5 w-3.5" /> Blocca IP
      </button>
    </span>
  )
}

export default function SecurityPanel() {
  const [tab, setTab] = useState<Tab>('open')
  const [alerts, setAlerts] = useState<SecurityAlertRow[]>([])
  const [blocked, setBlocked] = useState<BlockedIpRow[]>([])
  const [events, setEvents] = useState<SecurityEventRow[]>([])
  const [filter, setFilter] = useState<{ kind: string; ip: string; userId: string; userLabel: string }>({ kind: '', ip: '', userId: '', userLabel: '' })
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [newIp, setNewIp] = useState({ ip: '', hours: '168', reason: '' })

  const load = useCallback(async () => {
    setLoading(true)
    if (tab === 'events') {
      const result = await adminSecurityEvents({ kind: filter.kind || undefined, ip: filter.ip || undefined, userId: filter.userId || undefined })
      if (result.error) notify('Errore: ' + result.error)
      setEvents(result.items)
    } else {
      const result = await adminSecurityAlerts(tab === 'closed' ? 'closed' : 'open')
      if (result.error) notify('Errore: ' + result.error)
      setAlerts(result.items)
      setBlocked(result.blocked)
    }
    setLoading(false)
  }, [tab, filter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dal server al cambio di scheda o filtro
    load()
  }, [load])

  const setStatus = async (id: string, status: 'open' | 'resolved' | 'ignored') => {
    const result = await adminSetAlertStatus(id, status)
    if (!result.success) return notify('Errore: ' + result.error)
    notify(status === 'resolved' ? 'Segnato come risolto' : status === 'ignored' ? 'Ignorato per 7 giorni' : 'Riaperto')
    load()
  }

  const suspend = async (alert: SecurityAlertRow) => {
    if (!alert.user) return
    const who = alert.user.name || alert.user.email || 'questa persona'
    if (!(await askConfirm(`Sospendere l'account di ${who}? Non potrà più accedere; si riattiva da Admin → Utenti.`))) return
    const result = await adminSuspendUser(alert.user.id)
    if (!result.success) return notify('Errore: ' + result.error)
    notify('Account sospeso')
    load()
  }

  const unblock = async (ip: string) => {
    const result = await adminUnblockIp(ip)
    if (!result.success) return notify('Errore: ' + result.error)
    notify(`IP ${ip} sbloccato`)
    load()
  }

  const addBlock = async () => {
    const result = await adminBlockIp(newIp.ip, newIp.hours === 'null' ? null : Number(newIp.hours), newIp.reason)
    if (!result.success) return notify('Errore: ' + result.error)
    notify(`IP ${newIp.ip} bloccato`)
    setNewIp({ ip: '', hours: '168', reason: '' })
    load()
  }

  const scan = async () => {
    setScanning(true)
    const result = await adminRunSecurityScan()
    setScanning(false)
    if (!result.success) return notify('Errore: ' + result.error)
    notify(result.created ? `Controllo fatto: ${result.created} nuovi avvisi` : 'Controllo fatto: nessun nuovo avviso')
    load()
  }

  const showEvents = (f: Partial<typeof filter>) => {
    setFilter({ kind: '', ip: '', userId: '', userLabel: '', ...f })
    setTab('events')
  }

  const counts = { high: 0, medium: 0, low: 0 }
  if (tab === 'open') for (const a of alerts) counts[a.severity]++

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ShieldAlert className="h-6 w-6 text-[var(--gold)]" /> Sicurezza
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Intrusi (scansioni in cerca di falle, accessi falliti, Admin aperto senza permesso) e uso scorretto (creazioni in massa, account multipli sugli
            inviti, account condivisi, segnalazioni, punti). Gli avvisi gravi e medi arrivano anche come notifica. Il registro si cancella dopo 30 giorni;
            le soglie sono in <strong>Limiti e pulizia → Sicurezza</strong>.
          </p>
        </div>
        <button type="button" onClick={scan} disabled={scanning} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:border-[var(--gold)] disabled:opacity-50">
          {scanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Controlla ora
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['open', 'Avvisi aperti'],
            ['closed', 'Archivio'],
            ['events', 'Registro eventi'],
            ['blocked', 'IP bloccati'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]'}`}
          >
            {label}
            {key === 'blocked' && blocked.length > 0 ? ` (${blocked.length})` : ''}
          </button>
        ))}
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Caricamento…
        </p>
      )}

      {!loading && tab === 'open' && (
        <p className="text-sm text-gray-600">
          Gravi: <strong className="text-red-700">{counts.high}</strong> · Medi: <strong className="text-amber-700">{counts.medium}</strong> · Bassi:{' '}
          <strong>{counts.low}</strong>
        </p>
      )}

      {!loading && (tab === 'open' || tab === 'closed') && (
        <div className="space-y-3">
          {alerts.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
              {tab === 'open' ? 'Nessun avviso aperto: tutto tranquillo.' : 'Archivio vuoto.'}
            </p>
          )}
          {alerts.map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${SEVERITY[a.severity].cls}`}>{SEVERITY[a.severity].label}</span>
                {a.status !== 'open' && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{a.status === 'resolved' ? 'Risolto' : 'Ignorato'}</span>
                )}
                <p className="min-w-0 flex-1 font-semibold text-gray-900">{a.title}</p>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {a.count > 1 ? `Rilevato ${a.count} volte · ` : ''}prima {when(a.first_seen)} · ultima {when(a.last_seen)}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {a.user && (
                  <span>
                    Persona: <strong>{a.user.name || '—'}</strong> {a.user.email && <span className="text-gray-500">({a.user.email})</span>}
                    {a.user.is_blocked && <span className="ml-1 rounded bg-red-100 px-1.5 text-xs font-semibold text-red-700">sospeso</span>}
                  </span>
                )}
                {a.ip && (
                  <span>
                    IP: <strong className="font-mono">{a.ip}</strong>
                    {a.ipBlocked && <span className="ml-1 rounded bg-red-100 px-1.5 text-xs font-semibold text-red-700">bloccato</span>}
                  </span>
                )}
              </div>
              <DetailLine detail={a.detail} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {a.status === 'open' ? (
                  <>
                    <button type="button" onClick={() => setStatus(a.id, 'resolved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Risolto
                    </button>
                    <button type="button" onClick={() => setStatus(a.id, 'ignored')} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                      <EyeOff className="h-3.5 w-3.5" /> Ignora 7 giorni
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setStatus(a.id, 'open')} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    <RotateCcw className="h-3.5 w-3.5" /> Riapri
                  </button>
                )}
                {(a.user || a.ip) && (
                  <button
                    type="button"
                    onClick={() => showEvents(a.user ? { userId: a.user.id, userLabel: a.user.name || a.user.email || '' } : { ip: a.ip ?? '' })}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <History className="h-3.5 w-3.5" /> Vedi registro
                  </button>
                )}
                {a.user && !a.user.is_blocked && (
                  <button type="button" onClick={() => suspend(a)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                    <UserX className="h-3.5 w-3.5" /> Sospendi account
                  </button>
                )}
                {a.ip && !a.ipBlocked && <BlockIpButton ip={a.ip} onDone={load} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filter.kind}
              onChange={(e) => setFilter((f) => ({ ...f, kind: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              aria-label="Tipo di evento"
            >
              <option value="">Tutti i tipi</option>
              {Object.entries(EVENT_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <input
              defaultValue={filter.ip}
              onKeyDown={(e) => e.key === 'Enter' && setFilter((f) => ({ ...f, ip: (e.target as HTMLInputElement).value }))}
              onBlur={(e) => e.target.value !== filter.ip && setFilter((f) => ({ ...f, ip: e.target.value }))}
              placeholder="Filtra per IP"
              className="w-44 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            />
            {filter.userId && (
              <button type="button" onClick={() => setFilter((f) => ({ ...f, userId: '', userLabel: '' }))} className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white">
                Persona: {filter.userLabel || filter.userId.slice(0, 8)} ✕
              </button>
            )}
          </div>
          {!loading && events.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">Nessun evento.</p>}
          {!loading && events.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Quando</th>
                    <th className="px-3 py-2">Evento</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">Persona</th>
                    <th className="px-3 py-2">Dettagli</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{when(e.created_at)}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900">{EVENT_LABEL[e.kind] ?? e.kind}</td>
                      <td className="px-3 py-2">
                        {e.ip ? (
                          <button type="button" onClick={() => setFilter((f) => ({ ...f, ip: e.ip ?? '' }))} className="font-mono text-xs text-sky-700 hover:underline">
                            {e.ip}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{e.user ? e.user.name || e.user.email : '—'}</td>
                      <td className="max-w-md px-3 py-2 text-xs text-gray-500">
                        {e.path && <span className="block break-all font-mono">{e.path}</span>}
                        {Object.keys(e.detail).length > 0 && <span className="block break-words">{Object.entries(e.detail).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</span>}
                        {e.user_agent && <span className="block truncate text-gray-400" title={e.user_agent}>{e.user_agent}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'blocked' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-gray-700">Indirizzo IP</span>
              <input value={newIp.ip} onChange={(e) => setNewIp((n) => ({ ...n, ip: e.target.value }))} className="w-48 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-gray-700">Durata</span>
              <select value={newIp.hours} onChange={(e) => setNewIp((n) => ({ ...n, hours: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {DURATIONS.map((d) => (
                  <option key={d.label} value={String(d.hours)}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-48 flex-1 text-sm">
              <span className="mb-1 block font-semibold text-gray-700">Motivo</span>
              <input value={newIp.reason} onChange={(e) => setNewIp((n) => ({ ...n, reason: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <button type="button" onClick={addBlock} disabled={!newIp.ip.trim()} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              <Ban className="h-4 w-4" /> Blocca
            </button>
          </div>
          <p className="text-xs text-gray-500">Un IP bloccato vede solo «Accesso bloccato» su tutte le pagine. Attenzione: più persone (stessa casa, ufficio, rete mobile) possono avere lo stesso IP.</p>
          {blocked.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">Nessun IP bloccato.</p>
          ) : (
            <ul className="space-y-2">
              {blocked.map((b) => (
                <li key={b.ip} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                  <span className="font-mono font-semibold">{b.ip}</span>
                  <span className="text-gray-500">{b.expires_at ? `fino al ${when(b.expires_at)}` : 'per sempre'}</span>
                  {b.reason && <span className="text-gray-500">· {b.reason}</span>}
                  <button type="button" onClick={() => unblock(b.ip)} className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
                    Sblocca
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
