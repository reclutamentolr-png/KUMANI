'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CalendarCheck, CheckCircle2, LoaderCircle, Mail, PackageCheck } from 'lucide-react'
import { askConfirm } from '@/lib/confirm'
import { DELIVERY_MAX } from '@/lib/surpriseDelivery'
import { bookSurpriseDelivery, claimDeliveryLink, markSurpriseDelivered, resendDeliveryLink } from '@/app/actions/surpriseDelivery'

// Pagine di chi consegna (senza account): apertura del link segreto,
// appuntamento, consegna e «mandami di nuovo il link».

// Link dell'email: il segreto è dopo il # (#k=…); diventa un cookie e sparisce dall'indirizzo
export function DeliveryClaim({ code }: { code: string }) {
  const t = useTranslations('surprise')
  const router = useRouter()
  const [state, setState] = useState<'checking' | 'none' | 'bad'>('checking')
  useEffect(() => {
    const key = new URLSearchParams(window.location.hash.slice(1)).get('k')
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- l'indirizzo si legge solo nel browser
      setState('none')
      return
    }
    claimDeliveryLink(code, key)
      .then((r) => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        if (r.ok) router.refresh()
        else setState('bad')
      })
      .catch(() => setState('bad'))
  }, [code, router])
  if (state === 'checking')
    return (
      <p className="flex items-center justify-center gap-2 py-6 text-sm text-white/70">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> {t('dlvManageOpening')}
      </p>
    )
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/80">{state === 'bad' ? t('dlvManageBadLink') : t('dlvManageNoLink')}</p>
      <ResendLink code={code} />
    </div>
  )
}

export function ResendLink({ code }: { code: string }) {
  const t = useTranslations('surprise')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'wait'>('idle')
  const send = async () => {
    setState('busy')
    const r = await resendDeliveryLink(code).catch(() => ({ ok: false, reason: 'wait' as const }))
    setState(r.ok ? 'done' : 'wait')
  }
  if (state === 'done' || state === 'wait')
    return (
      <p className="rounded-xl bg-white/10 px-4 py-3 text-sm text-white" role="status">
        {state === 'done' ? t('dlvResendDone') : t('dlvResendWait')}
      </p>
    )
  return (
    <button
      type="button"
      onClick={send}
      disabled={state === 'busy'}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/25 px-4 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60"
    >
      {state === 'busy' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />} {t('dlvResendCta')}
    </button>
  )
}

export function DeliverButton({ code }: { code: string }) {
  const t = useTranslations('surprise')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deliver = async () => {
    if (!(await askConfirm(t('dlvDeliverConfirm'), { tone: 'warning', confirmLabel: t('dlvDeliverCta') }))) return
    setBusy(true)
    setError(null)
    const r = await markSurpriseDelivered(code)
    setBusy(false)
    if (!r.ok && r.reason !== 'delivered') return setError(r.reason === 'closed' ? t('dlvErr_invalid') : t(`dlvErrProvider_${r.reason}`))
    router.refresh()
  }
  return (
    <div>
      <button
        type="button"
        onClick={deliver}
        disabled={busy}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <PackageCheck className="h-4 w-4" aria-hidden />} {t('dlvDeliverCta')}
      </button>
      <p className="mt-1.5 text-[11px] text-gray-500">{t('dlvDeliverHint')}</p>
      {error && (
        <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// Data e ora locali per <input type="datetime-local">
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function BookingForm({ code, to, initialText, initialAt, change }: { code: string; to: string; initialText: string; initialAt: string | null; change?: boolean }) {
  const t = useTranslations('surprise')
  const router = useRouter()
  const [open, setOpen] = useState(!change)
  const [text, setText] = useState(initialText)
  const [at, setAt] = useState(toLocalInput(initialAt))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const field = 'mt-1 w-full rounded-xl border border-[#c9a227]/40 bg-white px-3 py-2.5 text-[15px] focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/30'
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 cursor-pointer text-sm font-semibold text-gray-600 underline underline-offset-4">
        {t('dlvBookChange')}
      </button>
    )
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() && !at) return setError(t('dlvErrProvider_invalid'))
    setBusy(true)
    setError(null)
    const r = await bookSurpriseDelivery(code, { text, at: at ? new Date(at).toISOString() : null })
    setBusy(false)
    if (!r.ok) return setError(r.reason === 'closed' ? t('dlvErr_invalid') : t(`dlvErrProvider_${r.reason}`))
    if (change) setOpen(false)
    router.refresh()
  }
  return (
    <form onSubmit={save} className="space-y-2">
      <label className="block text-xs font-semibold text-gray-600">
        {t('dlvBookLabel', { to })}
        <input className={field} value={text} maxLength={DELIVERY_MAX.booking} placeholder={t('dlvBookTextPlaceholder')} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="block text-xs font-semibold text-gray-600">
        {t('dlvBookDateLabel')}
        <input type="datetime-local" className={field} value={at} onChange={(e) => setAt(e.target.value)} />
      </label>
      {error && (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-bold text-[#e8c872] disabled:opacity-60">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <CalendarCheck className="h-4 w-4" aria-hidden />} {t('dlvBookCta')}
      </button>
      <p className="text-[11px] text-gray-500">{t('dlvBookHint', { to })}</p>
    </form>
  )
}

export function DeliveredBox() {
  const t = useTranslations('surprise')
  return (
    <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900" role="status">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden /> {t('dlvDoneBox')}
    </p>
  )
}
