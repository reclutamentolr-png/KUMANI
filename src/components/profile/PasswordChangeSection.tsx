'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react'
import { changeMyPassword } from '@/app/actions/password'
import TurnstileWidget, { TURNSTILE_ENABLED, useTurnstile } from '@/components/auth/TurnstileWidget'

// Nel profilo: cambio password con la password attuale (chi l'ha dimenticata
// usa "Password dimenticata" dalla pagina di accesso).
export default function PasswordChangeSection() {
  const t = useTranslations('passwordChange')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // La password attuale si controlla con un accesso: serve la verifica anti-robot.
  // Il riquadro compare solo quando si preme «Salva»: mentre si scrive non c'è,
  // così non può togliere il cursore ai campi
  const captcha = useTurnstile()
  const [verifying, setVerifying] = useState(false)

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setShow(false)
    setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError(null)
    if (next.length < 6) return setError(t('errorTooShort'))
    if (next !== confirm) return setError(t('errorMismatch'))
    if (next === current) return setError(t('errorSame'))
    setSaving(true)
    try {
      let token: string | undefined
      if (TURNSTILE_ENABLED) {
        setVerifying(true)
        token = await captcha.next()
      }
      const res = await changeMyPassword(current, next, locale, token)
      if (res.success) {
        reset()
        setOpen(false)
        setDone(true)
        return
      }
      const messages: Record<string, string> = {
        wrong_current: t('errorWrongCurrent'),
        too_short: t('errorTooShort'),
        too_long: t('errorTooLong'),
        same: t('errorSame'),
        rate_limit: t('errorRateLimit'),
        captcha: t('errorCaptcha'),
      }
      setError(messages[res.code ?? ''] ?? t('errorGeneric'))
    } catch {
      setError(t('errorGeneric'))
    } finally {
      // Dopo ogni tentativo il riquadro sparisce: al prossimo «Salva» ne parte uno nuovo
      setVerifying(false)
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'

  return (
    <div className="border-t border-gray-100">
      {!open ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
              <KeyRound className="h-4 w-4 text-[var(--gold)]" /> {t('title')}
            </p>
            {done ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('success')}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-gray-500">{t('hint')}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setDone(false)
              setOpen(true)
            }}
            className="shrink-0 rounded-lg border border-[var(--gold)]/50 px-3 py-1.5 text-xs font-bold text-[var(--ink)] transition hover:border-[var(--gold)] hover:bg-[var(--gold-pale)]"
          >
            {t('open')}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
            <KeyRound className="h-4 w-4 text-[var(--gold)]" /> {t('title')}
          </p>
          <div>
            <label htmlFor="pw-current" className="mb-1 block text-xs font-medium text-gray-700">{t('current')}</label>
            <input id="pw-current" type={show ? 'text' : 'password'} autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="pw-new" className="mb-1 block text-xs font-medium text-gray-700">{t('new')}</label>
            <input id="pw-new" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={6} maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="mb-1 block text-xs font-medium text-gray-700">{t('confirm')}</label>
            <input id="pw-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={6} maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          </div>
          <button type="button" onClick={() => setShow((value) => !value)} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[var(--ink)]">
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {show ? t('hide') : t('show')}
          </button>
          {error && (
            <p className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
          <p className="text-xs text-gray-500">{t('emailNotice')}</p>
          {verifying && <TurnstileWidget captcha={captcha} />}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                reset()
                setVerifying(false)
                setOpen(false)
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-50">
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
