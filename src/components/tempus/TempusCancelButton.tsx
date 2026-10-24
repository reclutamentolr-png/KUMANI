'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import { cancelTempusByToken } from '@/app/actions/tempus'
import { askConfirm } from '@/lib/confirm'

export default function TempusCancelButton({ token }: { token: string }) {
  const t = useTranslations('tempus')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<'idle' | 'done' | 'tooLate' | 'error'>('idle')

  const cancel = async () => {
    if (!(await askConfirm(t('manageConfirm')))) return
    setBusy(true)
    const res = await cancelTempusByToken(token)
    setBusy(false)
    setState(res.success ? 'done' : res.reason === 'tooLate' ? 'tooLate' : 'error')
  }

  if (state === 'done') return <p className="mt-4 font-semibold text-green-700">{t('manageDone')}</p>
  return (
    <div className="mt-5">
      <button type="button" onClick={cancel} disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-5 font-bold text-white disabled:opacity-50">
        {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
        {t('manageCancelButton')}
      </button>
      {state === 'tooLate' && <p className="mt-3 text-sm text-red-700">{t('manageTooLateShort')}</p>}
      {state === 'error' && <p className="mt-3 text-sm text-red-700">{t('error_saveError')}</p>}
    </div>
  )
}
