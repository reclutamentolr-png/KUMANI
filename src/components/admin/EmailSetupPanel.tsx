'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, CircleDashed, Copy, ExternalLink, KeyRound, LoaderCircle, RefreshCw, Send, XCircle } from 'lucide-react'
import {
  adminAddEmailDestination,
  adminConnectMailboxes,
  adminCreateGmailSmtpKey,
  adminEmailState,
  adminEnableEmailRouting,
  adminSendMailboxTest,
  adminSetCatchAll,
  type EmailAdminState,
} from '@/app/actions/adminEmail'
import { notify } from '@/lib/adminNotify'

// Admin → Gestione Email: configurazione guidata di support@, privacy@ e
// info@kumani.io. Ricezione con Cloudflare Email Routing verso la Gmail di
// KUMANI, risposta dalla Gmail con l'SMTP di Resend.

const SMTP = [
  { label: 'Server SMTP', value: 'smtp.resend.com' },
  { label: 'Porta', value: '465' },
  { label: 'Nome utente', value: 'resend' },
  { label: 'Connessione', value: 'SSL' },
]

function Done({ ok, children }: { ok: boolean | null; children: ReactNode }) {
  const Icon = ok === null ? CircleDashed : ok ? CheckCircle2 : XCircle
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${ok === null ? 'text-gray-500' : ok ? 'text-emerald-700' : 'text-amber-700'}`}>
      <Icon className="h-4 w-4" /> {children}
    </span>
  )
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean | null; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${done ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-white'}`}>{n}</span>
          {title}
        </h3>
        <Done ok={done}>{done ? 'Fatto' : done === null ? 'Non disponibile' : 'Da fare'}</Done>
      </div>
      <div className="mt-4 space-y-3 text-sm text-gray-700">{children}</div>
    </section>
  )
}

const copy = (value: string) => {
  navigator.clipboard?.writeText(value).then(
    () => notify('Copiato', 'success'),
    () => notify('Copia non riuscita'),
  )
}

export default function EmailSetupPanel() {
  const [state, setState] = useState<EmailAdminState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [newDestination, setNewDestination] = useState('')
  const [destination, setDestination] = useState('')
  const [smtpToken, setSmtpToken] = useState<string | null>(null)

  const apply = useCallback((result: Awaited<ReturnType<typeof adminEmailState>>) => {
    setLoading(false)
    if (!result.success || !result.state) {
      setError(result.error ?? 'Errore sconosciuto')
      return
    }
    setError(null)
    setState(result.state)
    const verified = result.state.destinations?.filter((d) => d.verified) ?? []
    const current = result.state.mailboxes.find((m) => m.forwardTo[0])?.forwardTo[0]
    setDestination((prev) => prev || current || verified[0]?.email || '')
  }, [])

  const reload = () => {
    setLoading(true)
    adminEmailState().then(apply)
  }

  useEffect(() => {
    adminEmailState().then(apply)
  }, [apply])

  const run = async (key: string, action: () => Promise<{ success: boolean; error?: string; message?: string }>) => {
    setBusy(key)
    const result = await action()
    setBusy(null)
    if (!result.success) {
      notify('Errore: ' + (result.error ?? ''))
      return
    }
    if (result.message) notify(result.message, 'success')
    reload()
  }

  const spinner = (key: string) => (busy === key ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null)
  const btn = 'inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50'
  const btnLight = 'inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50'

  const cfReady = Boolean(state && !state.missing.includes('CLOUDFLARE_API_TOKEN') && !state.error)
  const verified = state?.destinations?.filter((d) => d.verified) ?? []
  const routingOk = state?.routing ? state.routing.enabled && (state.dnsIssues?.length ?? 0) === 0 : null
  const mailboxesOk = state ? state.mailboxes.every((m) => m.enabled && m.forwardTo.length > 0) : false

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestione Email</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Gli indirizzi <b>support@</b>, <b>privacy@</b> e <b>info@kumani.io</b> non sono caselle vere: Cloudflare inoltra ciò che arriva alla Gmail di KUMANI, e dalla Gmail si risponde con lo stesso indirizzo tramite Resend. Segui i passaggi in ordine.
          </p>
        </div>
        <button type="button" onClick={reload} disabled={loading} className={btn}>
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Aggiorna
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Errore: {error}</div>}
      {!state && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Lettura della configurazione…
        </div>
      )}

      {state && (
        <>
          {(state.missing.length > 0 || state.error) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {state.error && <p className="font-semibold">{state.error}</p>}
              {state.missing.length > 0 && (
                <>
                  <p className="font-semibold">Variabili da aggiungere in Vercel e in .env.local:</p>
                  <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                    {state.missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-2 text-xs">
                Token Cloudflare (My Profile → API Tokens → Create Custom Token), permessi: <b>Zone · Zone · Read</b>, <b>Zone · Zone Settings · Edit</b>, <b>Zone · DNS · Edit</b>,{' '}
                <b>Zone · Email Routing Rules · Edit</b>, <b>Account · Email Routing Addresses · Edit</b>; risorse: la zona {state.zone ?? 'kumani.io'} e il tuo account.
              </p>
            </div>
          )}

          <Step n={1} title="Attiva la ricezione su Cloudflare" done={cfReady ? routingOk : null}>
            {state.routing?.error ? (
              <p className="text-amber-700">{state.routing.error}</p>
            ) : state.routing ? (
              <p>
                Email Routing: <b>{state.routing.enabled ? 'attivo' : 'non attivo'}</b> · stato {state.routing.status}
              </p>
            ) : null}
            {(state.dnsIssues?.length ?? 0) > 0 && (
              <ul className="list-disc pl-5 text-xs text-amber-700">
                {state.dnsIssues!.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            {cfReady && !routingOk && (
              <button type="button" className={btn} disabled={busy !== null} onClick={() => run('enable', adminEnableEmailRouting)}>
                {spinner('enable')} Attiva Email Routing
              </button>
            )}
            <p className="text-xs text-gray-500">Cloudflare aggiunge i record MX e SPF di kumani.io. Non toccano Resend, che usa il sottodominio send.kumani.io.</p>
          </Step>

          <Step n={2} title="Collega la Gmail di KUMANI" done={cfReady ? verified.length > 0 : null}>
            {state.destinationsError && <p className="text-amber-700">{state.destinationsError}</p>}
            {(state.destinations ?? []).length > 0 && (
              <ul className="space-y-1">
                {state.destinations!.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{d.email}</span>
                    <Done ok={d.verified}>{d.verified ? 'Confermata' : 'In attesa: apri il link nell’email di Cloudflare'}</Done>
                  </li>
                ))}
              </ul>
            )}
            {cfReady && (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  run('dest', () => adminAddEmailDestination(newDestination)).then(() => setNewDestination(''))
                }}
              >
                <input
                  type="email"
                  required
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value)}
                  placeholder="es. kumani.supporto@gmail.com"
                  className="min-w-[260px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <button type="submit" className={btn} disabled={busy !== null}>
                  {spinner('dest')} Aggiungi casella
                </button>
              </form>
            )}
            <p className="text-xs text-gray-500">Cloudflare invia un’email di conferma alla Gmail: finché non apri il link, l’inoltro non parte.</p>
          </Step>

          <Step n={3} title="Collega i 3 indirizzi alla Gmail" done={cfReady ? mailboxesOk : null}>
            {state.rulesError && <p className="text-amber-700">{state.rulesError}</p>}
            <div className="overflow-hidden rounded-lg border border-gray-200">
              {state.mailboxes.map((m) => (
                <div key={m.address} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 last:border-0">
                  <div>
                    <p className="font-mono font-semibold text-gray-900">{m.address}</p>
                    <p className="text-xs text-gray-500">{m.label}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Done ok={m.enabled && m.forwardTo.length > 0}>{m.forwardTo.length ? `→ ${m.forwardTo.join(', ')}${m.enabled ? '' : ' (spento)'}` : 'Non collegato'}</Done>
                    {m.forwardTo.length > 0 && m.enabled && (
                      <button type="button" className={btnLight} disabled={busy !== null || state.missing.includes('RESEND_API_KEY')} onClick={() => run(`test-${m.address}`, () => adminSendMailboxTest(m.address))}>
                        {spinner(`test-${m.address}`) ?? <Send className="h-3.5 w-3.5" />} Prova
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {cfReady && (
              <div className="flex flex-wrap items-center gap-2">
                <select value={destination} onChange={(e) => setDestination(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" disabled={verified.length === 0}>
                  {verified.length === 0 && <option value="">Prima conferma una Gmail (passo 2)</option>}
                  {verified.map((d) => (
                    <option key={d.id} value={d.email}>
                      {d.email}
                    </option>
                  ))}
                </select>
                <button type="button" className={btn} disabled={busy !== null || !destination} onClick={() => run('connect', () => adminConnectMailboxes(destination))}>
                  {spinner('connect')} {mailboxesOk ? 'Aggiorna inoltro' : 'Collega i 3 indirizzi'}
                </button>
              </div>
            )}
            {state.catchAll && cfReady && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.catchAll.enabled}
                  disabled={busy !== null || !destination}
                  onChange={(e) => run('catchall', () => adminSetCatchAll(e.target.checked, destination))}
                />
                Ricevi anche gli altri indirizzi @kumani.io (es. chi scrive “supporto@” per errore)
                {state.catchAll.enabled && <span className="text-xs text-gray-500">→ {state.catchAll.forwardTo.join(', ')}</span>}
              </label>
            )}
            <p className="text-xs text-gray-500">“Prova” invia un’email all’indirizzo: se arriva nella Gmail, l’inoltro funziona.</p>
          </Step>

          <Step n={4} title="Rispondi dalla Gmail come support@kumani.io" done={null}>
            <p>
              Dominio di invio su Resend:{' '}
              {state.resend.domain ? (
                <b>
                  {state.resend.domain.name} · {state.resend.domain.status === 'verified' ? 'verificato' : state.resend.domain.status}
                </b>
              ) : state.resend.error ? (
                <span className="text-amber-700">{state.resend.error}</span>
              ) : (
                <span className="text-amber-700">non trovato</span>
              )}
            </p>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 font-semibold text-gray-900">a) Crea la password SMTP (una sola, vale per i 3 indirizzi)</p>
              {smtpToken ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="break-all rounded bg-white px-2 py-1 text-xs">{smtpToken}</code>
                    <button type="button" className={btnLight} onClick={() => copy(smtpToken)}>
                      <Copy className="h-3.5 w-3.5" /> Copia
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-amber-700">Copiala ora e usala nel passo b): chiusa questa pagina non sarà più visibile.</p>
                </div>
              ) : (
                <button
                  type="button"
                  className={btn}
                  disabled={busy !== null || !state.resend.configured}
                  onClick={async () => {
                    setBusy('smtp')
                    const result = await adminCreateGmailSmtpKey()
                    setBusy(null)
                    if (!result.success || !result.token) notify('Errore: ' + (result.error ?? ''))
                    else setSmtpToken(result.token)
                  }}
                >
                  {spinner('smtp') ?? <KeyRound className="h-4 w-4" />} Crea password SMTP
                </button>
              )}
              <p className="mt-2 text-xs text-gray-500">È una chiave Resend che può solo inviare email da kumani.io. Se un giorno va revocata, la trovi in Resend → API Keys con il nome “Gmail SMTP”.</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 font-semibold text-gray-900">b) In Gmail, per ciascuno dei 3 indirizzi</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Apri{' '}
                  <a className="font-semibold underline" href="https://mail.google.com/mail/u/0/#settings/accounts" target="_blank" rel="noopener noreferrer">
                    Gmail → Impostazioni → Account <ExternalLink className="inline h-3 w-3" />
                  </a>{' '}
                  → “Invia messaggio come” → <b>Aggiungi un altro indirizzo email</b>.
                </li>
                <li>
                  Nome: <b>KUMANI Supporto</b> (o Privacy, Info) · Indirizzo: <b>support@kumani.io</b> · togli la spunta “Considera come alias”.
                </li>
                <li>Inserisci i dati SMTP qui sotto e come password quella creata al passo a).</li>
                <li>Gmail invia un codice di verifica all’indirizzo: arriva nella stessa Gmail grazie all’inoltro. Inseriscilo.</li>
                <li>
                  Consigliato: in “Invia messaggio come” scegli <b>Rispondi dallo stesso indirizzo a cui è stato inviato il messaggio</b>.
                </li>
              </ol>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SMTP.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-2 rounded bg-white px-3 py-1.5">
                    <span className="text-xs text-gray-500">{s.label}</span>
                    <span className="flex items-center gap-2 font-mono text-sm">
                      {s.value}
                      <button type="button" onClick={() => copy(s.value)} className="text-gray-400 hover:text-gray-700" aria-label={`Copia ${s.label}`}>
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">Le email inviate dalla Gmail contano nel limite mensile di Resend (vedi Piattaforme collegate).</p>
          </Step>
        </>
      )}
    </div>
  )
}
