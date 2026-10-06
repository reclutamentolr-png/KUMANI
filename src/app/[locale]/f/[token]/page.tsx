import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import QRCode from 'qrcode'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import { Clock, Gift, PartyPopper, Star, Wallet } from 'lucide-react'
import RememberFidelityCard from '@/components/fidelity/RememberFidelityCard'
import FidelityContactForm from '@/components/fidelity/FidelityContactForm'
import { getFidelityServiceClient } from '@/lib/fidelity-server'
import { createClient } from '@/lib/supabase/server'
import { FIDELITY_MEMBER_QR_PREFIX, effectiveStamps, isFutureDate, stampsExpireAt } from '@/lib/fidelity'

type MemberRow = {
  member_code: string
  stamps_count: number
  last_stamp_at: string | null
  rewards_redeemed: number
  customer_name: string | null
  contact_phone: string | null
  marketing_consent: boolean
  review_bonus_at: string | null
  fidelity_cards: {
    business_name: string
    prize: string
    stamps_needed: number
    stamps_expire_days: number | null
    review_url: string | null
  } | null
}

// Kumi Card pubblica del cliente: chi ha il link (token segreto) vede la
// tessera. Nessun account; contatti solo se il cliente li aggiunge.
export default async function FidelityCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ esito?: string }>
}) {
  const { token } = await params
  const { esito } = await searchParams
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound()

  const t = await getTranslations('fidelity')
  const locale = await getLocale()
  // Kumano con l'accesso: la tessera si lega al suo account (RememberFidelityCard)
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  const { data: member } = await getFidelityServiceClient()
    .from('fidelity_members')
    .select(
      'member_code, stamps_count, last_stamp_at, rewards_redeemed, customer_name, contact_phone, marketing_consent, review_bonus_at, fidelity_cards(business_name, prize, stamps_needed, stamps_expire_days, review_url)'
    )
    .eq('token', token)
    .maybeSingle<MemberRow>()
  if (!member?.fidelity_cards) notFound()

  const card = member.fidelity_cards
  const stamps = effectiveStamps(card, member)
  const complete = stamps >= card.stamps_needed
  const missing = Math.max(0, card.stamps_needed - stamps)
  const expiry = stampsExpireAt(card, member)
  const memberQr = await QRCode.toDataURL(`${FIDELITY_MEMBER_QR_PREFIX}${member.member_code}`, { width: 360, margin: 1 })

  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-8">
      <RememberFidelityCard token={token} />
      <div className="mx-auto max-w-md space-y-5">
        {esito === 'ok' && (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-center font-bold text-green-700">
            <PartyPopper className="h-5 w-5" /> {t('stampReceived')}
          </p>
        )}
        {esito === 'redeemed' && (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-center font-bold text-green-700">
            <Gift className="h-5 w-5" /> {t('prizeReceived')}
          </p>
        )}

        <div className="rounded-3xl border border-[var(--gold)]/30 bg-gradient-to-br from-[#2a2721] to-[var(--ink)] p-6 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">Kumi Card</p>
              <h1 className="mt-1 text-2xl font-bold">{card.business_name}</h1>
            </div>
            <Logo size={48} className="h-12 w-12" />
          </div>

          {/* I timbri sono medaglioni KUMANI che si "accendono". */}
          <div className="mt-6 grid grid-cols-5 gap-3">
            {Array.from({ length: card.stamps_needed }, (_, i) => {
              const on = i < stamps
              return (
                <div
                  key={i}
                  className={`flex aspect-square items-center justify-center rounded-full border-2 ${
                    on ? 'border-[var(--gold-bright)] bg-[var(--gold)]/20' : 'border-dashed border-white/20'
                  }`}
                >
                  {on ? <Logo size={40} className="h-4/5 w-4/5" /> : <span className="text-xs text-white/30">{i + 1}</span>}
                </div>
              )
            })}
          </div>

          <div className="mt-6 rounded-xl bg-white/5 p-4 text-center">
            <p className="text-sm text-white/60">{t('prizeLabel')}</p>
            <p className="text-lg font-bold text-[var(--gold-bright)]">{card.prize}</p>
            <p className="mt-2 text-sm text-white/80">{complete ? t('prizeReady') : t('missingStamps', { count: missing })}</p>
            {isFutureDate(expiry) && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-white/60">
                <Clock className="h-3.5 w-3.5" /> {t('stampsExpireOn', { date: expiry.toLocaleDateString(locale) })}
              </p>
            )}
          </div>
        </div>

        {card.review_url && !member.review_bonus_at && !complete && (
          <div className="rounded-2xl border border-[var(--gold)]/30 bg-white/5 p-5 text-center text-white">
            <Star className="mx-auto mb-2 h-6 w-6 text-[var(--gold-bright)]" fill="currentColor" />
            <p className="font-semibold">{t('reviewCtaTitle')}</p>
            <p className="mt-1 text-sm text-white/70">{t('reviewCtaText')}</p>
            <a
              href={card.review_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 text-sm font-bold text-[var(--ink)]"
            >
              {t('reviewCtaButton')}
            </a>
          </div>
        )}

        <div className="rounded-2xl bg-[var(--paper)] p-5 text-center">
          <p className="font-semibold text-[var(--ink)]">{complete ? t('showForPrize') : t('howToStamp')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={memberQr} alt="QR" className="mx-auto mt-3 w-40 rounded-lg" />
          <p className="mt-2 font-mono text-lg font-bold tracking-widest text-[var(--ink)]">{member.member_code}</p>
        </div>

        <FidelityContactForm
          token={token}
          businessName={card.business_name}
          initial={{
            customerName: member.customer_name ?? '',
            phone: member.contact_phone ?? '',
            marketingConsent: member.marketing_consent,
          }}
        />

        {user ? (
          <Link href="/wallet#fidelity" className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-[var(--gold-bright)]">
            <Wallet className="h-4 w-4 shrink-0" /> {t('savedInKumaniWallet')}
          </Link>
        ) : (
          <Link href="/f" className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--gold-bright)]">
            <Wallet className="h-4 w-4" /> {t('myCards')}
          </Link>
        )}
        <p className="text-center text-xs text-white/40">{t('poweredBy')}</p>
      </div>
    </div>
  )
}
