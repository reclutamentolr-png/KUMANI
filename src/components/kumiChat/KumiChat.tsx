'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Send, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Kumi from '@/components/kids/Kumi'
import { askKumi, kumiChatStatus, rateKumi, type KumiStatus } from '@/app/actions/kumiChat'
import type { KumiLink } from '@/lib/kumiChat/knowledge'

// Chiedi a KUMI: KUMI in basso a destra risponde a chi visita KUMANI la prima
// volta, in tutte le pagine pubbliche, finché non si iscrive ed entra. La
// conversazione resta nel browser (7 giorni), anche cambiando pagina o
// chiudendo il sito, e si cancella quando la persona entra con il suo account.
// Si vede solo se l'Admin l'ha accesa (o allo Staff in prova): decide il server.

// Pagine da iscritti: lo Staff non vede KUMI mentre lavora
const STAFF_HIDDEN = ['/admin', '/dashboard', '/app', '/wallet', '/community', '/documenti', '/messaggio', '/avvisi', '/agente', '/traduzioni']
const LOCALE_RE = /^\/(it|en|fr|es|pt|de|ru)(?=\/|$)/
const STORE_KEY = 'kumani:kumi-chat'
const STORE_DAYS = 7

type Msg =
  | { from: 'kumi'; text: string; id?: string; links?: KumiLink[]; answered?: boolean; rated?: 1 | -1 }
  | { from: 'me'; text: string }

const CHIPS = ['chip1', 'chip2', 'chip3', 'chip4', 'chip5'] as const
const HINT_KEY = 'kumani:kumi-chat:hint'

function readStore(): { msgs: Msg[]; open: boolean } | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { msgs?: Msg[]; open?: boolean; at?: number }
    if (!Array.isArray(v.msgs) || !v.at || Date.now() - v.at > STORE_DAYS * 86_400_000) return null
    return { msgs: v.msgs.slice(-40), open: !!v.open }
  } catch {
    return null
  }
}
const clearStore = () => {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // memoria del browser non disponibile
  }
}

export default function KumiChat() {
  const t = useTranslations('kumiChat')
  const locale = useLocale()
  const [status, setStatus] = useState<KumiStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const restored = useRef(false)
  const pathname = usePathname()
  const path = pathname.replace(LOCALE_RE, '') || '/'

  // Si ricontrolla a ogni cambio di pagina finché la chat è per un visitatore:
  // appena la persona entra con il suo account, KUMI sparisce
  const checkAgain = !status || (status.visible && !status.staff)
  useEffect(() => {
    if (!checkAgain) return
    let alive = true
    kumiChatStatus()
      .then((s) => {
        if (!alive) return
        if (s.member) clearStore()
        setStatus(s)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  // Conversazione ritrovata (cambio di pagina con ricarica, sito riaperto)
  useEffect(() => {
    if (!status?.visible || restored.current) return
    restored.current = true
    const saved = readStore()
    if (!saved) return
    // Dati del browser: si leggono solo dopo il primo disegno
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMsgs(saved.msgs)
    setOpen(saved.open)
  }, [status?.visible])
  useEffect(() => {
    if (!restored.current) return
    try {
      if (msgs.length) localStorage.setItem(STORE_KEY, JSON.stringify({ msgs: msgs.slice(-40), open, at: Date.now() }))
    } catch {
      // memoria del browser non disponibile
    }
  }, [msgs, open])

  // Nuvoletta «Hai una domanda?» dopo qualche secondo, una volta per visita
  useEffect(() => {
    if (!status?.visible) return
    let seen = false
    try {
      seen = sessionStorage.getItem(HINT_KEY) === '1'
    } catch {
      // memoria del browser non disponibile
    }
    if (seen) return
    const timer = window.setTimeout(() => setHint(true), 4000)
    return () => window.clearTimeout(timer)
  }, [status?.visible])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, busy])

  if (!status?.visible) return null
  // Lo Staff non vede KUMI nelle pagine in cui lavora
  if (status.staff && STAFF_HIDDEN.some((a) => path === a || path.startsWith(`${a}/`))) return null

  const dismissHint = () => {
    setHint(false)
    try {
      sessionStorage.setItem(HINT_KEY, '1')
    } catch {
      // memoria del browser non disponibile
    }
  }

  const send = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    setText('')
    setMsgs((m) => [...m, { from: 'me', text: q }])
    setBusy(true)
    // Le ultime due domande e risposte, per capire «e quanto costa?»
    const history: { q: string; a: string }[] = []
    for (let i = 0; i < msgs.length - 1; i++) {
      const a = msgs[i]
      const b = msgs[i + 1]
      if (a.from === 'me' && b.from === 'kumi') history.push({ q: a.text, a: b.text })
    }
    const res = await askKumi(q, locale, history.slice(-2)).catch(() => ({ ok: false as const, error: 'busy' as const, remaining: undefined }))
    setBusy(false)
    if (typeof res.remaining === 'number') setStatus((s) => (s ? { ...s, remaining: res.remaining! } : s))
    if (res.ok && res.answer) setMsgs((m) => [...m, { from: 'kumi', text: res.answer!, id: res.id, links: res.links, answered: res.answered }])
    else setMsgs((m) => [...m, { from: 'kumi', text: res.error === 'limit' ? t('limit') : t('busy'), answered: false }])
  }

  const rate = (index: number, rating: 1 | -1) => {
    const msg = msgs[index]
    if (msg.from !== 'kumi' || !msg.id || msg.rated) return
    setMsgs((m) => m.map((x, i) => (i === index ? { ...x, rated: rating } : x)) as Msg[])
    rateKumi(msg.id, rating).catch(() => {})
  }

  const outOfQuestions = status.remaining <= 0

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <section
          role="dialog"
          aria-label={t('title')}
          className="flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-[var(--gold)]/40 bg-[var(--paper)] shadow-2xl"
        >
          <header className="flex items-center gap-3 bg-[var(--ink)] px-4 py-3 text-white">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">
              <Kumi className="h-10 w-10" mood="happy" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--gold-bright)]">{t('title')}</p>
              <p className="truncate text-xs text-white/70">{t('subtitle')}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="rounded-full p-2 text-white/80 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </header>
          {status.staffPreview && <p className="bg-amber-100 px-4 py-1.5 text-center text-[11px] font-semibold text-amber-900">{t('staffPreview')}</p>}

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[var(--ink)] shadow-sm">{t('welcome')}</div>
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={outOfQuestions}
                    onClick={() => send(t(c))}
                    className="rounded-full border border-[var(--gold)]/50 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-50"
                  >
                    {t(c)}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) =>
              m.from === 'me' ? (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--ink)] px-3.5 py-2.5 text-sm text-white">
                  {m.text}
                </div>
              ) : (
                <div key={i} className="max-w-[88%] space-y-2">
                  <div className="whitespace-pre-line rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[var(--ink)] shadow-sm">{m.text}</div>
                  {(m.links?.length || m.answered === false) && (
                    <div className="flex flex-wrap gap-2">
                      {m.links?.map((l) => (
                        <Link key={l.href} href={l.href} className="rounded-full bg-[var(--gold-pale)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] hover:bg-[var(--gold)]/30">
                          {l.label}
                        </Link>
                      ))}
                      {m.answered === false && !m.links?.some((l) => l.href === '/contact') && (
                        <Link href="/contact?topic=other#scrivici" className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-bold text-[var(--gold-bright)]">
                          {t('linkContact')}
                        </Link>
                      )}
                    </div>
                  )}
                  {m.id && (
                    <div className="flex items-center gap-1 text-[var(--muted)]">
                      {m.rated ? (
                        <span className="text-xs">{t('thanks')}</span>
                      ) : (
                        <>
                          <button type="button" onClick={() => rate(i, 1)} aria-label={t('rateUp')} className="rounded-full p-1.5 hover:bg-[var(--gold-pale)]">
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => rate(i, -1)} aria-label={t('rateDown')} className="rounded-full p-1.5 hover:bg-[var(--gold-pale)]">
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
            {busy && <div className="w-fit rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm italic text-[var(--muted)] shadow-sm">{t('thinking')}</div>}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(text)
            }}
            className="border-t border-[var(--gold)]/25 bg-white px-3 pb-2 pt-3"
          >
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 300))}
                placeholder={outOfQuestions ? t('limitShort') : t('placeholder')}
                disabled={outOfQuestions}
                aria-label={t('placeholder')}
                className="min-h-11 min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 text-base focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={busy || !text.trim() || outOfQuestions}
                aria-label={t('send')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10.5px] text-[var(--muted)]">
              {t('remaining', { n: status.remaining })} · {t('privacyNote')}
            </p>
          </form>
        </section>
      )}

      {!open && hint && (
        <button
          type="button"
          onClick={() => {
            dismissHint()
            setOpen(true)
          }}
          className="max-w-[15rem] rounded-2xl rounded-br-sm border border-[var(--gold)]/40 bg-white px-4 py-2.5 text-left text-sm font-semibold text-[var(--ink)] shadow-lg"
        >
          {t('bubble')}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          dismissHint()
          setOpen((o) => !o)
        }}
        aria-label={open ? t('close') : t('title')}
        aria-expanded={open}
        className="group flex h-16 w-16 items-center justify-center rounded-full border-2 border-[var(--gold)] bg-white shadow-xl transition-transform hover:scale-105"
      >
        {open ? <X className="h-7 w-7 text-[var(--ink)]" /> : <Kumi className="h-14 w-14" mood="happy" move={hint ? 'wave' : 'idle'} />}
      </button>
    </div>
  )
}
