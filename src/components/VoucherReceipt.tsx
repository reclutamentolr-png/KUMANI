'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LoaderCircle, Printer } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { updateVoucherSale } from '@/app/actions/vouchers'

// Ricevuta di cessione di un voucher KUMANI: il venditore (Kumano) inserisce
// acquirente e prezzo, salva e stampa o salva in PDF dal browser. La vendita
// è tra il Kumano e l'acquirente: KUMANI non ne è parte.
export default function VoucherReceipt({
  voucher,
  seller,
}: {
  voucher: { id: string; code: string; plan: 'base' | 'pro'; priceCents: number | null; buyerName: string | null; soldAt: string }
  seller: { name: string; taxCode: string | null; address: string | null }
}) {
  const t = useTranslations('voucherReceipt')
  const locale = useLocale()
  const router = useRouter()
  const [buyer, setBuyer] = useState(voucher.buyerName ?? '')
  const [price, setPrice] = useState(voucher.priceCents !== null ? String(voucher.priceCents / 100) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<boolean | null>(null)

  const priceCents = price.trim() ? Math.round(Number(price.replace(',', '.')) * 100) : null
  const priceValid = priceCents === null || (Number.isFinite(priceCents) && priceCents >= 0)
  const euro = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(voucher.soldAt))
  const planName = voucher.plan === 'pro' ? 'KUMANI Pro' : 'KUMANI Base'

  const save = async () => {
    if (!priceValid) return
    setSaving(true)
    const result = await updateVoucherSale(voucher.id, { buyerName: buyer, priceCents })
    setSaving(false)
    setSaved(result.success)
    if (result.success) router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Modulo (non stampato) */}
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 print:hidden">
          <Link href="/wallet" className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-[var(--gold)]">
            <ArrowLeft className="h-4 w-4" /> {t('back')}
          </Link>
          <p className="text-sm text-gray-600">{t('intro')}</p>
          <label className="block text-sm text-gray-700">
            {t('buyerLabel')}
            <input
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-gray-700">
            {t('priceLabel')}
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-48"
            />
          </label>
          {!priceValid && <p className="text-sm text-red-600">{t('priceInvalid')}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={save}
              disabled={saving || !priceValid}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('save')}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
            >
              <Printer className="h-4 w-4" /> {t('print')}
            </button>
          </div>
          {saved !== null && <p className={`text-sm ${saved ? 'text-emerald-600' : 'text-red-600'}`}>{saved ? t('saved') : t('saveError')}</p>}
        </div>

        {/* Ricevuta */}
        <div className="rounded-xl border border-gray-300 bg-white p-6 text-sm text-gray-800 print:rounded-none print:border-0">
          <h1 className="text-lg font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-xs text-gray-500">{t('dateLine', { date })}</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('sellerTitle')}</p>
              <p className="mt-1 font-semibold">{seller.name || '—'}</p>
              {seller.taxCode && <p>{t('taxCode', { code: seller.taxCode })}</p>}
              {seller.address && <p>{seller.address}</p>}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('buyerTitle')}</p>
              <p className="mt-1 font-semibold">{buyer.trim() || '____________________'}</p>
            </div>
          </div>

          <table className="mt-6 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2">{t('description')}</th>
                <th className="py-2 text-right">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-3">
                  {t('item', { plan: planName })}
                  <br />
                  <span className="text-xs text-gray-500">{t('codeLine', { code: voucher.code })}</span>
                </td>
                <td className="py-3 text-right font-semibold">{priceValid && priceCents !== null ? euro(priceCents) : t('free')}</td>
              </tr>
            </tbody>
          </table>

          <p className="mt-6 text-xs leading-5 text-gray-500">{t('disclaimer')}</p>

          <div className="mt-10 grid grid-cols-2 gap-8 text-xs text-gray-500">
            <div className="border-t border-gray-400 pt-1">{t('sellerSignature')}</div>
            <div className="border-t border-gray-400 pt-1">{t('buyerSignature')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
