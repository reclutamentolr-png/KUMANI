'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Gift, Globe, KeyRound, LayoutGrid, LoaderCircle, Search, ShieldAlert, Ticket, User, X } from 'lucide-react'
import { adminGlobalSearch, type AdminSearchResults } from '@/app/actions/adminSearch'
import type { AdminUserRow } from '@/lib/adminTypes'

// Ricerca generale dell'Admin: sezioni e impostazioni (anche per parola
// chiave, es. «prezzo sorpresa» → Impostazioni), utenti, sorprese, codici
// regalo e di prova, indirizzi IP. Ctrl+K (o /) per andarci subito.

// Parole che portano alla sezione giusta anche se non sono nel nome
const KEYWORDS: Record<string, string> = {
  settings: 'impostazioni prezzi prezzo sorpresa sorprese commissione shop preventivi abbonamenti base pro prova ku points qualifiche voucher valore menu traduzioni veritas mosaic fabula affinity scudo checkmail verifoto manutenzione banner cookie consenso statistiche marketing',
  appLimits: 'limiti pulizia soglie file spazio storage utilizzo top 10 sicurezza soglie',
  security: 'sicurezza intrusi hacker ip bloccati avvisi accessi falliti sospensione',
  financials: 'amministrazione incassi fatturato stripe tasse iva entrate',
  costs: 'costi margini spese',
  overview: 'panoramica riepilogo',
  platforms: 'piattaforme collegate vercel supabase stripe resend cloudflare',
  homeLayout: 'homepage tema aspetto home',
  languages: 'lingue traduzioni',
  push: 'notifiche push',
  emailSetup: 'email posta dominio',
  coupons: 'regali codici regalo codici prova coupon pass',
  users: 'utenti persone account iscritti',
  identity: 'documenti identità verifica',
  donations: 'donazioni associazione',
  kuManagement: 'ku karma punti gestione',
}

type Section = { id: string; label: string }

export default function AdminGlobalSearch({
  sections,
  onSection,
  onUser,
  onCoupons,
}: {
  sections: Section[]
  onSection: (id: string) => void
  onUser: (user: AdminUserRow) => void
  onCoupons: (area: 'gifts' | 'trials') => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<AdminSearchResults | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const request = useRef(0)

  // Ctrl+K o «/» per cercare; Esc per chiudere
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        input.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const click = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', key)
    window.addEventListener('mousedown', click)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('mousedown', click)
    }
  }, [])

  // Ricerca sul server, 300 ms dopo l'ultima lettera
  useEffect(() => {
    const term = q.trim()
    const id = ++request.current
    if (term.length < 2) return
    const timer = setTimeout(async () => {
      setLoading(true)
      const r = await adminGlobalSearch(term)
      if (id === request.current) {
        setResults(r)
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const sectionHits = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return []
    return sections
      .filter((s) => {
        const hay = `${s.label} ${KEYWORDS[s.id] ?? ''}`.toLowerCase()
        return words.every((w) => hay.includes(w))
      })
      .slice(0, 6)
  }, [q, sections])

  const close = () => {
    setOpen(false)
    setQ('')
    setResults(null)
  }
  const term = q.trim()
  const r = term.length >= 2 ? results : null
  const nothing =
    term.length >= 2 &&
    !loading &&
    !sectionHits.length &&
    !r?.users.length &&
    !r?.surprises.length &&
    !r?.giftCodes.length &&
    !r?.trialCodes.length &&
    !r?.ip
  const name = (u: AdminUserRow) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id.slice(0, 8)
  const row = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--gold-pale)]'
  const head = 'px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-500'

  return (
    <div ref={box} className="relative mb-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Cerca nell'Admin: sezioni, impostazioni, utenti, sorprese, codici, IP…"
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-24 text-[15px] shadow-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
          aria-label="Cerca nell'Admin"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-400 sm:block">Ctrl K</span>
        {q && (
          <button type="button" onClick={close} aria-label="Cancella" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 sm:right-20">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && term.length >= 2 && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-2xl">
          {loading && (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Cerco…
            </p>
          )}
          {sectionHits.length > 0 && (
            <>
              <p className={head}>Sezioni e impostazioni</p>
              {sectionHits.map((s) => (
                <button key={s.id} type="button" className={row} onClick={() => (onSection(s.id), close())}>
                  <LayoutGrid className="h-4 w-4 text-[var(--gold)]" /> {s.label}
                </button>
              ))}
            </>
          )}
          {!!r?.users.length && (
            <>
              <p className={head}>Utenti</p>
              {r.users.map((u) => (
                <button key={u.id} type="button" className={row} onClick={() => (onUser(u), close())}>
                  <User className="h-4 w-4 text-sky-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{name(u)}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {[u.email, u.referral_code, u.subscription_status, u.is_blocked ? 'BLOCCATO' : ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
          {!!r?.surprises.length && (
            <>
              <p className={head}>Sorprese (si apre chi l&apos;ha creata)</p>
              {r.surprises.map((g) => (
                <button key={g.id} type="button" className={row} disabled={!g.owner} onClick={() => g.owner && (onUser(g.owner), close())}>
                  <Gift className="h-4 w-4 text-rose-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{g.title}</span>
                    <span className="block truncate text-xs text-gray-500">
                      per {g.recipient || '—'} · {g.status}
                      {g.owner ? ` · creata da ${name(g.owner)}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
          {!!r?.giftCodes.length && (
            <>
              <p className={head}>Codici regalo</p>
              {r.giftCodes.map((c) => (
                <button key={c.code} type="button" className={row} onClick={() => (onCoupons('gifts'), close())}>
                  <Ticket className="h-4 w-4 text-emerald-600" /> <span className="font-mono">{c.code}</span> <span className="text-xs text-gray-500">{c.status}</span>
                </button>
              ))}
            </>
          )}
          {!!r?.trialCodes.length && (
            <>
              <p className={head}>Codici prova</p>
              {r.trialCodes.map((c) => (
                <button key={c.code} type="button" className={row} onClick={() => (onCoupons('trials'), close())}>
                  <KeyRound className="h-4 w-4 text-violet-600" /> <span className="font-mono">{c.code}</span>
                  <span className="text-xs text-gray-500">
                    {c.tool} · {c.status}
                  </span>
                </button>
              ))}
            </>
          )}
          {r?.ip && (
            <>
              <p className={head}>Indirizzo IP</p>
              <button type="button" className={row} onClick={() => (onSection('security'), close())}>
                {r.ip.blocked ? <ShieldAlert className="h-4 w-4 text-red-600" /> : <Globe className="h-4 w-4 text-gray-500" />}
                <span className="font-mono">{r.ip.ip}</span>
                <span className="text-xs text-gray-500">
                  {r.ip.events} eventi · {r.ip.alerts} avvisi{r.ip.blocked ? ' · BLOCCATO' : ''}
                </span>
              </button>
            </>
          )}
          {nothing && <p className="px-3 py-3 text-sm text-gray-500">Nessun risultato per «{term}».</p>}
        </div>
      )}
    </div>
  )
}
