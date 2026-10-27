'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { RefreshCw, X } from 'lucide-react'

// Aggiornamenti senza chiudere l'app. L'app installata sulla schermata Home
// (e una scheda lasciata aperta) resta sulla versione caricata: quando torna
// in primo piano, e ogni 10 minuti mentre è aperta, si chiede al sito quale
// versione è online. Se è più nuova compare «Aggiorna»; se nessuno lo tocca,
// la versione nuova si carica da sola al primo cambio di pagina (così non si
// perde mai quello che si sta scrivendo).
const CHECK_EVERY_MS = 10 * 60_000

export default function UpdateWatcher({ version }: { version: string }) {
  const t = useTranslations('common')
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [hidden, setHidden] = useState(false)
  const readyAt = useRef<string | null>(null)
  const lastCheck = useRef(0)

  useEffect(() => {
    if (!version || version === 'dev') return
    let stopped = false
    const check = async () => {
      if (stopped || readyAt.current !== null || Date.now() - lastCheck.current < 30_000) return
      lastCheck.current = Date.now()
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        const { v } = (await res.json()) as { v?: string }
        if (v && v !== 'dev' && v !== version) {
          readyAt.current = window.location.pathname
          setReady(true)
        }
      } catch {
        // Senza rete si riprova al prossimo giro
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = setInterval(onVisible, CHECK_EVERY_MS)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      clearInterval(timer)
    }
  }, [version])

  // Versione nuova pronta e la persona cambia pagina: si carica quella nuova
  useEffect(() => {
    if (readyAt.current !== null && window.location.pathname !== readyAt.current) window.location.reload()
  }, [pathname])

  if (!ready || hidden) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))] print:hidden"
    >
      <div className="flex max-w-md items-center gap-3 rounded-2xl border border-[var(--gold)]/40 bg-[var(--ink)] py-2 pl-4 pr-2 text-sm text-white shadow-xl">
        <span className="min-w-0 flex-1">{t('updateReady')}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--gold-bright)] px-4 font-bold text-[var(--ink)]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> {t('updateNow')}
        </button>
        <button type="button" onClick={() => setHidden(true)} aria-label={t('updateLater')} className="rounded-full p-2 text-white/60 hover:text-white">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
