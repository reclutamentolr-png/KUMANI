'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { createConvivium, updateConvivium, type ConviviumInput } from '@/app/actions/convivium'
import { HandCoins } from 'lucide-react'
import { OCCASION_ICON } from '@/components/convivium/OccasionIcon'
import { CONVIVIUM_LIMITS, CONVIVIUM_OCCASIONS, type ConviviumEvent, type ConviviumOccasion } from '@/lib/convivium'

function OccasionGlyph({ occasion, active }: { occasion: ConviviumOccasion; active: boolean }) {
  const Icon = OCCASION_ICON[occasion]
  return <Icon className={`h-4 w-4 ${active ? 'text-[var(--gold-bright)]' : 'text-[var(--gold)]'}`} strokeWidth={2} aria-hidden />
}

type CostMode = ConviviumInput['costMode']
const initialCostMode = (cents: number | null | undefined): CostMode => (cents == null ? 'none' : cents === 0 ? 'free' : 'amount')
const centsToInput = (cents: number | null | undefined) => (cents ? (cents % 100 ? (cents / 100).toFixed(2).replace('.', ',') : String(cents / 100)) : '')

// Data e ora per <input type="datetime-local"> nell'ora del telefono
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Proposta: il prossimo venerdì alle 19:00 (o domani, se è già venerdì sera)
function defaultWhen() {
  const d = new Date()
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7))
  d.setHours(19, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

// Vero solo dopo il caricamento completo: prima un tocco su «Crea» andrebbe perso
const noop = () => () => {}
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false)

const field = 'w-full rounded-xl border border-[var(--gold)]/30 bg-white px-3.5 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20'

export default function ConviviumForm({ event, onDone }: { event?: ConviviumEvent; onDone?: () => void }) {
  const t = useTranslations('convivium')
  const router = useRouter()
  const [pending, start] = useTransition()
  const hydrated = useHydrated()
  const [error, setError] = useState<string | null>(null)
  const [occasion, setOccasion] = useState<ConviviumOccasion>(event?.occasion ?? 'aperitivo')
  const [title, setTitle] = useState(event?.title ?? '')
  const [when, setWhen] = useState(event ? toLocalInput(event.starts_at) : defaultWhen())
  const [place, setPlace] = useState(event?.place ?? '')
  const [mapsUrl, setMapsUrl] = useState(event?.maps_url ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  const [maxGuests, setMaxGuests] = useState(event?.max_guests ? String(event.max_guests) : '')
  const [costMode, setCostMode] = useState<CostMode>(initialCostMode(event?.cost_cents))
  const [cost, setCost] = useState(centsToInput(event?.cost_cents))
  const [costNote, setCostNote] = useState(event?.cost_note ?? '')
  const [hostJoins, setHostJoins] = useState(event?.host_joins ?? true)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) return setError('title')
    if (!when) return setError('date')
    const input: ConviviumInput = {
      occasion,
      title,
      note,
      startsAt: new Date(when).toISOString(),
      place,
      mapsUrl,
      maxGuests: maxGuests ? Number(maxGuests) : null,
      costMode,
      cost,
      costNote,
      hostJoins,
    }
    start(async () => {
      const res = event ? await updateConvivium(event.id, input) : await createConvivium(input)
      if (!res.success) return setError(res.error)
      if (event) {
        router.refresh()
        onDone?.()
      } else if (res.id) router.push(`/convivium/${res.id}`)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-[var(--ink)]">{t('occasionLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {CONVIVIUM_OCCASIONS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOccasion(o)}
              aria-pressed={occasion === o}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${occasion === o ? 'bg-[var(--ink)] text-white ring-1 ring-[var(--gold)]/60' : 'bg-[var(--gold)]/10 text-[var(--ink)] hover:bg-[var(--gold)]/20'}`}
            >
              <OccasionGlyph occasion={o} active={occasion === o} /> {t(`occasion_${o}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('titleLabel')}</span>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={CONVIVIUM_LIMITS.title} placeholder={t('titlePlaceholder', { occasion: t(`occasion_${occasion}`) })} required />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('whenLabel')}</span>
          <input type="datetime-local" className={field} value={when} onChange={(e) => setWhen(e.target.value)} required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('maxLabel')}</span>
          <input type="number" inputMode="numeric" min={hostJoins ? 2 : 1} max={CONVIVIUM_LIMITS.maxGuests} className={field} value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} placeholder={t('maxHint')} />
          {hostJoins && <span className="mt-1 block text-xs text-[var(--muted)]">{t('maxIncludesYou')}</span>}
        </label>
      </div>

      {/* Chi organizza al tavolo: primo nome della lista, conta nei posti */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/[0.06] px-3.5 py-3">
        <input type="checkbox" checked={hostJoins} onChange={(e) => setHostJoins(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
        <span>
          <span className="block text-sm font-bold text-[var(--ink)]">{t('hostJoinsLabel')}</span>
          <span className="block text-xs text-[var(--muted)]">{t('hostJoinsHint')}</span>
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('placeLabel')}</span>
        <input className={field} value={place} onChange={(e) => setPlace(e.target.value)} maxLength={CONVIVIUM_LIMITS.place} placeholder={t('placePlaceholder')} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('mapsLabel')}</span>
        <input type="url" inputMode="url" className={field} value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('noteLabel')}</span>
        <textarea className={`${field} min-h-24`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={CONVIVIUM_LIMITS.note} placeholder={t('notePlaceholder')} />
      </label>

      {/* Costo: lo vedono gli invitati prima di rispondere */}
      <fieldset>
        <legend className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
          <HandCoins className="h-4 w-4 text-[var(--gold)]" aria-hidden /> {t('costLabel')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {(['none', 'free', 'amount'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setCostMode(m)}
              aria-pressed={costMode === m}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${costMode === m ? 'bg-[var(--ink)] text-white ring-1 ring-[var(--gold)]/60' : 'bg-[var(--gold)]/10 text-[var(--ink)] hover:bg-[var(--gold)]/20'}`}
            >
              {t(`cost_${m}`)}
            </button>
          ))}
        </div>
        {costMode !== 'none' && (
          <div className={`mt-3 grid gap-3 ${costMode === 'amount' ? 'sm:grid-cols-[10rem_1fr]' : ''}`}>
            {costMode === 'amount' && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">{t('costAmountLabel')}</span>
                <span className="relative block">
                  <input inputMode="decimal" className={`${field} pr-9`} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="12" maxLength={8} />
                  <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center font-bold text-[var(--muted)]">€</span>
                </span>
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">{t('costNoteLabel')}</span>
              <input className={field} value={costNote} onChange={(e) => setCostNote(e.target.value)} maxLength={CONVIVIUM_LIMITS.costNote} placeholder={t(costMode === 'free' ? 'costNoteFreePlaceholder' : 'costNotePlaceholder')} />
            </label>
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700">
          {t(`error_${['title', 'date', 'past', 'limit', 'suspended', 'not_allowed', 'cost', 'max'].includes(error) ? error : 'generic'}`)}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending || !hydrated} className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow disabled:opacity-60">
          {pending ? t('saving') : event ? t('save') : t('create')}
        </button>
        {event && onDone && (
          <button type="button" onClick={onDone} className="rounded-xl border border-[var(--gold)]/40 px-5 py-3 font-semibold text-[var(--ink)]">
            {t('cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
