'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarDays, Clock3, Globe, LoaderCircle, Scissors } from 'lucide-react'
import { startTempus } from '@/app/actions/tempus'
import type { TempusBooking, TempusClosure, TempusService, TempusSettings } from '@/lib/tempus'
import TempusAgenda from './TempusAgenda'
import TempusServices from './TempusServices'
import TempusHours from './TempusHours'
import TempusPageSettings from './TempusPageSettings'
import { card, primary } from './ui'

type Tab = 'agenda' | 'services' | 'hours' | 'page'
const TABS: { key: Tab; Icon: typeof Clock3 }[] = [
  { key: 'agenda', Icon: CalendarDays },
  { key: 'services', Icon: Scissors },
  { key: 'hours', Icon: Clock3 },
  { key: 'page', Icon: Globe },
]

// KUMANI TEMPUS: al primo avvio si sceglie l'indirizzo della pagina; poi
// agenda, servizi, orari e pagina pubblica.
export default function TempusApp(props: {
  initialSettings: TempusSettings | null
  initialServices: TempusService[]
  initialClosures: TempusClosure[]
  initialBookings: TempusBooking[]
  initialWeek: string
  suggestedSlug: string
  businessName: string
  publicBase: string
}) {
  const t = useTranslations('tempus')
  const [settings, setSettings] = useState(props.initialSettings)
  const [services, setServices] = useState(props.initialServices)
  const [closures, setClosures] = useState(props.initialClosures)
  // Senza servizi si parte da lì: senza servizi non si prenota
  const [tab, setTab] = useState<Tab>(props.initialServices.length ? 'agenda' : 'services')

  if (!settings) return <TempusStart suggestedSlug={props.suggestedSlug} publicBase={props.publicBase} onStarted={setSettings} />

  return (
    <div className="space-y-5">
      {!settings.is_published || !services.some((s) => s.active) || settings.suspended ? (
        <div className={`rounded-2xl border-2 px-4 py-3 text-sm ${settings.suspended ? 'border-red-200 bg-red-50 text-red-800' : 'border-[var(--gold)]/40 bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
          {settings.suspended
            ? t('suspendedNotice', { reason: settings.suspended_reason || '—' })
            : !services.some((s) => s.active)
              ? t('setupServicesFirst')
              : t('notPublishedNotice')}
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border-2 px-4 text-sm font-bold ${
              tab === key ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 bg-white text-gray-600 hover:border-[var(--gold)]/60'
            }`}
          >
            <Icon className="h-4 w-4" />
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>

      {tab === 'agenda' && <TempusAgenda settings={settings} services={services} initialBookings={props.initialBookings} initialWeek={props.initialWeek} />}
      {tab === 'services' && <TempusServices settings={settings} services={services} onChange={setServices} />}
      {tab === 'hours' && <TempusHours settings={settings} closures={closures} onSettings={setSettings} onClosures={setClosures} />}
      {tab === 'page' && <TempusPageSettings settings={settings} businessName={props.businessName} hasServices={services.some((s) => s.active)} publicBase={props.publicBase} onSettings={setSettings} />}
      {tab !== 'agenda' && <p className={`${card} text-sm text-[var(--muted)]`}>{t('privacyNote')}</p>}
    </div>
  )
}

function TempusStart({ suggestedSlug, publicBase, onStarted }: { suggestedSlug: string; publicBase: string; onStarted: (s: TempusSettings) => void }) {
  const t = useTranslations('tempus')
  const [slug, setSlug] = useState(suggestedSlug)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setBusy(true)
    setError('')
    const res = await startTempus(slug)
    setBusy(false)
    if (res.success) onStarted(res.settings)
    else setError(t(`error_${res.message}`))
  }

  return (
    <div className={card}>
      <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('startTitle')}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('startText')}</p>
      <ol className="mt-4 space-y-1.5 text-sm text-[var(--ink)]">
        <li>1. {t('startStep1')}</li>
        <li>2. {t('startStep2')}</li>
        <li>3. {t('startStep3')}</li>
      </ol>
      <label className="mt-5 block text-sm font-semibold text-[var(--ink)]">
        {t('slugLabel')}
        <div className="mt-1 flex items-center rounded-xl border-2 border-gray-200 bg-white focus-within:border-[var(--gold)]">
          <span className="pl-3 text-sm text-[var(--muted)]">{publicBase.replace(/^https?:\/\//, '')}</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40))}
            className="min-w-0 flex-1 rounded-r-xl bg-transparent px-1 py-2.5 font-bold text-[var(--ink)] focus:outline-none"
            placeholder={t('slugPlaceholder')}
          />
        </div>
        <span className="mt-1 block text-xs font-normal text-[var(--muted)]">{t('slugHint')}</span>
      </label>
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      <button type="button" onClick={start} disabled={busy || slug.length < 3} className={`${primary} mt-5 w-full sm:w-auto`}>
        {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
        {t('startButton')}
      </button>
    </div>
  )
}
