'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatReceiptValue } from '@/lib/digitalReceipt'
import { CheckCircle2, Package, Handshake, Undo2, Banknote, Vault, Tag, KeyRound, FileText, Wrench, Clock } from 'lucide-react'
import { confirmReceipt } from '@/app/actions/digitalReceiptPublic'
import type { ReceiptTemplate } from '@/lib/digitalReceipt'

interface PublicReceipt {
  code: string
  template: ReceiptTemplate
  object_name: string
  serial_number: string | null
  recipient_name: string
  delivery_date: string
  reason: string | null
  notes: string | null
  quantity: number | null
  declared_value: number | null
  vat_mode?: string | null
  // Intestazione di chi emette la ricevuta (Scheda attività), se mostrata
  issuer_company?: string | null
  issuer_vat?: string | null
  issuer_address?: string | null
  issuer_city?: string | null
  issuer_postal_code?: string | null
  issuer_province?: string | null
  issuer_phone?: string | null
  issuer_email?: string | null
  issuer_logo_url?: string | null
  expected_return_date: string | null
  photo_url: string | null
  confirmed_at: string | null
  returned_at: string | null
}

const TEMPLATE_ICONS: Record<ReceiptTemplate, typeof Package> = {
  delivery: Package,
  loan: Handshake,
  return: Undo2,
  declared_payment: Banknote,
  deposit: Vault,
  private_sale: Tag,
  keys: KeyRound,
  documents: FileText,
  company_equipment: Wrench,
}

export default function DigitalReceiptPublicView({ receipt: initial }: { receipt: PublicReceipt }) {
  const t = useTranslations('digitalReceipt')
  const locale = useLocale()
  const [receipt, setReceipt] = useState(initial)
  // Testi adatti al tipo di ricevuta (es. pagamento: «Importo pagato», «Confermo il pagamento indicato»)
  const byTemplate = (key: string) => (t.has(`${key}_${receipt.template}`) ? t(`${key}_${receipt.template}`) : t(key))
  const issuerAddress = [receipt.issuer_address, [receipt.issuer_postal_code, receipt.issuer_city].filter(Boolean).join(' '), receipt.issuer_province ? `(${receipt.issuer_province})` : '']
    .filter(Boolean)
    .join(', ')
  const hasIssuer = !!(receipt.issuer_company || receipt.issuer_logo_url)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const Icon = TEMPLATE_ICONS[receipt.template]

  const handleConfirm = async () => {
    setConfirming(true)
    setError(null)
    const result = await confirmReceipt(receipt.code)
    setConfirming(false)
    if (!result.success) {
      setError(result.message)
      return
    }
    setReceipt((prev) => ({ ...prev, confirmed_at: result.confirmedAt }))
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 overflow-hidden">
        {hasIssuer && (
          <div className="flex items-center gap-4 border-b border-[var(--gold)]/20 bg-white p-5">
            {receipt.issuer_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receipt.issuer_logo_url} alt="" className="h-14 w-auto max-w-[8rem] shrink-0 object-contain" />
            )}
            <div className="min-w-0 text-sm">
              {receipt.issuer_company && <p className="font-bold text-[var(--ink)]">{receipt.issuer_company}</p>}
              {issuerAddress && <p className="text-xs text-gray-500">{issuerAddress}</p>}
              {receipt.issuer_vat && <p className="text-xs text-gray-500">{receipt.issuer_vat}</p>}
              {(receipt.issuer_phone || receipt.issuer_email) && (
                <p className="text-xs text-gray-500">{[receipt.issuer_phone, receipt.issuer_email].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </div>
        )}
        <div className="bg-[var(--ink)] p-6 text-white text-center border-b-2 border-[var(--gold)]">
          <div className="inline-flex items-center gap-2 bg-[var(--gold)]/15 text-[var(--gold-bright)] px-3 py-1 rounded-full text-xs font-medium mb-3">
            <Icon className="w-3.5 h-3.5" />
            {t(`template_${receipt.template}`)}
          </div>
          <h1 className="text-2xl font-bold">{receipt.object_name}</h1>
          <p className="text-[var(--gold-bright)] text-sm mt-1">#{receipt.code}</p>
        </div>

        {receipt.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={receipt.photo_url} alt="" className="w-full h-48 object-cover" />
        )}

        <div className="p-6 space-y-3 text-sm">
          {receipt.serial_number && (
            <div className="flex justify-between border-b border-[var(--gold)]/15 pb-2">
              <span className="text-gray-500">{t('serialField')}</span>
              <span className="text-[var(--ink)] font-medium">{receipt.serial_number}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-[var(--gold)]/15 pb-2">
            <span className="text-gray-500">{byTemplate('recipientField')}</span>
            <span className="text-[var(--ink)] font-medium">{receipt.recipient_name}</span>
          </div>
          <div className="flex justify-between border-b border-[var(--gold)]/15 pb-2">
            <span className="text-gray-500">{t('dateField')}</span>
            <span className="text-[var(--ink)] font-medium">{new Date(receipt.delivery_date).toLocaleDateString()}</span>
          </div>
          {receipt.reason && (
            <div className="flex justify-between border-b border-[var(--gold)]/15 pb-2">
              <span className="text-gray-500">{t('reasonField')}</span>
              <span className="text-[var(--ink)] font-medium">{receipt.reason}</span>
            </div>
          )}
          {receipt.quantity !== null && (
            <div className="flex justify-between border-b border-[var(--gold)]/15 pb-2">
              <span className="text-gray-500">{t('quantityField')}</span>
              <span className="text-[var(--ink)] font-medium">{receipt.quantity}</span>
            </div>
          )}
          {receipt.declared_value !== null && (
            <div className="flex justify-between border-b border-[var(--gold)]/15 pb-2">
              <span className="text-gray-500">{byTemplate('valueField')}</span>
              <span className="text-[var(--ink)] font-medium">
                {formatReceiptValue(receipt.declared_value, receipt.vat_mode, locale, { plus: t('vatPlus'), included: t('vatIncluded') })}
              </span>
            </div>
          )}
          {receipt.expected_return_date && (
            <div className="flex justify-between border-b border-[var(--gold)]/15 pb-2">
              <span className="text-gray-500">{t('expectedReturnField')}</span>
              <span className="text-[var(--ink)] font-medium">{new Date(receipt.expected_return_date).toLocaleDateString()}</span>
            </div>
          )}
          {receipt.notes && (
            <div className="pt-2">
              <p className="text-gray-500 mb-1">{t('notesField')}</p>
              <p className="text-gray-800">{receipt.notes}</p>
            </div>
          )}
        </div>

        <div className="p-6 pt-0">
          {receipt.returned_at ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--ink)] text-[var(--gold-bright)] font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              {t('returnedOn', { date: new Date(receipt.returned_at).toLocaleDateString() })}
            </div>
          ) : receipt.confirmed_at ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 text-green-700 font-semibold border border-green-200">
              <CheckCircle2 className="w-5 h-5" />
              {t('confirmedOn', { date: new Date(receipt.confirmed_at).toLocaleDateString() })}
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  {t(error)}
                </div>
              )}
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
              >
                {confirming ? <Clock className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {byTemplate('confirmReceipt')}
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center pb-6 px-6">{t('disclaimer')}</p>
      </div>
    </div>
  )
}
