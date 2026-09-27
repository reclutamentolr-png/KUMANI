'use client'

import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink'
import {
  Package,
  Handshake,
  Undo2,
  Banknote,
  Vault,
  Tag,
  KeyRound,
  FileText,
  Wrench,
} from 'lucide-react'
import type { ReceiptTemplate } from '@/lib/digitalReceipt'

type Receipt = {
  id: string
  template: ReceiptTemplate
  object_name: string
  recipient_name: string
  delivery_date: string
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

export default function DigitalReceiptCard({ receipt }: { receipt: Receipt }) {
  const t = useTranslations('digitalReceipt')
  const Icon = TEMPLATE_ICONS[receipt.template]

  const statusLabel = receipt.returned_at
    ? t('statusReturned')
    : receipt.confirmed_at
      ? t('statusConfirmed')
      : t('statusPending')
  const statusColor = receipt.returned_at
    ? 'bg-[var(--ink)] text-[var(--gold-bright)]'
    : receipt.confirmed_at
      ? 'bg-green-100 text-green-700'
      : 'bg-amber-100 text-amber-800'

  return (
    <div className="bg-white rounded-xl border border-[var(--gold)]/20 shadow-sm hover:border-[var(--gold)]/50 transition-colors p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-[var(--gold-pale)] text-[var(--gold)] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)] truncate">{receipt.object_name}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColor}`}>{statusLabel}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {t('to')} {receipt.recipient_name} · {new Date(receipt.delivery_date).toLocaleDateString()}
        </p>
      </div>

      <Link
        href={`/marketplace/digital-receipt/${receipt.id}`}
        className="px-3 py-2 rounded-lg text-sm font-medium border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)] transition-all shrink-0"
      >
        {t('details')}
      </Link>
    </div>
  )
}
