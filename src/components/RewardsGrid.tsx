'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Gift, LoaderCircle, Lock, Sparkles } from 'lucide-react'
import { redeemReward } from '@/app/actions/rewards'

type Reward = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  points_cost: number
}

export default function RewardsGrid({ rewards, initialBalance }: { rewards: Reward[]; initialBalance: number }) {
  const t = useTranslations('rewards')
  const router = useRouter()

  const [balance, setBalance] = useState(initialBalance)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})

  const handleRedeem = async (reward: Reward) => {
    setRedeemingId(reward.id)
    setMessages((prev) => ({ ...prev, [reward.id]: '' }))
    const result = await redeemReward(reward.id)
    setRedeemingId(null)

    if (!result.success) {
      const key =
        result.message === 'insufficient_points'
          ? 'redeemErrorInsufficientPoints'
          : result.message === 'not_available'
            ? 'redeemErrorNotAvailable'
            : result.message === 'not_found'
              ? 'redeemErrorNotFound'
              : 'redeemErrorGeneric'
      setMessages((prev) => ({ ...prev, [reward.id]: t(key) }))
      return
    }

    setBalance(result.balance)
    setMessages((prev) => ({ ...prev, [reward.id]: t('redeemSuccess') }))
    router.refresh()
  }

  if (rewards.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <Gift className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <p className="text-gray-500">{t('emptyState')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-4 py-2 text-sm font-bold text-[var(--ink)]">
        <Sparkles className="h-4 w-4 text-[var(--gold)]" />
        {t('yourBalance', { points: balance })}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((reward) => {
          const affordable = balance >= reward.points_cost
          return (
            <div
              key={reward.id}
              className={`flex flex-col overflow-hidden rounded-xl border shadow-sm transition-all ${
                affordable ? 'border-[var(--gold)]/40 bg-white' : 'border-gray-200 bg-gray-50 opacity-60 grayscale'
              }`}
            >
              <div className="flex h-40 items-center justify-center bg-gray-100">
                {reward.image_url ? (
                  // Foto del premio caricata dallo Staff: <img> semplice
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={reward.image_url} alt={reward.title} className="h-full w-full object-cover" />
                ) : (
                  <Gift className="h-12 w-12 text-gray-300" />
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-bold text-[var(--ink)]">{reward.title}</h3>
                {reward.description && <p className="mt-1 flex-1 text-sm text-gray-600">{reward.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="rounded-full bg-[var(--gold-pale)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">
                    {t('pointsCost', { points: reward.points_cost })}
                  </span>
                  {!affordable && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Lock className="h-3 w-3" />
                      {t('missingPoints', { points: reward.points_cost - balance })}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRedeem(reward)}
                  disabled={!affordable || redeemingId === reward.id}
                  className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--ink-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {redeemingId === reward.id && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {t('redeemButton')}
                </button>
                {messages[reward.id] && <p className="mt-2 text-xs text-[var(--muted)]">{messages[reward.id]}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
