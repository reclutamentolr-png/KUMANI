'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertCircle, AlertTriangle, Clock, Trash2, X } from 'lucide-react'
import {
  cancelAccountDeletion,
  getMyDeletionRequest,
  requestAccountDeletion,
  type AccountDeletionRequest,
} from '@/app/actions/accountDeletion'

// Sezione discreta in fondo al profilo: richiesta di cancellazione dell'account.
export default function AccountDeletionSection({ isOpen }: { isOpen: boolean }) {
  const t = useTranslations('accountDeletion')
  const locale = useLocale()
  const [pending, setPending] = useState<AccountDeletionRequest | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    getMyDeletionRequest()
      .then((request) => {
        if (cancelled) return
        setPending(request)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, reloadKey])

  if (!loaded) return null

  const cancelRequest = async () => {
    setCancelling(true)
    setCancelError(false)
    try {
      const res = await cancelAccountDeletion()
      if (!res.success) setCancelError(true)
      setReloadKey((key) => key + 1)
    } catch {
      setCancelError(true)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="pt-4 mt-2 border-t border-gray-100">
      {pending ? (
        <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-lg text-sm">
          <p className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" /> {t('pendingTitle')}
          </p>
          <p className="mt-1 text-xs text-red-800">
            {t('pendingText', { date: new Date(pending.requested_at).toLocaleDateString(locale) })}
          </p>
          {cancelError && <p className="mt-1 text-xs text-red-700">{t('errorGeneric')}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={cancelRequest}
              disabled={cancelling}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-900 border border-red-300 hover:bg-red-100 disabled:opacity-50"
            >
              {cancelling ? t('cancelling') : t('cancelRequest')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">{t('sectionText')}</p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="shrink-0 text-xs font-medium text-gray-500 hover:text-red-600 underline underline-offset-2 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> {t('openButton')}
          </button>
        </div>
      )}

      {dialogOpen && (
        <AccountDeletionDialog
          onClose={() => setDialogOpen(false)}
          onSent={() => {
            setDialogOpen(false)
            setReloadKey((key) => key + 1)
          }}
        />
      )}
    </div>
  )
}

function AccountDeletionDialog({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const t = useTranslations('accountDeletion')
  const word = t('confirmWord')
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmed = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase()

  const submit = async () => {
    if (!confirmed || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await requestAccountDeletion(reason)
      if (res.success || res.error === 'pending') {
        onSent()
        return
      }
      setError(res.error === 'not_allowed' ? t('errorNotAllowed') : t('errorGeneric'))
    } catch {
      setError(t('errorGeneric'))
    } finally {
      setSending(false)
    }
  }

  const items = ['itemData', 'itemSubscription', 'itemPoints', 'itemEvents', 'itemNetwork', 'itemLegal'] as const

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 text-[var(--ink)]"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{t('dialogTitle')}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t('back')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm text-gray-700">
          <p>{t('intro')}</p>
          <div>
            <p className="font-semibold text-gray-900">{t('whatHappensTitle')}</p>
            <ul className="mt-2 space-y-1.5 list-disc pl-5">
              {items.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>
          <p className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">{t('timing')}</p>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">{t('reasonLabel')}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 1000))}
              rows={3}
              maxLength={1000}
              placeholder={t('reasonPlaceholder')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">{t('confirmLabel', { word })}</span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">
              {t('back')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!confirmed || sending}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-lg font-semibold flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> {sending ? t('submitting') : t('submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
