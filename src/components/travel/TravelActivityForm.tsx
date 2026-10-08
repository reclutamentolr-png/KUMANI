'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle, Trash2 } from 'lucide-react'
import { deleteActivity, saveActivity } from '@/app/actions/travel'
import type { TripActivity, TripMember } from '@/lib/travel'
import { askConfirm } from '@/lib/confirm'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'

const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'

// Nuova attività dell'itinerario o modifica di una esistente.
export default function TravelActivityForm({
  tripId,
  day,
  activity,
  members,
  minDay,
  maxDay,
  onDone,
}: {
  tripId: string
  day: string
  activity: TripActivity | null
  members: TripMember[]
  minDay?: string | null
  maxDay?: string | null
  onDone: () => void
}) {
  const t = useTranslations('travel')
  const [form, setForm] = useState({
    day: activity?.day ?? day,
    time: activity?.time ?? '',
    title: activity?.title ?? '',
    place: activity?.place ?? '',
    mapLink: activity?.map_link ?? '',
    notes: activity?.notes ?? '',
    cost: activity?.cost_amount != null ? String(activity.cost_amount).replace('.', ',') : '',
    responsibleId: activity?.responsible_id ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.day) return setError(t('error_invalid'))
    setBusy(true)
    setError(null)
    try {
      const result = await saveActivity(tripId, { ...form, id: activity?.id })
      if (result.success) onDone()
      else setError(t(`error_${result.error}`))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!activity || !(await askConfirm(t('deleteActivityConfirm', { name: activity.title })))) return
    setBusy(true)
    try {
      const result = await deleteActivity(activity.id)
      if (result.success) onDone()
      else setError(t('error_saveError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={label}>{t('activityTitle')}</label>
        <input className={input} value={form.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder={t('activityTitlePlaceholder')} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t('activityDay')}</label>
          <input type="date" className={input} value={form.day} min={minDay ?? undefined} max={maxDay ?? undefined} onChange={(e) => set('day', e.target.value)} />
        </div>
        <div>
          <label className={label}>{t('activityTime')}</label>
          <input type="time" className={input} value={form.time} onChange={(e) => set('time', e.target.value)} />
        </div>
      </div>
      <div>
        <label className={label}>{t('activityPlace')}</label>
        <input className={input} value={form.place} maxLength={160} onChange={(e) => set('place', e.target.value)} placeholder={t('activityPlacePlaceholder')} />
      </div>
      <div>
        <label className={label}>{t('activityMapLink')}</label>
        <input className={input} value={form.mapLink} maxLength={500} inputMode="url" onChange={(e) => set('mapLink', e.target.value)} placeholder="https://maps.google.com/…" />
        <p className="mt-1 text-xs text-[var(--muted)]">{t('activityMapHint')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t('activityCost')}</label>
          <input className={input} value={form.cost} inputMode="decimal" onChange={(e) => set('cost', e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <label className={label}>{t('activityResponsible')}</label>
          <select className={input} value={form.responsibleId} onChange={(e) => set('responsibleId', e.target.value)}>
            <option value="">{t('nobody')}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.is_me ? ` (${t('me')})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={label}>{t('activityNotes')}</label>
        <textarea className={`${input} min-h-[80px]`} value={form.notes} maxLength={1000} onChange={(e) => set('notes', e.target.value)} />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        {activity && (
          <button type="button" onClick={remove} disabled={busy} className="flex items-center gap-1 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> {t('delete')}
          </button>
        )}
        <CancelButton className={cancelButtonLgClass} />
        <button
          type="submit"
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-white disabled:opacity-60"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {t('save')}
        </button>
      </div>
    </form>
  )
}
