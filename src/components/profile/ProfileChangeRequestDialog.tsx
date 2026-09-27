'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, FileEdit, Send, X } from 'lucide-react'
import { requestProfileChange, type ProfileChangeError } from '@/app/actions/profileChanges'
import ProfileFieldsGrid from '@/components/profile/ProfileFieldsGrid'
import { FORM_PROFILE_FIELDS, type FormProfileField, type ProfileFormValues } from '@/lib/profileFields'

const ERROR_KEYS: Record<ProfileChangeError, string> = {
  reason: 'errReason',
  pending: 'errPending',
  invalid: 'errInvalid',
  no_changes: 'errNoChanges',
  not_allowed: 'errNotAllowed',
  generic: 'errGeneric',
}

type ProfileChangeRequestDialogProps = {
  current: ProfileFormValues
  onClose: () => void
  onSent: () => void
}

// Richiesta allo Staff di cambiare i dati anagrafici bloccati: motivazione
// e dati precompilati con i valori attuali (si inviano solo quelli cambiati).
export default function ProfileChangeRequestDialog({ current, onClose, onSent }: ProfileChangeRequestDialogProps) {
  const lockT = useTranslations('profileLock')
  const commonT = useTranslations('common')
  const [reason, setReason] = useState('')
  const [values, setValues] = useState<ProfileFormValues>(current)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changedFields = FORM_PROFILE_FIELDS.filter((field) => values[field].trim() && values[field].trim() !== current[field].trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (reason.trim().length < 10) {
      setError(lockT('errReason'))
      return
    }
    if (changedFields.length === 0) {
      setError(lockT('errNoChanges'))
      return
    }
    const changes: Record<string, string> = {}
    for (const field of changedFields) changes[field] = values[field].trim()
    setSending(true)
    try {
      const result = await requestProfileChange(reason, changes)
      if (result.success) {
        onSent()
        return
      }
      setError(lockT(ERROR_KEYS[result.error]))
    } catch {
      setError(lockT('errGeneric'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-[var(--ink,#111)] p-2 rounded-full">
              <FileEdit className="w-5 h-5 text-[var(--gold-bright,#f5d27a)]" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{lockT('requestTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title={commonT('close')}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4">
          <p className="text-sm text-gray-600">{lockT('requestIntro')}</p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {lockT('reasonLabel')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={lockT('reasonPlaceholder')}
              className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="mt-0.5 text-[11px] text-gray-500">{lockT('reasonHint')}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{lockT('requestedData')}</p>
            <ProfileFieldsGrid
              values={values}
              onChange={(field: FormProfileField, value: string) => setValues((prev) => ({ ...prev, [field]: value }))}
            />
            <p className="mt-2 text-[11px] text-gray-500">{lockT('changedCount', { count: changedFields.length })}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">
              {commonT('cancel')}
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 bg-[var(--ink,#111)] text-[var(--gold-bright,#f5d27a)] hover:opacity-90 disabled:opacity-50 rounded-lg font-semibold flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sending ? lockT('sending') : lockT('send')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
