'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle, Sparkles, XCircle } from 'lucide-react'
import { generateOfferDraft } from '@/app/actions/offermaker'
import OfferMakerReview from '@/components/OfferMakerReview'
import BusinessProfileImport from '@/components/businessProfile/BusinessProfileImport'
import { businessFullAddress, type BusinessProfile } from '@/lib/businessProfile'
import {
  OBJECTIVES,
  TONES,
  type GeneratedCampaignDraft,
  type OfferFormAnswers,
  type Objective,
  type Tone,
} from '@/lib/offermaker'

type Props = {
  initialWhatsapp: string
  businessProfile?: BusinessProfile | null
}

const TOTAL_STEPS = 4

// «Dove operi?»: città e provincia della Scheda (l'indirizzo completo solo se manca la città)
function profileLocation(p: BusinessProfile): string {
  const area = p.city ? (p.province ? `${p.city} (${p.province})` : p.city) : businessFullAddress(p)
  return area.slice(0, 500)
}

function emptyAnswers(initialWhatsapp: string, businessProfile: BusinessProfile | null): OfferFormAnswers {
  return {
    whatOffer: '',
    targetAudience: '',
    priceInfo: '',
    locationInfo: businessProfile ? profileLocation(businessProfile) : '',
    strengthPoint: '',
    objective: 'whatsapp',
    tone: 'friendly',
    contactWhatsapp: initialWhatsapp,
  }
}

export default function OfferMakerWizard({ initialWhatsapp, businessProfile = null }: Props) {
  const t = useTranslations('offermaker')
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<OfferFormAnswers>(() => emptyAnswers(initialWhatsapp, businessProfile))
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<GeneratedCampaignDraft | null>(null)

  const setAnswer = <K extends keyof OfferFormAnswers>(key: K, value: OfferFormAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  // «Usa i dati della Scheda attività»: solo i campi che la Scheda ha
  const importBusinessProfile = (p: BusinessProfile) => {
    const whatsapp = (p.whatsapp || p.phone).slice(0, 40)
    const location = profileLocation(p)
    setAnswers((prev) => ({
      ...prev,
      contactWhatsapp: whatsapp || prev.contactWhatsapp,
      locationInfo: location || prev.locationInfo,
    }))
  }

  const canAdvance = (() => {
    if (step === 1) return answers.whatOffer.trim().length > 0
    if (step === 2) return answers.targetAudience.trim().length > 0
    if (step === 3) return answers.strengthPoint.trim().length > 0
    if (step === 4) return answers.contactWhatsapp.trim().length > 0
    return false
  })()

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1)
      return
    }
    handleGenerate()
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const result = await generateOfferDraft(answers)
      if (!result.success) {
        setError(result.message)
        return
      }
      setDraft(result.data)
    } finally {
      setGenerating(false)
    }
  }

  if (draft) {
    return (
      <OfferMakerReview
        mode="create"
        answers={answers}
        initialDraft={draft}
        onBack={() => setDraft(null)}
      />
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_14px_40px_rgba(23,23,23,0.08)] border border-[var(--gold)]/25 p-6 sm:p-8">
      <BusinessProfileImport profile={businessProfile} onImport={importBusinessProfile} className="mb-6" />
      <div className="flex items-center gap-2 mb-6">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full transition-all ${
              s <= step ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]' : 'bg-[var(--gold)]/15'
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('step1Title')}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('whatOfferLabel')}</label>
            <textarea
              value={answers.whatOffer}
              onChange={(e) => setAnswer('whatOffer', e.target.value)}
              placeholder={t('whatOfferPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm text-[var(--ink)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('priceLabel')}</label>
            <input
              type="text"
              value={answers.priceInfo}
              onChange={(e) => setAnswer('priceInfo', e.target.value)}
              placeholder={t('pricePlaceholder')}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm text-[var(--ink)]"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('step2Title')}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('targetAudienceLabel')}</label>
            <textarea
              value={answers.targetAudience}
              onChange={(e) => setAnswer('targetAudience', e.target.value)}
              placeholder={t('targetAudiencePlaceholder')}
              rows={2}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm text-[var(--ink)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('locationLabel')}</label>
            <input
              type="text"
              value={answers.locationInfo}
              onChange={(e) => setAnswer('locationInfo', e.target.value)}
              placeholder={t('locationPlaceholder')}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm text-[var(--ink)]"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('step3Title')}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('strengthPointLabel')}</label>
            <textarea
              value={answers.strengthPoint}
              onChange={(e) => setAnswer('strengthPoint', e.target.value)}
              placeholder={t('strengthPointPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm text-[var(--ink)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('objectiveLabel')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OBJECTIVES.map((obj: Objective) => (
                <button
                  key={obj}
                  type="button"
                  onClick={() => setAnswer('objective', obj)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    answers.objective === obj
                      ? 'border-[var(--ink)] bg-[var(--gold-pale)] text-[var(--ink)]'
                      : 'border-[var(--gold)]/20 text-gray-600 hover:border-[var(--gold)]/60'
                  }`}
                >
                  {t(`objective_${obj}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('step4Title')}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('toneLabel')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TONES.map((tone: Tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setAnswer('tone', tone)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    answers.tone === tone
                      ? 'border-[var(--ink)] bg-[var(--gold-pale)] text-[var(--ink)]'
                      : 'border-[var(--gold)]/20 text-gray-600 hover:border-[var(--gold)]/60'
                  }`}
                >
                  {t(`tone_${tone}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('whatsappNumberLabel')}</label>
            <input
              type="tel"
              value={answers.contactWhatsapp}
              onChange={(e) => setAnswer('contactWhatsapp', e.target.value)}
              placeholder={t('whatsappNumberPlaceholder')}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm text-[var(--ink)]"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-800 text-sm">
          <XCircle className="w-5 h-5 shrink-0" />
          {t(error)}
        </div>
      )}

      <div className="flex items-center gap-3 mt-6">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            disabled={generating}
            className="px-5 py-3 rounded-xl font-medium text-[var(--ink)] border border-[var(--gold)]/40 bg-white hover:bg-[var(--gold-pale)] transition-all disabled:opacity-50"
          >
            {t('back')}
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={!canAdvance || generating}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
        >
          {generating ? (
            <>
              <LoaderCircle className="w-5 h-5 animate-spin" />
              {t('generating')}
            </>
          ) : step < TOTAL_STEPS ? (
            t('next')
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {t('generate')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
