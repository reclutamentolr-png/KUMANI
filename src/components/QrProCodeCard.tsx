'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { MousePointerClick, Trash2, Pencil, Link2, MessageCircle, Phone, MessageSquare, Mail, Wifi, Contact } from 'lucide-react'
import { deleteQrCode } from '@/app/actions/qrPro'
import type { QrContentType } from '@/lib/qrPro'
import { askConfirm } from '@/lib/confirm'

type QrCode = {
  id: string
  label: string
  content_type: QrContentType
  click_count: number
  created_at: string
}

const TYPE_ICONS: Record<QrContentType, typeof Link2> = {
  link: Link2,
  whatsapp: MessageCircle,
  phone: Phone,
  sms: MessageSquare,
  email: Mail,
  wifi: Wifi,
  vcard: Contact,
}

export default function QrProCodeCard({ qrCode }: { qrCode: QrCode }) {
  const t = useTranslations('qrCodePro')
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const Icon = TYPE_ICONS[qrCode.content_type]

  const handleDelete = async () => {
    if (!(await askConfirm(t('deleteConfirm')))) return
    setDeleting(true)
    const result = await deleteQrCode(qrCode.id)
    setDeleting(false)
    if (result.success) {
      router.refresh()
    } else {
      alert(t(result.message))
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--gold)]/25 shadow-sm p-5 transition-shadow hover:shadow-md flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-[var(--gold-pale)] text-[var(--gold)] flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--ink)] truncate">{qrCode.label}</h3>
          <p className="text-xs text-gray-500">
            {t(`type_${qrCode.content_type}`)} · {t('createdOn')} {new Date(qrCode.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 text-sm text-gray-600 shrink-0">
        <MousePointerClick className="w-4 h-4 text-[var(--gold)]" />
        {qrCode.click_count} {t('clicks')}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/marketplace/qr-code-pro/${qrCode.id}`}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-all"
        >
          <Pencil className="w-4 h-4" />
          {t('edit')}
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-all disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
