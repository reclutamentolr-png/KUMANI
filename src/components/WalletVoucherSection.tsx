'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Ticket, Copy, Check, Share2, Package, Receipt, Undo2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { cancelMyVoucher, createVoucher, redeemVoucher, redeemVoucherPack, type MyVoucher } from '@/app/actions/vouchers'
import type { VoucherPack } from '@/lib/networkWallet'

function buildWhatsAppHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

// Voucher abbonamento nel Portafoglio:
// 1. pacchetti: si spendono Punti Community e si riceve credito voucher in euro;
// 2. con il credito si crea un voucher Base o Pro, da regalare o vendere;
// 3. elenco dei voucher creati (annulla se non usato, ricevuta se venduto);
// 4. riscatto di un voucher ricevuto.
export default function WalletVoucherSection({
  initialPoints,
  initialCreditCents,
  packs,
  valueBaseEur,
  valueProEur,
  initialVouchers,
}: {
  initialPoints: number
  initialCreditCents: number
  packs: VoucherPack[]
  valueBaseEur: number
  valueProEur: number
  initialVouchers: MyVoucher[]
}) {
  const t = useTranslations('voucherWallet')
  const tw = useTranslations('wallet')
  const locale = useLocale()
  const router = useRouter()
  const euro = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)

  const [points, setPoints] = useState(initialPoints)
  const [credit, setCredit] = useState(initialCreditCents)
  const [vouchers, setVouchers] = useState(initialVouchers)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const [plan, setPlan] = useState<'base' | 'pro'>('base')
  const [purpose, setPurpose] = useState<'gift' | 'sale'>('gift')
  const [price, setPrice] = useState('')
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [redeemCode, setRedeemCode] = useState('')
  const [redeemMessage, setRedeemMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const costCents = (plan === 'pro' ? valueProEur : valueBaseEur) * 100
  const canCreate = credit >= costCents

  const handlePack = async (index: number) => {
    const pack = packs[index]
    if (!confirm(t('packConfirm', { points: pack.points, credit: euro(pack.credit_eur * 100) }))) return
    setBusy(`pack-${index}`)
    setMessage(null)
    const result = await redeemVoucherPack(index)
    setBusy(null)
    if (!result.success) {
      setMessage({ ok: false, text: result.message === 'insufficient_points' ? t('packNotEnough') : t('genericError') })
      return
    }
    setPoints(result.points)
    setCredit(result.creditCents)
    setMessage({ ok: true, text: t('packDone', { credit: euro(pack.credit_eur * 100) }) })
    router.refresh()
  }

  const handleCreate = async () => {
    setBusy('create')
    setMessage(null)
    setLastCode(null)
    const priceCents = purpose === 'sale' && price.trim() ? Math.round(Number(price.replace(',', '.')) * 100) : null
    if (priceCents !== null && (!Number.isFinite(priceCents) || priceCents < 0 || priceCents > costCents)) {
      setBusy(null)
      setMessage({ ok: false, text: t('priceTooHigh', { max: euro(costCents) }) })
      return
    }
    const result = await createVoucher({ plan, purpose, priceCents })
    setBusy(null)
    if (!result.success) {
      setMessage({
        ok: false,
        text:
          result.message === 'insufficient_credit'
            ? t('creditNotEnough')
            : result.message === 'price_too_high'
              ? t('priceTooHigh', { max: euro(costCents) })
              : t('genericError'),
      })
      return
    }
    setCredit(result.creditCents)
    setLastCode(result.code)
    setPrice('')
    router.refresh()
  }

  const handleCancel = async (voucher: MyVoucher) => {
    if (!confirm(t('cancelConfirm', { code: voucher.code }))) return
    setBusy(voucher.id)
    const result = await cancelMyVoucher(voucher.id)
    setBusy(null)
    if (!result.success) {
      setMessage({ ok: false, text: t('genericError') })
      return
    }
    setCredit(result.creditCents)
    setVouchers((prev) => prev.map((v) => (v.id === voucher.id ? { ...v, status: 'revoked' } : v)))
    router.refresh()
  }

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard API unavailable — the code is already shown on screen for manual copy.
    }
  }

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return
    setBusy('redeem')
    setRedeemMessage(null)
    const result = await redeemVoucher(redeemCode)
    setBusy(null)
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
        <div className="rounded-xl border border-[var(--gold)]/25 bg-white p-3">
          <p className="text-xs text-[var(--muted)]">{t('pointsBalance')}</p>
          <p className="text-2xl font-bold text-[var(--ink)]">{points}</p>
        </div>
        <div className="rounded-xl border border-[var(--gold)]/25 bg-white p-3">
          <p className="text-xs text-[var(--muted)]">{t('creditBalance')}</p>
          <p className="text-2xl font-bold text-[var(--ink)]">{euro(credit)}</p>
        </div>
      </div>

      {/* 1. Pacchetti */}
      <div>
        <p className="mb-1 text-sm font-semibold text-[var(--ink)]">{t('packsTitle')}</p>
        <p className="mb-3 text-xs text-[var(--muted)]">{t('packsIntro')}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {packs.map((pack, index) => {
            const enough = points >= pack.points
            return (
              <div key={index} className="flex flex-col rounded-xl border border-gray-200 bg-white p-3">
                <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
                  <Package className="h-4 w-4 text-[var(--gold)]" /> {t('packPoints', { points: pack.points })}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {t('packCredit', { credit: euro(pack.credit_eur * 100), count: Math.floor(pack.credit_eur / valueBaseEur) })}
                </p>
                <button
                  type="button"
                  onClick={() => handlePack(index)}
                  disabled={!enough || busy !== null}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === `pack-${index}` && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  {enough ? t('packRedeem') : t('packMissing', { points: pack.points - points })}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. Crea un voucher */}
      <div className="border-t border-gray-100 pt-4">
        <p className="mb-3 text-sm font-semibold text-[var(--ink)]">{t('createTitle')}</p>
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5 text-sm text-[var(--ink)] sm:flex-row sm:gap-4">
            {(['base', 'pro'] as const).map((value) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="voucher_plan" checked={plan === value} onChange={() => setPlan(value)} className="h-4 w-4 accent-[var(--gold)]" />
                {value === 'pro' ? t('planPro', { price: euro(valueProEur * 100) }) : t('planBase', { price: euro(valueBaseEur * 100) })}
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 text-sm text-[var(--ink)] sm:flex-row sm:gap-4">
            {(['gift', 'sale'] as const).map((value) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="voucher_purpose" checked={purpose === value} onChange={() => setPurpose(value)} className="h-4 w-4 accent-[var(--gold)]" />
                {value === 'gift' ? t('purposeGift') : t('purposeSale')}
              </label>
            ))}
          </div>
          {purpose === 'sale' && (
            <div>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t('pricePlaceholder', { max: euro(costCents) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none sm:w-48"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">{t('saleNote')}</p>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate || busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--ink-soft)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'create' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
              {t('createButton', { price: euro(costCents) })}
            </button>
            {!canCreate && <p className="text-xs text-gray-400">{t('creditMissing', { amount: euro(costCents - credit) })}</p>}
          </div>
        </div>
      </div>

      {message && <p className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}

      {lastCode && (
        <div className="rounded-lg border border-[var(--gold)]/40 bg-[var(--gold-pale)] p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--ink)]">{tw('voucherCreated')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-white px-3 py-1.5 font-mono text-base font-bold tracking-wider text-[var(--ink)]">{lastCode}</code>
            <button
              onClick={() => handleCopy(lastCode)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--gold)]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
            >
              {copied === lastCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === lastCode ? tw('voucherCopied') : tw('voucherCopy')}
            </button>
            <a
              href={buildWhatsAppHref(tw('voucherShareMessage', { code: lastCode }))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Share2 className="h-3.5 w-3.5" />
              {tw('voucherShareWhatsapp')}
            </a>
          </div>
        </div>
      )}

      {/* 3. Voucher creati */}
      {vouchers.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{tw('voucherMyVouchers')}</p>
          <div className="space-y-2">
            {vouchers.map((v) => (
              <div key={v.id} className="rounded-lg border border-gray-200 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="font-mono text-sm text-[var(--ink)]">{v.code}</code>
                    <span className="rounded bg-[var(--gold-pale)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--ink)]">
                      {v.plan === 'pro' ? 'Pro' : 'Base'}
                    </span>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass(v.status)}`}>{statusLabel(v.status)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  <span>
                    {v.purpose === 'sale'
                      ? v.sale_price_cents !== null
                        ? t('soldFor', { price: euro(v.sale_price_cents) })
                        : t('purposeSale')
                      : t('purposeGift')}
                    {v.buyer_name ? ` · ${v.buyer_name}` : ''}
                  </span>
                  <button type="button" onClick={() => handleCopy(v.code)} className="font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                    {copied === v.code ? tw('voucherCopied') : tw('voucherCopy')}
                  </button>
                  {v.status !== 'revoked' && (
                    <Link href={`/wallet/voucher/${v.id}`} className="inline-flex items-center gap-1 font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                      <Receipt className="h-3.5 w-3.5" /> {t('receiptLink')}
                    </Link>
                  )}
                  {v.status === 'active' && v.plan && (
                    <button
                      type="button"
                      onClick={() => handleCancel(v)}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1 font-semibold text-red-600 hover:text-red-700 disabled:opacity-40"
                    >
                      <Undo2 className="h-3.5 w-3.5" /> {t('cancelVoucher')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            disabled={busy !== null || !redeemCode.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--gold)]/50 bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === 'redeem' && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {tw('voucherRedeemButton')}
          </button>
        </div>
        {redeemMessage && <p className={`mt-2 text-sm ${redeemMessage.ok ? 'text-emerald-600' : 'text-red-600'}`}>{redeemMessage.text}</p>}
      </div>
    </div>
  )
}
