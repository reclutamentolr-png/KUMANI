'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import { deleteFidelityCard } from '@/app/actions/fidelity'
import FidelitySettingsForm from '@/components/fidelity/FidelitySettingsForm'
import type { BusinessProfile } from '@/lib/businessProfile'
import type { FidelityCard } from '@/lib/fidelity'

// Riepilogo della tessera con matita (modifica) e cestino (eliminazione
// definitiva, con popup di conferma) — stesso schema del box "La tua
// storia" del Kumano del Giorno.
export default function FidelitySettingsPanel({
  card,
  customersCount,
  businessProfile = null,
}: {
  card: FidelityCard
  customersCount: number
  businessProfile?: BusinessProfile | null
}) {
  const t = useTranslations('fidelity')
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(false)
    const result = await deleteFidelityCard()
    setDeleting(false)
    if (result.success) {
      setConfirmDelete(false)
      router.refresh()
    } else setDeleteError(true)
  }

  if (editing) return <FidelitySettingsForm card={card} businessProfile={businessProfile} onDone={() => setEditing(false)} />

  return (
    <div className="flex items-start justify-between gap-3">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--muted)]">{t('businessNameField')}</dt>
          <dd className="font-semibold text-[var(--ink)]">{card.business_name}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{t('prizeField')}</dt>
          <dd className="font-semibold text-[var(--ink)]">{card.prize}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{t('stampsNeededField')}</dt>
          <dd className="font-semibold text-[var(--ink)]">{card.stamps_needed}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{t('minHoursField')}</dt>
          <dd className="font-semibold text-[var(--ink)]">{card.min_hours_between_stamps}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{t('expiryField')}</dt>
          <dd className="font-semibold text-[var(--ink)]">
            {card.stamps_expire_days ? t('expiryMonths', { months: Math.round(card.stamps_expire_days / 30) }) : t('expiryNever')}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{t('closePercentField')}</dt>
          <dd className="font-semibold text-[var(--ink)]">{card.close_to_prize_percent}%</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[var(--muted)]">{t('reviewUrlField')}</dt>
          <dd className="truncate font-semibold text-[var(--ink)]">{card.review_url || t('off')}</dd>
        </div>
      </dl>
      <div className="flex flex-shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={t('edit')}
          aria-label={t('edit')}
          className="rounded-lg bg-gray-100 p-2 text-gray-700 transition-colors hover:bg-gray-200"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          title={t('deleteCard')}
          aria-label={t('deleteCard')}
          className="rounded-lg bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !deleting && setConfirmDelete(false)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-[var(--paper)] p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-red-500" />
            <p className="text-lg font-bold text-[var(--ink)]">{t('deleteCardTitle', { business: card.business_name })}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('deleteCardText', { count: customersCount })}</p>
            {deleteError && <p className="mt-3 text-sm text-red-600">{t('genericError')}</p>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                autoFocus
                className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t('deleting') : t('deleteCardConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
