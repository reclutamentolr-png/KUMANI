'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { BellRing, Check, LoaderCircle, X } from 'lucide-react'
import { deleteListingAlert, saveListingAlert } from '@/app/actions/listings'

// «Avvisami quando esce»: salva la ricerca corrente; arriva un avviso quando
// lo Staff approva un annuncio adatto.
export function SaveListingAlertButton({ search }: { search: { q?: string; category?: string; country?: string; region?: string; city?: string } }) {
  const t = useTranslations('marketplace')
  const router = useRouter()
  const [pending, start] = useTransition()
  const [state, setState] = useState<'idle' | 'saved' | string>('idle')
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || state === 'saved'}
        onClick={() =>
          start(async () => {
            const r = await saveListingAlert(search)
            setState(r.success ? 'saved' : (r.message ?? 'listingAlertError'))
            if (r.success) router.refresh()
          })
        }
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)] disabled:opacity-70"
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : state === 'saved' ? <Check className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
        {state === 'saved' ? t('listingAlertSaved') : t('listingAlertSave')}
      </button>
      {state !== 'idle' && state !== 'saved' && <span className="text-xs font-semibold text-red-600">{t.has(state) ? t(state) : t('listingAlertError')}</span>}
    </span>
  )
}

export type SavedListingAlert = { id: string; label: string }

export function ListingAlertsList({ alerts }: { alerts: SavedListingAlert[] }) {
  const t = useTranslations('marketplace')
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  if (!alerts.length) return null
  return (
    <div className="mb-6 rounded-2xl border border-[var(--gold)]/30 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
        <BellRing className="h-4 w-4 text-[var(--gold)]" /> {t('listingAlertsTitle')}
      </p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{t('listingAlertsHint')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {alerts.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/50 bg-[var(--gold-pale)]/60 py-1 pl-3 pr-1 text-xs font-semibold text-[var(--ink)]">
            {a.label}
            <button
              type="button"
              disabled={busy === a.id}
              onClick={async () => {
                setBusy(a.id)
                await deleteListingAlert(a.id)
                setBusy(null)
                router.refresh()
              }}
              aria-label={t('listingAlertDelete')}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white"
            >
              {busy === a.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
