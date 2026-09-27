'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckCircle, LoaderCircle, XCircle } from 'lucide-react'
import { publishOfferCampaign, updateOfferCampaign } from '@/app/actions/offermaker'
import type { GeneratedCampaignDraft, OfferFormAnswers } from '@/lib/offermaker'

type Props =
  | {
      mode: 'create'
      answers: OfferFormAnswers
      initialDraft: GeneratedCampaignDraft
      onBack: () => void
    }
  | {
      mode: 'edit'
      campaignId: string
      initialDraft: GeneratedCampaignDraft
    }

const FIELD_ORDER: Array<{ key: keyof GeneratedCampaignDraft; labelKey: string; multiline: boolean }> = [
  { key: 'campaignTitle', labelKey: 'campaignTitleLabel', multiline: false },
  { key: 'headline', labelKey: 'headlineLabel', multiline: false },
  { key: 'offerSummary', labelKey: 'offerSummaryLabel', multiline: false },
  { key: 'description', labelKey: 'descriptionLabel', multiline: true },
  { key: 'ctaLabel', labelKey: 'ctaLabelLabel', multiline: false },
  { key: 'whatsappMessageSoft', labelKey: 'whatsappSoftLabel', multiline: true },
  { key: 'whatsappMessageDirect', labelKey: 'whatsappDirectLabel', multiline: true },
  { key: 'whatsappMessageFollowup', labelKey: 'whatsappFollowupLabel', multiline: true },
]

export default function OfferMakerReview(props: Props) {
  const t = useTranslations('offermaker')
  const router = useRouter()
  const [draft, setDraft] = useState<GeneratedCampaignDraft>(props.initialDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const setField = (key: keyof GeneratedCampaignDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      if (props.mode === 'create') {
        const result = await publishOfferCampaign(props.answers, draft)
        if (!result.success) {
          setError(result.message)
          return
        }
        router.push(`/marketplace/offermaker/campaigns/${result.data.id}`)
      } else {
        const result = await updateOfferCampaign(props.campaignId, draft)
        if (!result.success) {
          setError(result.message)
          return
        }
        setSaved(true)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_14px_40px_rgba(23,23,23,0.08)] border border-[var(--gold)]/25 p-6 sm:p-8 space-y-6">
      <h3 className="text-lg font-bold text-[var(--ink)]">{t('reviewTitle')}</h3>

      <div className="space-y-4">
        {FIELD_ORDER.map(({ key, labelKey, multiline }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t(labelKey)}</label>
            {multiline ? (
              <textarea
                value={draft[key]}
                onChange={(e) => setField(key, e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm text-[var(--ink)]"
              />
            ) : (
              <input
                type="text"
                value={draft[key]}
                onChange={(e) => setField(key, e.target.value)}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm text-[var(--ink)]"
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-800 text-sm">
          <XCircle className="w-5 h-5 shrink-0" />
          {t(error)}
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2 text-green-800 text-sm">
          <CheckCircle className="w-5 h-5 shrink-0" />
          {t('publishSuccess')}
        </div>
      )}

      <div className="flex items-center gap-3">
        {props.mode === 'create' && (
          <button
            onClick={props.onBack}
            disabled={saving}
            className="px-5 py-3 rounded-xl font-medium text-[var(--ink)] border border-[var(--gold)]/40 bg-white hover:bg-[var(--gold-pale)] transition-all disabled:opacity-50"
          >
            {t('back')}
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
        >
          {saving ? (
            <>
              <LoaderCircle className="w-5 h-5 animate-spin" />
              {props.mode === 'create' ? t('publishing') : t('saving')}
            </>
          ) : props.mode === 'create' ? (
            t('publish')
          ) : (
            t('saveChanges')
          )}
        </button>
      </div>
    </div>
  )
}
