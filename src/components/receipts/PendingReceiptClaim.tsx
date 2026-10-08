'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BookmarkCheck, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { claimReceipt } from '@/app/actions/digitalReceipt'
import { PENDING_RECEIPT_KEY } from '@/components/receipts/ReceiptSaveBox'

// Dopo la registrazione partita da una ricevuta («Salvala gratis nel tuo
// account»): al primo ingresso la ricevuta si salva da sola e un avviso la
// mostra. Nella dashboard.
export default function PendingReceiptClaim() {
  const t = useTranslations('digitalReceipt')
  const [code, setCode] = useState<string | null>(null)

  useEffect(() => {
    let pending: string | null = null
    try {
      pending = localStorage.getItem(PENDING_RECEIPT_KEY)
    } catch {
      return
    }
    if (!pending || !/^[A-Za-z0-9]{4,20}$/.test(pending)) return
    claimReceipt(pending).then((r) => {
      if (r === 'login') return // ancora senza accesso: si riprova al prossimo ingresso
      try {
        localStorage.removeItem(PENDING_RECEIPT_KEY)
      } catch {
        /* niente */
      }
      if (r === 'saved') setCode(pending)
    })
  }, [])

  if (!code) return null
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <BookmarkCheck className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">{t('pendingSaved')}</span>
      <Link href={`/ricevute/${code}`} className="shrink-0 font-bold underline">
        {t('pendingOpen')}
      </Link>
      <button type="button" onClick={() => setCode(null)} aria-label={t('pendingClose')} className="shrink-0 rounded-lg p-1 hover:bg-emerald-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
