'use client'

import { useId, useState, type FormEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from 'lucide-react'

// Controllo della password con Pwned Passwords (k-anonimato): nel browser si
// calcola lo SHA-1 e si inviano solo i primi 5 caratteri dell'impronta; il
// confronto con le impronte ricevute avviene qui. La password non lascia mai
// il dispositivo, non viene salvata e il campo si svuota dopo il controllo.

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

type State = { kind: 'idle' } | { kind: 'checking' } | { kind: 'found'; count: number } | { kind: 'clean' } | { kind: 'error' }

export default function PasswordCheck() {
  const t = useTranslations('scudoDati')
  const locale = useLocale()
  const inputId = useId()
  const noteId = useId()
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!password) return
    const value = password
    setPassword('')
    setVisible(false)
    setState({ kind: 'checking' })
    try {
      const hash = await sha1Hex(value)
      const prefix = hash.slice(0, 5)
      const suffix = hash.slice(5)
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      })
      if (!res.ok) throw new Error('status')
      const body = await res.text()
      let count = 0
      for (const line of body.split('\n')) {
        const [candidate, times] = line.trim().split(':')
        if (candidate === suffix) {
          count = parseInt(times, 10) || 0
          break
        }
      }
      setState(count > 0 ? { kind: 'found', count } : { kind: 'clean' })
    } catch {
      setState({ kind: 'error' })
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
        <KeyRound className="h-5 w-5 text-[var(--gold)]" aria-hidden />
        {t('pwTitle')}
      </h3>
      <p className="mt-1 text-sm leading-6 text-gray-600">{t('pwText')}</p>

      <form onSubmit={check} className="mt-4" noValidate>
        <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-[var(--ink)]">
          {t('pwLabel')}
        </label>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id={inputId}
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (state.kind !== 'checking') setState({ kind: 'idle' })
              }}
              aria-describedby={noteId}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-4 pr-11 text-base text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
            />
            <button
              type="button"
              onClick={() => setVisible((value) => !value)}
              aria-label={visible ? t('pwHide') : t('pwShow')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            >
              {visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
            </button>
          </div>
          <button
            type="submit"
            disabled={!password || state.kind === 'checking'}
            className="flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {state.kind === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden />}
            {state.kind === 'checking' ? t('checking') : t('pwCheck')}
          </button>
        </div>
        <p id={noteId} className="mt-2 text-xs leading-5 text-gray-500">
          {t('pwNote')}
        </p>
      </form>

      <div aria-live="polite" className="mt-4 empty:hidden">
        {state.kind === 'found' && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
            <div>
              <p className="font-bold text-red-900">{t('pwFound', { count: state.count, formatted: state.count.toLocaleString(locale) })}</p>
              <p className="mt-1 text-sm leading-6 text-red-950">{t('pwFoundText')}</p>
            </div>
          </div>
        )}
        {state.kind === 'clean' && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="font-bold text-emerald-900">{t('pwNotFound')}</p>
              <p className="mt-1 text-sm leading-6 text-emerald-950">{t('pwNotFoundText')}</p>
            </div>
          </div>
        )}
        {state.kind === 'error' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{t('pwError')}</p>}
      </div>
    </section>
  )
}
