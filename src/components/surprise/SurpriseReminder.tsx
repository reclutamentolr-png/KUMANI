'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { AlarmClock, LoaderCircle, X } from 'lucide-react'
import { setSurpriseReminder } from '@/app/actions/surprise'

// «Promemoria per l'invio»: a data e ora scelte arrivano una notifica e
// un'email con WhatsApp già pronto (messaggio, link e, se c'è, il numero).
// L'ora si sceglie in quella del telefono e si salva come istante preciso.
const pad = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

export default function SurpriseReminder({ id, remindAt, phone, sentAt }: { id: string; remindAt: string | null; phone: string | null; sentAt: string | null }) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  const router = useRouter()
  const [editing, setEditing] = useState(!remindAt)
  const [when, setWhen] = useState(remindAt ? toLocalInput(new Date(remindAt)) : '')
  const [number, setNumber] = useState(phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (clear = false) => {
    setBusy(true)
    setError(null)
    const r = await setSurpriseReminder(id, clear ? null : new Date(when).toISOString(), clear ? null : number.trim() || null)
    setBusy(false)
    if (!r.success) return setError(t(`error_${r.message}`))
    if (clear) setWhen('')
    setEditing(clear)
    router.refresh()
  }

  const shown = remindAt ? new Date(remindAt).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''
  const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'

  return (
    <div className="rounded-xl border border-[var(--gold)]/35 bg-[var(--gold-pale)]/40 p-4">
      <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
        <AlarmClock className="h-5 w-5 text-[var(--gold)]" aria-hidden /> {t('reminderTitle')}
      </p>
      {!editing && remindAt ? (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-gray-700">
            {sentAt ? t('reminderSent', { date: shown }) : t('reminderSet', { date: shown })}
            {phone ? ` · ${phone}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)} className="min-h-10 rounded-xl border border-gray-300 bg-white px-3 font-semibold text-[var(--ink)]">
              {t('reminderChange')}
            </button>
            <button type="button" disabled={busy} onClick={() => save(true)} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 font-semibold text-red-700 hover:bg-red-50">
              <X className="h-4 w-4" aria-hidden /> {t('reminderRemove')}
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (when) void save()
          }}
          className="mt-2 space-y-3"
        >
          <p className="text-sm text-gray-600">{t('reminderIntro')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              {t('reminderWhen')}
              <input type="datetime-local" required value={when} min={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} className={`${input} mt-1 bg-white`} />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              {t('reminderPhone')}
              <input type="tel" inputMode="tel" value={number} maxLength={20} placeholder="+39 333 123 4567" onChange={(e) => setNumber(e.target.value)} className={`${input} mt-1 bg-white`} />
            </label>
          </div>
          <p className="text-xs text-gray-500">{t('reminderPhoneHint')}</p>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !when} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--ink)] px-4 font-bold text-white disabled:opacity-50">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <AlarmClock className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden />} {t('reminderSave')}
            </button>
            {remindAt && (
              <button type="button" onClick={() => setEditing(false)} className="min-h-10 rounded-xl px-3 font-semibold text-gray-600 hover:bg-black/5">
                {t('reminderCancel')}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
