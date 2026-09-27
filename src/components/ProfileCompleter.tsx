'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, AlertCircle, X, LogOut, Lock } from 'lucide-react'
import { logout } from '@/app/actions/logout'
import ProfileFieldsGrid, { ConfirmLockBox, MissingFieldsBox } from '@/components/profile/ProfileFieldsGrid'
import { useProfileCompletion } from '@/components/profile/useProfileCompletion'

type ProfileCompleterProps = {
  initialData: Record<string, unknown> | null
  // Nel popup promemoria: "Più tardi" / chiudi e fine salvataggio li gestisce chi lo apre.
  onDismiss?: () => void
  onSaved?: () => void
  // Richiesta obbligatoria (promemoria già chiuso una volta): niente chiusura, solo "Esci".
  blocking?: boolean
}

export default function ProfileCompleter({ initialData, onDismiss, onSaved, blocking = false }: ProfileCompleterProps) {
  const t = useTranslations('dashboard')
  const commonT = useTranslations('common')
  const lockT = useTranslations('profileLock')
  const [dismissed, setDismissed] = useState(false)
  const form = useProfileCompletion(initialData, String(initialData?.id ?? ''), onSaved)

  if (dismissed || form.saved) return null

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="bg-amber-100 p-2 rounded-full">
            {blocking ? <Lock className="w-5 h-5 text-amber-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
          </div>
          <div>
            <h3 className="font-bold text-amber-900">{blocking ? lockT('requiredTitle') : t('completeProfile')}</h3>
            <p className="text-sm text-amber-700 mt-1">{blocking ? lockT('blockingText') : t('completeProfileDesc')}</p>
          </div>
        </div>
        {!blocking && (
          <button onClick={() => (onDismiss ? onDismiss() : setDismissed(true))} className="text-amber-600 hover:text-amber-800" title={commonT('close')}>
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={form.submit} noValidate className="space-y-3">
        <ProfileFieldsGrid values={form.values} onChange={form.setField} missing={form.missing} accent="amber" />
        <p className="text-[11px] text-gray-500">{lockT('requiredHint')}</p>

        <MissingFieldsBox missing={form.missing} />

        {form.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {form.error}
          </div>
        )}

        {form.confirming ? (
          <ConfirmLockBox saving={form.saving} onConfirm={form.confirm} onBack={form.cancelConfirm} />
        ) : (
          <div className="flex items-center justify-end gap-2">
            {onDismiss && !blocking && (
              <button type="button" onClick={onDismiss} className="px-4 py-2 rounded-lg font-medium text-amber-800 hover:bg-amber-100">
                {t('profileLater')}
              </button>
            )}
            <button
              type="submit"
              disabled={form.saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {form.saving ? t('saving') : t('saveProfile')}
            </button>
          </div>
        )}
      </form>

      {blocking && (
        <form action={logout} className="mt-4 border-t border-amber-200 pt-3 text-center">
          <button type="submit" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-red-700">
            <LogOut className="w-4 h-4" /> {lockT('logout')}
          </button>
        </form>
      )}
    </div>
  )
}
