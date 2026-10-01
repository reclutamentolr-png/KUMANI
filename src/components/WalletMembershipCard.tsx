'use client'

import { useTranslations } from 'next-intl'
import OfferMakerQR from '@/components/OfferMakerQR'
import MembershipShareCard from '@/components/MembershipShareCard'

type Props = {
  firstName: string | null
  lastName: string | null
  memberId: string | null
  memberSince: string
  planLabel: string
  // Tipo di abbonamento attivo (Base, Pro, Pro in prova), mostrato in verde
  planName?: string | null
  rankLabel: string | null
  // Scadenza dell'abbonamento attivo (già formattata), se c'è
  validUntil?: string | null
  qrUrl: string
}

export default function WalletMembershipCard({
  firstName,
  lastName,
  memberId,
  memberSince,
  planLabel,
  planName,
  rankLabel,
  validUntil,
  qrUrl,
}: Props) {
  const t = useTranslations('wallet')

  return (
    <div>
    <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/45 bg-gradient-to-br from-[#1f1d1a] to-[var(--ink)] p-6 text-white shadow-[0_18px_40px_rgba(23,23,23,0.25)]">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--gold)]/15 blur-2xl" />
      <div className="relative z-10 mb-4 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-9 w-9" />
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--gold-bright)]">{t('membershipCardLabel')}</span>
      </div>
      <div className="relative z-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-3">
          <p className="text-2xl font-bold text-white">
            {firstName} {lastName}
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-stone-400">{t('memberId')}</p>
              <p className="font-mono font-semibold text-[var(--gold-bright)]">{memberId}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">{t('memberSince')}</p>
              <p className="font-semibold text-white">{memberSince}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">{t('currentPlan')}</p>
              <p className="flex flex-wrap items-center gap-1.5 font-semibold text-white">
                {planLabel}
                {planName && (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
                    {planName}
                  </span>
                )}
              </p>
              {validUntil && <p className="mt-0.5 text-xs text-stone-400">{t('membershipValidUntil', { date: validUntil })}</p>}
            </div>
            <div>
              <p className="text-xs text-stone-400">{t('currentRank')}</p>
              <p className="font-semibold text-white">{rankLabel || t('noRank')}</p>
            </div>
          </div>
        </div>
        <OfferMakerQR
          url={qrUrl}
          fileName={`member-${memberId}`}
          generatingLabel="..."
          downloadLabel={t('downloadCard')}
          accentClassName="bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-[var(--ink)]"
        />
      </div>
    </div>
    <MembershipShareCard
      firstName={firstName}
      lastName={lastName}
      memberId={memberId}
      planName={planName ?? null}
      rankLabel={rankLabel}
      shareUrl={qrUrl}
    />
    <p className="mt-2 text-center text-xs text-[var(--muted)]">{t('shareCardHint')}</p>
    </div>
  )
}
