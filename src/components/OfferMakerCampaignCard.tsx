'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { MousePointerClick, Trash2, Pencil, ExternalLink } from 'lucide-react'
import { deleteOfferCampaign } from '@/app/actions/offermaker'

type Campaign = {
  id: string
  code: string
  campaign_title: string
  status: 'draft' | 'published' | 'archived'
  click_count: number
  created_at: string
}

export default function OfferMakerCampaignCard({ campaign }: { campaign: Campaign }) {
  const t = useTranslations('offermaker')
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(t('deleteConfirm'))) return
    setDeleting(true)
    const result = await deleteOfferCampaign(campaign.id)
    setDeleting(false)
    if (result.success) {
      router.refresh()
    } else {
      alert(t(result.message))
    }
  }

  const statusLabel =
    campaign.status === 'published'
      ? t('statusPublished')
      : campaign.status === 'archived'
        ? t('statusArchived')
        : t('statusDraft')

  const statusColor =
    campaign.status === 'published'
      ? 'bg-green-100 text-green-800'
      : campaign.status === 'archived'
        ? 'bg-gray-100 text-gray-600'
        : 'bg-amber-100 text-amber-800'

  return (
    <div className="bg-white rounded-2xl border border-[var(--gold)]/25 shadow-sm p-5 transition-shadow hover:shadow-md flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-[var(--ink)] truncate">{campaign.campaign_title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {t('createdOn')} {new Date(campaign.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="flex items-center gap-1 text-sm text-gray-600 shrink-0">
        <MousePointerClick className="w-4 h-4 text-[var(--gold)]" />
        {campaign.click_count} {t('clicks')}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Link
          href={`/marketplace/offermaker/campaigns/${campaign.id}`}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-all"
        >
          <Pencil className="w-4 h-4" />
          {t('editCampaign')}
        </Link>
        <a
          href={`/offerte/${campaign.code}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--gold)]/40 text-[var(--ink)] hover:bg-[var(--gold-pale)] transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          {t('viewLanding')}
        </a>
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
