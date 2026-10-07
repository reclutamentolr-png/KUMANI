'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Award, Check, ChevronDown, Copy, LoaderCircle, Printer, Receipt, Share2, Star, Ticket } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { redeemVoucher, type MyVoucher } from '@/app/actions/vouchers'
import type { RankDefinition } from '@/lib/ranks'

function buildWhatsAppHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

type Rules = { base: number; pro: number; upgrade: number; welcomeBase: number; welcomePro: number; welcomeFrom: number }

// Voucher e KU Points nel Wallet:
// 1. come si guadagnano i KU Points;
// 2. qualifiche e premi (voucher automatici);
// 3. i voucher ricevuti in premio, da regalare (o vendere, con la ricevuta);
// 4. riscatto di un voucher ricevuto da qualcuno.
export default function WalletVoucherSection({
  points,
  rules,
  ranks,
  blackPlusEvery,
  initialVouchers,
  pendingPoints,
  confirmDays,
}: {
  points: number
  // KU Points ancora in conferma (pagamenti di meno di confirmDays giorni)
  pendingPoints: number
  confirmDays: number
  rules: Rules
  ranks: RankDefinition[]
  blackPlusEvery: number
  initialVouchers: MyVoucher[]
}) {
  const t = useTranslations('voucherWallet')
  const tw = useTranslations('wallet')
  const td = useTranslations('dashboard')
  const locale = useLocale()
  const router = useRouter()
  const euro = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)

  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemMessage, setRedeemMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const vouchers = initialVouchers
  const available = vouchers.filter((v) => v.status === 'active').length

  // Voucher raggruppati per premio, in box da aprire: Kuman Green, Star,
  // Black, poi i voucher Black continuo e infine gli altri
  const STAR_CLASS = { green: 'fill-emerald-500 text-emerald-500', gold: 'fill-amber-400 text-amber-400', black: 'fill-gray-900 text-gray-900' } as const
  const groups = [
    ...ranks.map((r) => ({ key: r.key, title: t('groupPrize', { rank: td(r.labelKey) }), star: STAR_CLASS[r.color], items: vouchers.filter((v) => v.prize_key === r.key) })),
    { key: 'black_plus', title: t('prizeBlackPlus'), star: STAR_CLASS.black, items: vouchers.filter((v) => v.prize_key?.startsWith('black_plus_')) },
    { key: 'other', title: t('groupOther'), star: null, items: vouchers.filter((v) => !v.prize_key || (!v.prize_key.startsWith('black_plus_') && !ranks.some((r) => r.key === v.prize_key))) },
  ].filter((g) => g.items.length > 0)

  const prizeName = (key: string | null) => {
    if (!key) return null
    if (key.startsWith('black_plus_')) return t('prizeBlackPlus')
    const rank = ranks.find((r) => r.key === key)
    return rank ? td(rank.labelKey) : null
  }

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Appunti non disponibili: il codice è comunque a schermo
    }
  }

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return
    setBusy(true)
    setRedeemMessage(null)
    const result = await redeemVoucher(redeemCode)
    setBusy(false)
    if (!result.success) {
      const errorKey =
        result.message === 'already_used'
          ? 'voucherRedeemErrorUsed'
          : result.message === 'self_redemption'
            ? 'voucherRedeemErrorSelf'
            : result.message === 'not_found'
              ? 'voucherRedeemErrorNotFound'
              : 'voucherRedeemErrorGeneric'
      setRedeemMessage({ ok: false, text: tw(errorKey) })
      return
    }
    setRedeemMessage({ ok: true, text: tw('voucherRedeemSuccess', { date: new Date(result.expiresAt).toLocaleDateString(locale) }) })
    setRedeemCode('')
    router.refresh()
  }

  const statusLabel = (status: string) =>
    status === 'redeemed' ? tw('voucherStatusRedeemed') : status === 'revoked' ? t('statusCancelled') : tw('voucherStatusActive')
  const statusClass = (status: string) =>
    status === 'redeemed' ? 'bg-gray-100 text-gray-500' : status === 'revoked' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'

  return (
    <div className="space-y-6">
      {/* Saldi */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-[var(--muted)]">{t('pointsBalance')}</p>
          <p className="text-2xl font-bold text-[var(--ink)]">{points}</p>
          <p className="text-xs font-semibold text-emerald-700">{t('pointsConfirmed', { count: Math.max(points - pendingPoints, 0) })}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-[var(--muted)]">{t('vouchersAvailable')}</p>
          <p className="text-2xl font-bold text-[var(--ink)]">{available}</p>
        </div>
      </div>

      <p className="-mt-3 text-xs leading-5 text-[var(--muted)]">{t('pointsConfirmNote', { days: confirmDays })}</p>

      {/* 1. Come si guadagnano i KU Points */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-[var(--ink)]">{t('rulesTitle')}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>{t('ruleBase', { points: rules.base })}</li>
          <li>{t('rulePro', { points: rules.pro })}</li>
          <li>{t('ruleUpgrade', { points: rules.upgrade })}</li>
          <li>{t('ruleWelcomeGive', { from: rules.welcomeFrom, base: rules.welcomeBase, pro: rules.welcomePro, baseKeep: rules.base - rules.welcomeBase, proKeep: rules.pro - rules.welcomePro })}</li>
          <li>{t('ruleWelcomeGet', { base: rules.welcomeBase, pro: rules.welcomePro })}</li>
          {/* Tetto naturale: solo le persone accolte nei 5 posti diretti */}
          <li className="font-semibold text-[var(--ink)]">{t('ruleWelcomeCap', { maxBase: rules.welcomeBase * 5, maxPro: rules.welcomePro * 5 })}</li>
          <li>{t('rulePass')}</li>
        </ul>
      </div>

      {/* 2. Qualifiche e premi */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <Award className="h-4 w-4 text-[var(--gold)]" /> {t('qualificationsTitle')}
        </p>
        <ul className="space-y-2 text-sm">
          {ranks.map((rank) => (
            <li key={rank.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg bg-[var(--gold-pale)]/40 px-3 py-2">
              <span className="font-bold text-[var(--ink)]">{td(rank.labelKey)}</span>
              <span className="text-[var(--muted)]">{t('qualificationRequirement', { acts: rank.activations, points: rank.points })}</span>
              <span className="w-full text-xs font-semibold text-[var(--gold)]">
                {t('qualificationPrize', { count: rank.vouchers })}
                {rank.key === 'diamond_star' ? ` ${t('qualificationPrizeBlack')}` : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t('qualificationsNote', { every: blackPlusEvery })}</p>
      </div>

      {/* 3. Voucher ricevuti in premio: in evidenza */}
      <div className="rounded-2xl border-2 border-[var(--gold)]/60 bg-gradient-to-br from-[var(--gold-pale)] to-white p-4 shadow-[0_10px_30px_rgba(199,154,59,0.18)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2.5 text-lg font-extrabold text-[var(--ink)] sm:text-xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)] shadow">
              <Ticket className="h-5 w-5" />
            </span>
            {tw('voucherMyVouchers')}
          </h3>
          {available > 0 && (
            <span className="shrink-0 rounded-full bg-[var(--ink)] px-3 py-1 text-sm font-bold text-[var(--gold-bright)]">
              {t('vouchersReady', { count: available })}
            </span>
          )}
        </div>
        {vouchers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--gold)]/50 bg-white/70 px-3 py-4 text-center text-sm text-[var(--muted)]">{t('noVouchers')}</p>
        ) : (
          <>
            <p className="mb-2 text-xs leading-5 text-[var(--muted)]">{t('vouchersHowTo')}</p>
            <div className="space-y-2">
              {groups.map((g) => {
                const ready = g.items.filter((v) => v.status === 'active').length
                return (
                  <details key={g.key} className="group rounded-xl border border-[var(--gold)]/40 bg-white/80 shadow-sm">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center gap-2 font-bold text-[var(--ink)]">
                        {g.star ? <Star className={`h-5 w-5 shrink-0 ${g.star}`} /> : <Ticket className="h-5 w-5 shrink-0 text-[var(--gold)]" />}
                        <span className="truncate">{g.title}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted)]">
                        {t('groupCount', { count: g.items.length })}
                        {ready > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">{t('vouchersReady', { count: ready })}</span>}
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </span>
                    </summary>
                    <div className="space-y-2 border-t border-[var(--gold)]/20 px-3 py-3">
                    {g.items.map((v) => {
                      const plan = v.plan === 'pro' ? 'Pro' : 'Base'
                      return (
                        <div key={v.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <code className="font-mono text-sm text-[var(--ink)]">{v.code}</code>
                              <span className="rounded bg-[var(--gold-pale)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--ink)]">{plan}</span>
                              {v.prize_key?.startsWith('black_plus_') && prizeName(v.prize_key) && <span className="text-[11px] text-[var(--muted)]">{t('prizeFrom', { rank: prizeName(v.prize_key)! })}</span>}
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass(v.status)}`}>{statusLabel(v.status)}</span>
                          </div>
                          {v.personal && v.status === 'active' && <p className="mt-1 text-xs font-semibold text-[var(--gold)]">{t('personalProHint')}</p>}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                            {v.purpose === 'sale' && <span>{v.sale_price_cents !== null ? t('soldFor', { price: euro(v.sale_price_cents) }) : t('purposeSale')}{v.buyer_name ? ` · ${v.buyer_name}` : ''}</span>}
                            {v.status === 'active' && (
                              <>
                                <button type="button" onClick={() => handleCopy(v.code)} className="inline-flex items-center gap-1 font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                                  {copied === v.code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                  {copied === v.code ? tw('voucherCopied') : tw('voucherCopy')}
                                </button>
                                <a
                                  href={buildWhatsAppHref(t('shareGiftMessage', { code: v.code, plan, url: `${window.location.origin}/api/presentazione?lang=${locale}` }))}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800"
                                >
                                  <Share2 className="h-3.5 w-3.5" /> {tw('voucherShareWhatsapp')}
                                </a>
                                <Link href={`/wallet/voucher/${v.id}/stampa`} className="inline-flex items-center gap-1 font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                                  <Printer className="h-3.5 w-3.5" /> {t('printLink')}
                                </Link>
                              </>
                            )}
                            {v.status !== 'revoked' && (
                              <Link href={`/wallet/voucher/${v.id}`} className="inline-flex items-center gap-1 font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                                <Receipt className="h-3.5 w-3.5" /> {t('receiptLink')}
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    </div>
                  </details>
                )
              })}
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t('saleNote')}</p>
          </>
        )}
      </div>

      {/* 4. Riscatta un voucher ricevuto */}
      <div className="border-t border-gray-100 pt-4">
        <p className="mb-2 text-sm font-semibold text-[var(--ink)]">{tw('voucherRedeemTitle')}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            placeholder={tw('voucherRedeemPlaceholder')}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase tracking-wider focus:border-[var(--gold)] focus:outline-none"
          />
          <button
            onClick={handleRedeem}
            disabled={busy || !redeemCode.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--gold)]/50 bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {tw('voucherRedeemButton')}
          </button>
        </div>
        {redeemMessage && <p className={`mt-2 text-sm ${redeemMessage.ok ? 'text-emerald-600' : 'text-red-600'}`}>{redeemMessage.text}</p>}
      </div>
    </div>
  )
}
