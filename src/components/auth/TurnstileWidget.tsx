'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'

// Verifica anti-robot di Cloudflare Turnstile per Supabase Auth (accesso,
// registrazione, password dimenticata, cambio password). Il token si passa a
// Supabase come options.captchaToken e vale una volta sola: dopo ogni
// tentativo il widget si azzera e ne prepara uno nuovo.
// Senza NEXT_PUBLIC_TURNSTILE_SITE_KEY (es. in locale) non compare nulla e le
// chiamate partono senza token, esattamente come prima.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
export const TURNSTILE_ENABLED = SITE_KEY.length > 0
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
// Lingue del sito -> lingue di Turnstile (il portoghese c'è come pt-br)
const TURNSTILE_LANGUAGE: Record<string, string> = { pt: 'pt-br' }
const NEXT_TOKEN_TIMEOUT_MS = 30_000

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string | null | undefined
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

// Lo script si carica una volta sola per tutta la sessione del browser
let scriptPromise: Promise<TurnstileApi> | null = null
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise
  const promise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile_missing')))
    script.onerror = () => {
      script.remove()
      reject(new Error('turnstile_load_failed'))
    }
    document.head.appendChild(script)
  })
  // Se il caricamento fallisce si potrà riprovare (pulsante "Riprova")
  scriptPromise = promise.catch((err) => {
    scriptPromise = null
    throw err
  })
  return scriptPromise
}

type Status = 'loading' | 'ready' | 'error'

type Bridge = {
  setToken: (token: string | null) => void
  setStatus: (status: Status) => void
  bindReset: (reset: (() => void) | null) => void
}

export type TurnstileController = {
  // Token pronto (null finché il widget non l'ha dato)
  token: string | null
  // Il pulsante di invio aspetta il token, ma non per sempre: se il widget non
  // si carica (errore) si può inviare lo stesso e decide Supabase
  pending: boolean
  // Prende il token per una chiamata a Supabase e azzera subito il widget
  consume: () => string | undefined
  // Per una seconda chiamata nello stesso invio: aspetta il token nuovo
  next: () => Promise<string | undefined>
  // Azzera il widget (es. dopo un errore)
  reset: () => void
  bridge: Bridge
}

export function useTurnstile(): TurnstileController {
  const [token, setTokenState] = useState<string | null>(null)
  const [status, setStatusState] = useState<Status>('loading')
  const tokenRef = useRef<string | null>(null)
  const resetRef = useRef<(() => void) | null>(null)
  const waitersRef = useRef<((token: string | null) => void)[]>([])

  const setToken = useCallback((value: string | null) => {
    tokenRef.current = value
    setTokenState(value)
    if (value) {
      const waiters = waitersRef.current
      waitersRef.current = []
      waiters.forEach((resolve) => resolve(value))
    }
  }, [])

  const setStatus = useCallback((value: Status) => {
    setStatusState(value)
    if (value === 'error') {
      const waiters = waitersRef.current
      waitersRef.current = []
      waiters.forEach((resolve) => resolve(null))
    }
  }, [])

  const bindReset = useCallback((value: (() => void) | null) => {
    resetRef.current = value
  }, [])

  const reset = useCallback(() => {
    if (!TURNSTILE_ENABLED) return
    tokenRef.current = null
    setTokenState(null)
    resetRef.current?.()
  }, [])

  const consume = useCallback(() => {
    if (!TURNSTILE_ENABLED) return undefined
    const value = tokenRef.current ?? undefined
    reset()
    return value
  }, [reset])

  const next = useCallback(async () => {
    if (!TURNSTILE_ENABLED) return undefined
    if (!tokenRef.current) {
      await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), NEXT_TOKEN_TIMEOUT_MS)
        waitersRef.current.push((value) => {
          clearTimeout(timer)
          resolve(value)
        })
      })
    }
    return consume()
  }, [consume])

  const bridge = useMemo(() => ({ setToken, setStatus, bindReset }), [setToken, setStatus, bindReset])

  return {
    token,
    pending: TURNSTILE_ENABLED && !token && status !== 'error',
    consume,
    next,
    reset,
    bridge,
  }
}

export default function TurnstileWidget({ captcha, className }: { captcha: TurnstileController; className?: string }) {
  if (!TURNSTILE_ENABLED) return null
  return <TurnstileBox bridge={captcha.bridge} className={className} />
}

function TurnstileBox({ bridge, className }: { bridge: Bridge; className?: string }) {
  const t = useTranslations('turnstile')
  const locale = useLocale()
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  // Cambia per ricaricare script e widget da capo (pulsante "Riprova")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let widgetId: string | null = null
    let api: TurnstileApi | null = null
    const fail = () => {
      if (cancelled) return
      setFailed(true)
      bridge.setToken(null)
      bridge.setStatus('error')
    }
    bridge.setStatus('loading')

    loadTurnstile()
      .then((turnstile) => {
        const element = containerRef.current
        if (cancelled || !element) return
        api = turnstile
        widgetId =
          turnstile.render(element, {
            sitekey: SITE_KEY,
            theme: 'auto',
            size: 'flexible',
            language: TURNSTILE_LANGUAGE[locale] ?? locale,
            callback: (token: string) => {
              if (cancelled) return
              setFailed(false)
              bridge.setStatus('ready')
              bridge.setToken(token)
            },
            'expired-callback': () => {
              if (!cancelled) bridge.setToken(null)
            },
            'timeout-callback': () => {
              if (!cancelled) bridge.setToken(null)
            },
            'error-callback': () => {
              fail()
              // Gestito qui: niente eccezione in console da parte di Turnstile
              return true
            },
            'unsupported-callback': fail,
          }) ?? null
        if (!widgetId) return fail()
        const id = widgetId
        bridge.bindReset(() => {
          try {
            turnstile.reset(id)
          } catch {
            // widget già rimosso
          }
        })
      })
      .catch(fail)

    return () => {
      cancelled = true
      bridge.bindReset(null)
      if (api && widgetId) {
        try {
          api.remove(widgetId)
        } catch {
          // già rimosso
        }
      }
    }
  }, [bridge, locale, attempt])

  return (
    <div className={className}>
      <div ref={containerRef} className="flex min-h-[65px] w-full justify-center" />
      {failed && (
        <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-center text-xs text-amber-700">
          <span>{t('loadError')}</span>
          <button
            type="button"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
            className="inline-flex items-center gap-1 font-semibold text-[var(--ink)] underline-offset-2 hover:underline"
          >
            <RefreshCw className="h-3 w-3" /> {t('retry')}
          </button>
        </p>
      )}
    </div>
  )
}
