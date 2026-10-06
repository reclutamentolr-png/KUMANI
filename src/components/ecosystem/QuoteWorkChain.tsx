'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Boxes, CheckCircle, FileCheck2, LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { unloadQuoteStock } from '@/app/actions/quotes'

// Catena di lavoro del Pro, sotto il preventivo: scarico dei prodotti dal
// Magazzino (una volta sola) e ricevuta di pagamento già compilata.
export default function QuoteWorkChain({
  quoteId,
  showUnload,
  unloadedOn,
  showReceipt,
}: {
  quoteId: string
  showUnload: boolean
  // Data dello scarico già formattata (null = non ancora scaricato)
  unloadedOn: string | null
  showReceipt: boolean
}) {
  const t = useTranslations('ecosystem')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!showUnload && !showReceipt) return null

  const unload = async () => {
    if (!window.confirm(t('quoteUnloadConfirm'))) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await unloadQuoteStock(quoteId)
      // Già scaricato (es. da un'altra scheda): basta ricaricare
      if (res.ok || res.error === 'already') {
        router.refresh()
        return
      }
      setMessage(
        res.error === 'insufficient'
          ? t('quoteUnloadInsufficient', {
              name: res.name ?? '',
              stock: (res.stock ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 }),
            })
          : t('quoteUnloadError')
      )
    } catch {
      setMessage(t('quoteUnloadError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showUnload && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-[var(--ink)]">{t('quoteUnloadTitle')}</p>
              <p className="text-sm text-[var(--muted)]">
                {unloadedOn ? t('quoteUnloadDone', { date: unloadedOn }) : t('quoteUnloadHint')}
              </p>
            </div>
          </div>
          {unloadedOn ? (
            <CheckCircle className="h-5 w-5 text-green-600" aria-hidden />
          ) : (
            <button
              type="button"
              onClick={unload}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-[var(--gold-bright)] hover:brightness-110 disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
              {t('quoteUnloadButton')}
            </button>
          )}
          {message && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {message}
            </p>
          )}
        </div>
      )}

      {showReceipt && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gold-pale)] text-[var(--gold)]">
              <FileCheck2 className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-[var(--ink)]">{t('quoteToReceiptTitle')}</p>
              <p className="text-sm text-[var(--muted)]">{t('quoteToReceiptHint')}</p>
            </div>
          </div>
          <Link
            href={`/marketplace/digital-receipt/new?fromQuote=${quoteId}`}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] hover:brightness-105"
          >
            <FileCheck2 className="h-4 w-4" />
            {t('quoteToReceiptButton')}
          </Link>
        </div>
      )}
    </div>
  )
}
