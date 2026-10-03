'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Flag, X } from 'lucide-react'
import { reportLanding } from '@/app/actions/landing'
import { REPORT_REASONS, type ReportReason } from '@/lib/landing'

// "Segnala" in fondo alla Landing Page: arriva allo Staff (Admin → Landing Page)
export default function ReportLandingButton({ slug, locale }: { slug: string; locale: string }) {
  const t = useTranslations('landingPublic')
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('scam')
  const [details, setDetails] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const send = async () => {
    setState('sending')
    const r = await reportLanding(slug, reason, details)
    setState(r.success ? 'sent' : 'error')
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 underline opacity-80 hover:opacity-100">
        <Flag className="h-3.5 w-3.5" /> {t('report')}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="report-title" lang={locale}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-gray-900 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="report-title" className="text-lg font-bold">
                {t('reportTitle')}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" aria-label={t('reportCancel')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {state === 'sent' ? (
              <p className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{t('reportThanks')}</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-gray-600">{t('reportIntro')}</p>
                <fieldset className="space-y-2">
                  {REPORT_REASONS.map((r) => (
                    <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4" />
                      {t(`reason_${r}`)}
                    </label>
                  ))}
                </fieldset>
                <label className="mt-3 block text-sm font-semibold">
                  {t('reportDetails')}
                  <textarea className="mt-1 w-full rounded-xl border border-gray-300 p-2 font-normal" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
                </label>
                {state === 'error' && <p className="mt-2 text-sm text-red-600">{t('reportError')}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold">
                    {t('reportCancel')}
                  </button>
                  <button type="button" onClick={send} disabled={state === 'sending'} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {t('reportSend')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
