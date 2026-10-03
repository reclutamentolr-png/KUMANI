'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { User, Save, X, CheckCircle2, AlertCircle, Lock, FileEdit, Clock, XCircle } from 'lucide-react'
import ProfileFieldsGrid, { ConfirmLockBox, MissingFieldsBox, useProfileFieldLabel } from '@/components/profile/ProfileFieldsGrid'
import ProfileChangeRequestDialog from '@/components/profile/ProfileChangeRequestDialog'
import AccountDeletionSection from '@/components/profile/AccountDeletionSection'
import PasswordChangeSection from '@/components/profile/PasswordChangeSection'
import PushSettingsSection from '@/components/profile/PushSettingsSection'
import { useProfileCompletion } from '@/components/profile/useProfileCompletion'
import {
  cancelProfileChange,
  getMyChangeRequest,
  markProfileChangeSeen,
  type ProfileChangeRequest,
} from '@/app/actions/profileChanges'
import { LOCKABLE_PROFILE_FIELDS, PLACEHOLDER_BIRTH_DATE, toProfileFormValues, type LockableProfileField } from '@/lib/profileFields'

export type ProfileChangeState = { pending: ProfileChangeRequest | null; outcome: ProfileChangeRequest | null }

type ProfileModalProps = {
  isOpen: boolean
  onClose: () => void
  initialData: Record<string, unknown> | null
  userId: string
  // Aggiorna chi apre la modale (es. pallino sull'avatar) quando cambia lo stato della richiesta.
  onChangeRequestUpdate?: (state: ProfileChangeState) => void
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '' || value === PLACEHOLDER_BIRTH_DATE) return '—'
  return String(value)
}

export default function ProfileModal({ isOpen, onClose, initialData, userId, onChangeRequestUpdate }: ProfileModalProps) {
  const t = useTranslations('dashboard')
  const commonT = useTranslations('common')
  const lockT = useTranslations('profileLock')
  const locale = useLocale()
  const label = useProfileFieldLabel()
  // Profilo completato: dati anagrafici in sola lettura.
  const locked = Boolean(initialData?.profile_completed_at)

  const completion = useProfileCompletion(initialData, userId, () => {
    setTimeout(onClose, 1500)
  })

  const [changes, setChanges] = useState<ProfileChangeState>({ pending: null, outcome: null })
  const [reloadKey, setReloadKey] = useState(0)
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Stato della richiesta di cambio dati, riletto a ogni apertura.
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    getMyChangeRequest()
      .then((state) => {
        if (cancelled) return
        setChanges(state)
        // Esito mostrato qui: conta come visto, la scritta in alto sparisce
        // (il riquadro resta finché non si tocca "Ho capito")
        if (state.outcome) {
          markProfileChangeSeen(state.outcome.id).catch(() => {})
          onChangeRequestUpdate?.({ ...state, outcome: null })
        } else onChangeRequestUpdate?.(state)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isOpen, reloadKey, onChangeRequestUpdate])

  if (!isOpen) return null

  const close = () => {
    setRequestSent(false)
    onClose()
  }

  const dismissOutcome = () => {
    const outcome = changes.outcome
    if (!outcome) return
    setChanges({ ...changes, outcome: null })
  }

  const cancelRequest = async () => {
    setCancelling(true)
    try {
      await cancelProfileChange()
      setRequestSent(false)
      setReloadKey((key) => key + 1)
    } finally {
      setCancelling(false)
    }
  }

  const lockedValues = toProfileFormValues(initialData)
  const pending = changes.pending
  const outcome = changes.outcome
  const requestedFields = pending
    ? LOCKABLE_PROFILE_FIELDS.filter((field): field is LockableProfileField => field in (pending.requested ?? {}))
    : []

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={close}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header Modale */}
        <div className="flex justify-between items-center p-6 border-b border-[var(--gold)]/25">
          <div className="flex items-center gap-3">
            <div className="bg-[var(--ink)] p-2 rounded-full">
              <User className="w-5 h-5 text-[var(--gold-bright)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--ink)]">{locked ? t('myProfile') : t('editProfileTitle')}</h3>
          </div>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {/* Esito dell'ultima richiesta, finché l'utente non lo chiude */}
          {outcome?.status === 'approved' && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">{lockT('approvedTitle')}</p>
                <p className="mt-0.5 text-green-700">{lockT('approvedText')}</p>
                {outcome.staff_note && <p className="mt-1 text-green-700">{lockT('staffNote')}: {outcome.staff_note}</p>}
              </div>
              <button onClick={dismissOutcome} className="shrink-0 rounded-lg border border-green-300 bg-white px-3 py-1 text-xs font-bold text-green-800 hover:bg-green-100">
                {lockT('gotIt')}
              </button>
            </div>
          )}
          {outcome?.status === 'rejected' && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">{lockT('rejectedTitle')}</p>
                {outcome.staff_note && (
                  <p className="mt-0.5 text-red-700">
                    {lockT('staffNote')}: {outcome.staff_note}
                  </p>
                )}
              </div>
              <button onClick={dismissOutcome} className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-bold text-red-800 hover:bg-red-100">
                {lockT('gotIt')}
              </button>
            </div>
          )}

          {locked ? (
            <>
              <ProfileFieldsGrid values={lockedValues} locked />

              <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <Lock className="w-4 h-4 mt-0.5 shrink-0 text-[var(--gold,#c9a14a)]" />
                <p>{lockT('lockedNote')}</p>
              </div>

              {requestSent && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {lockT('requestSent')}
                </div>
              )}

              {pending ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-sm">
                  <p className="font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" /> {lockT('pendingTitle')}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    {lockT('pendingSentOn', { date: new Date(pending.created_at).toLocaleDateString(locale) })}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {requestedFields.map((field) => (
                      <li key={field} className="text-xs">
                        <span className="font-medium">{label(field)}:</span>{' '}
                        <span className="line-through text-amber-700/70">{displayValue(pending.previous?.[field])}</span>
                        {' → '}
                        <span className="font-semibold">{displayValue(pending.requested[field])}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-amber-800">
                    <span className="font-medium">{lockT('reasonLabel')}:</span> {pending.reason}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={cancelRequest}
                      disabled={cancelling}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-900 border border-amber-300 hover:bg-amber-100 disabled:opacity-50"
                    >
                      {cancelling ? lockT('cancelling') : lockT('cancelRequest')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={() => setRequestOpen(true)}
                    className="px-4 py-2 bg-[var(--ink,#111)] text-[var(--gold-bright,#f5d27a)] hover:opacity-90 rounded-lg font-semibold text-sm flex items-center gap-2"
                  >
                    <FileEdit className="w-4 h-4" /> {lockT('requestButton')}
                  </button>
                </div>
              )}

              {completion.saved && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {t('profileUpdated')}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button type="button" onClick={close} className="px-4 py-2 border border-[var(--gold)]/40 hover:border-[var(--gold)] hover:bg-[var(--paper)] text-[var(--ink)] rounded-lg font-medium transition-colors">
                  {commonT('close')}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={completion.submit} noValidate className="space-y-3">
              <ProfileFieldsGrid values={completion.values} onChange={completion.setField} missing={completion.missing} />
              <p className="text-[11px] text-gray-500">{lockT('requiredHint')}</p>

              <MissingFieldsBox missing={completion.missing} />

              {completion.error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {completion.error}
                </div>
              )}

              {completion.saved && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {t('profileUpdated')}
                </div>
              )}

              {completion.confirming ? (
                <ConfirmLockBox saving={completion.saving} onConfirm={completion.confirm} onBack={completion.cancelConfirm} />
              ) : (
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 border border-[var(--gold)]/40 hover:border-[var(--gold)] hover:bg-[var(--paper)] text-[var(--ink)] rounded-lg font-medium transition-colors"
                  >
                    {commonT('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={completion.saving || completion.saved}
                    className="px-4 py-2 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--ink)] rounded-lg font-bold flex items-center gap-2 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {completion.saving ? t('saving') : t('saveChanges')}
                  </button>
                </div>
              )}
            </form>
          )}

          {isOpen && <PushSettingsSection />}
          <PasswordChangeSection />
          <AccountDeletionSection isOpen={isOpen} />
        </div>
      </div>

      {requestOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <ProfileChangeRequestDialog
            current={lockedValues}
            onClose={() => setRequestOpen(false)}
            onSent={() => {
              setRequestOpen(false)
              setRequestSent(true)
              setReloadKey((key) => key + 1)
            }}
          />
        </div>
      )}
    </div>
  )
}
