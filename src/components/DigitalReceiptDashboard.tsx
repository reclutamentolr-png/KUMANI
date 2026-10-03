'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { Search, PlusCircle, FileCheck2 } from 'lucide-react'
import DigitalReceiptCard from '@/components/DigitalReceiptCard'
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

export default function DigitalReceiptDashboard({ receipts }: { receipts: Receipt[] }) {
  const t = useTranslations('digitalReceipt')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return receipts
      .filter((r) => (q ? r.object_name.toLowerCase().includes(q) || r.recipient_name.toLowerCase().includes(q) : true))
      .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date))
  }, [receipts, search])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>

        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((receipt) => (
              <DigitalReceiptCard key={receipt.id} receipt={receipt} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-xl border border-dashed border-[var(--gold)]/40 text-[var(--muted)]">
            <FileCheck2 className="w-12 h-12 mx-auto mb-4 text-[var(--gold)]" />
            <p>{receipts.length === 0 ? t('noReceiptsYet') : t('noResults')}</p>
          </div>
        )}
      </div>

      <Link
        href="/marketplace/digital-receipt/new"
        data-fab className="fixed bottom-6 right-6 flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-full font-bold shadow-lg hover:brightness-105 hover:shadow-xl hover:-translate-y-0.5 transition-all"
      >
        <PlusCircle className="w-5 h-5" />
        {t('newReceipt')}
      </Link>
    </div>
  )
}
