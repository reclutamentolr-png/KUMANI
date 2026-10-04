'use client'

import { useState } from 'react'
import { CheckCircle2, Send } from 'lucide-react'
import { sendLandingMessage } from '@/app/actions/landing'

export type LandingFormLabels = {
  formTitle: string
  formName: string
  formContact: string
  formContactHint: string
  formMessage: string
  formConsent: string
  formPrivacy: string
  formSend: string
  formSent: string
  formError: string
  formTooMany: string
}

// Modulo "Scrivimi" della Landing Page: il messaggio arriva al titolare
// (casella nella Landing Page, avviso in dashboard e notifica sul telefono).
// Nell'anteprima dell'editor è solo da vedere.
export default function LandingContactForm({
  slug,
  labels,
  ownerName,
  privacyHref,
  preview,
}: {
  slug: string
  labels: LandingFormLabels
  ownerName: string
  privacyHref: string
  preview?: boolean
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'tooMany'>('idle')
  const field = 'w-full rounded-xl border px-3 py-2.5 text-base focus:outline-none focus:ring-2'
  const fieldStyle = { background: 'var(--lp-surface)', borderColor: 'var(--lp-line)', color: 'var(--lp-text)' }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (preview) return
    const data = new FormData(e.currentTarget)
    setState('sending')
    const r = await sendLandingMessage({
      slug,
      name: String(data.get('name') ?? ''),
      contact: String(data.get('contact') ?? ''),
      message: String(data.get('message') ?? ''),
      consent: data.get('consent') === '1',
      website: String(data.get('website') ?? ''),
    })
    setState(r.success ? 'sent' : r.reason === 'tooMany' ? 'tooMany' : 'error')
  }

  if (state === 'sent') {
    return (
      <p className="flex items-center gap-2 rounded-2xl border p-5 font-semibold" style={{ borderColor: 'var(--lp-accent)', color: 'var(--lp-text)' }} role="status">
        <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: 'var(--lp-accent)' }} /> {labels.formSent}
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border p-5" style={{ background: 'var(--lp-surface)', borderColor: 'var(--lp-line)' }}>
      <h3 className="text-lg font-semibold">{labels.formTitle}</h3>
      <div className="grid gap-3 @xl:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{labels.formName}</span>
          <input name="name" required maxLength={80} disabled={preview} className={field} style={fieldStyle} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{labels.formContact}</span>
          <input name="contact" required maxLength={120} disabled={preview} className={field} style={fieldStyle} />
          <span className="mt-1 block text-xs" style={{ color: 'var(--lp-muted)' }}>{labels.formContactHint}</span>
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{labels.formMessage}</span>
        <textarea name="message" required maxLength={2000} rows={4} disabled={preview} className={field} style={fieldStyle} />
      </label>
      {/* Campo trappola per i robot: le persone non lo vedono */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <label className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: 'var(--lp-muted)' }}>
        <input type="checkbox" name="consent" value="1" required disabled={preview} className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {labels.formConsent.replace('{name}', ownerName)}{' '}
          <a href={preview ? undefined : privacyHref} target="_blank" rel="noopener noreferrer" className="underline">
            {labels.formPrivacy}
          </a>
        </span>
      </label>
      {(state === 'error' || state === 'tooMany') && (
        <p className="text-sm font-medium text-red-500" role="alert">
          {state === 'tooMany' ? labels.formTooMany : labels.formError}
        </p>
      )}
      <button
        type="submit"
        disabled={preview || state === 'sending'}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold transition hover:brightness-110 disabled:opacity-60"
        style={{ background: 'var(--lp-accent)', color: 'var(--lp-on-accent)' }}
      >
        <Send className="h-4 w-4" /> {labels.formSend}
      </button>
    </form>
  )
}
