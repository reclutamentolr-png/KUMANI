'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Gift, Lock, LogOut, Minus, Plus, ScanLine, Stamp, Star, AlertTriangle, RefreshCw } from 'lucide-react'
import {
  applyFidelityToMember,
  createFidelityClaim,
  getFidelityClaimStatus,
  lockFidelityCassa,
  lookupFidelityMember,
  unlockFidelityCassa,
  type CassaMemberInfo,
} from '@/app/actions/fidelity'
import { FIDELITY_MAX_QUANTITY, type FidelityKind, type FidelityStatus } from '@/lib/fidelity'
import FidelityScanner from '@/components/fidelity/FidelityScanner'

type CardInfo = { id: string; businessName: string; prize: string; stampsNeeded: number; reviewEnabled: boolean }

type View =
  | { name: 'home' }
  | { name: 'claim'; kind: FidelityKind; code: string; qr: string; expiresAt: number }
  | { name: 'scan' }
  | { name: 'member'; member: CassaMemberInfo }
  | { name: 'result'; ok: boolean; kind: FidelityKind | null; status: FidelityStatus | 'expired'; memberCode?: string | null; stampsCount?: number | null }

const bigGold =
  'flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-5 text-lg font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-105 disabled:opacity-50'
const grayButton =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50'

export default function FidelityCassa({ card, hasAccess }: { card: CardInfo; hasAccess: boolean }) {
  if (!hasAccess) return <PinUnlock card={card} />
  return <CassaPanel card={card} />
}

function PinUnlock({ card }: { card: CardInfo }) {
  const t = useTranslations('fidelity')
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await unlockFidelityCassa(card.id, pin)
    setBusy(false)
    if (result.success) router.refresh()
    else setError(t(`pinError_${result.message}`))
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-6 text-center">
      <Lock className="mx-auto mb-3 h-10 w-10 text-[var(--gold)]" />
      <h2 className="text-lg font-bold text-[var(--ink)]">{t('unlockTitle')}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('unlockText', { business: card.businessName })}</p>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="mt-5 w-full rounded-lg border border-[var(--gold)]/30 p-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
        placeholder="••••"
        autoFocus
      />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy || pin.length < 4} className={`${bigGold} mt-5 py-3 text-base`}>
        {t('unlockButton')}
      </button>
    </form>
  )
}

function CassaPanel({ card }: { card: CardInfo }) {
  const t = useTranslations('fidelity')
  const router = useRouter()
  const [view, setView] = useState<View>({ name: 'home' })
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const goHome = useCallback(() => {
    setView({ name: 'home' })
    setError(null)
  }, [])

  const startClaim = async (kind: FidelityKind) => {
    setBusy(true)
    setError(null)
    const result = await createFidelityClaim(card.id, kind, quantity)
    if (!result.success) {
      setBusy(false)
      setError(t('genericError'))
      return
    }
    // Nessun prefisso di lingua: il telefono del cliente apre la pagina
    // nella sua lingua (rilevamento automatico di next-intl).
    const url = `${window.location.origin}/f/c/${result.code}`
    // qrcode caricato solo quando serve, fuori dal bundle iniziale
    const QRCode = (await import('qrcode')).default
    const qr = await QRCode.toDataURL(url, { width: 520, margin: 1, errorCorrectionLevel: 'M' })
    setBusy(false)
    setView({ name: 'claim', kind, code: result.code, qr, expiresAt: new Date(result.expiresAt).getTime() })
  }

  // Polling del QR mostrato: appena il cliente lo inquadra, la cassa lo sa.
  useEffect(() => {
    if (view.name !== 'claim') return
    const { code, kind } = view
    let stopped = false
    const interval = setInterval(async () => {
      setNow(Date.now())
      const status = await getFidelityClaimStatus(card.id, code)
      if (stopped) return
      if (status.used) {
        setView({ name: 'result', ok: true, kind, status: kind === 'redeem' ? 'redeemed' : 'ok', memberCode: status.memberCode, stampsCount: status.stampsCount })
      } else if (status.lastStatus) {
        setView({ name: 'result', ok: false, kind, status: status.lastStatus, memberCode: status.memberCode })
      } else if (status.expired) {
        setView({ name: 'result', ok: false, kind, status: 'expired' })
      }
    }, 1500)
    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [view, card.id])

  // Dopo un timbro riuscito si torna da soli al pulsante principale.
  useEffect(() => {
    if (view.name !== 'result' || !view.ok) return
    const timeout = setTimeout(goHome, 5000)
    return () => clearTimeout(timeout)
  }, [view, goHome])

  const handleScan = useCallback(
    async (value: string) => {
      setBusy(true)
      setError(null)
      const result = await lookupFidelityMember(card.id, value)
      setBusy(false)
      if (result.success) setView({ name: 'member', member: result.member })
      else {
        setView({ name: 'home' })
        setError(t('memberNotFound'))
      }
    },
    [card.id, t]
  )
  const cancelScan = useCallback(() => setView({ name: 'home' }), [])

  const applyToMember = async (member: CassaMemberInfo, kind: FidelityKind) => {
    setBusy(true)
    const result = await applyFidelityToMember(card.id, member.memberCode, kind, quantity)
    setBusy(false)
    if (!result.success) {
      setView({ name: 'result', ok: false, kind, status: 'not_found' })
      return
    }
    const ok = result.status === 'ok' || result.status === 'redeemed'
    setView({ name: 'result', ok, kind, status: result.status, memberCode: member.memberCode, stampsCount: result.stampsCount })
  }

  const exitCassa = async () => {
    await lockFidelityCassa(card.id)
    router.push('/marketplace/fidelity')
    router.refresh()
  }

  const quantityStepper = (
    <div className="flex items-center justify-center gap-4">
      <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="rounded-full bg-gray-100 p-3 text-gray-700 hover:bg-gray-200" aria-label="-">
        <Minus className="h-5 w-5" />
      </button>
      <div className="min-w-24 text-center">
        <p className="text-3xl font-bold text-[var(--ink)]">{quantity}</p>
        <p className="text-xs text-[var(--muted)]">{t('stampsLabel', { count: quantity })}</p>
      </div>
      <button type="button" onClick={() => setQuantity((q) => Math.min(FIDELITY_MAX_QUANTITY, q + 1))} className="rounded-full bg-gray-100 p-3 text-gray-700 hover:bg-gray-200" aria-label="+">
        <Plus className="h-5 w-5" />
      </button>
    </div>
  )

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-6">
      {view.name === 'home' && (
        <div className="space-y-5">
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--ink)]">{card.businessName}</p>
            <p className="text-sm text-[var(--muted)]">{t('cardSummary', { stamps: card.stampsNeeded, prize: card.prize })}</p>
          </div>
          {quantityStepper}
          <button type="button" onClick={() => startClaim('stamp')} disabled={busy} className={bigGold}>
            <Stamp className="h-6 w-6" /> {t('giveStamp')}
          </button>
          <p className="-mt-2 text-center text-xs text-[var(--muted)]">{t('giveStampHint')}</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => startClaim('redeem')} disabled={busy} className={grayButton}>
              <Gift className="h-4 w-4" /> {t('givePrize')}
            </button>
            <button type="button" onClick={() => setView({ name: 'scan' })} disabled={busy} className={grayButton}>
              <ScanLine className="h-4 w-4" /> {t('scanCustomer')}
            </button>
            {card.reviewEnabled && (
              <button type="button" onClick={() => startClaim('review')} disabled={busy} className={`${grayButton} col-span-2`}>
                <Star className="h-4 w-4" /> {t('giveReviewBonus')}
              </button>
            )}
          </div>
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
          <button type="button" onClick={exitCassa} className="mx-auto flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)]">
            <LogOut className="h-3.5 w-3.5" /> {t('exitCassa')}
          </button>
        </div>
      )}

      {view.name === 'claim' && (
        <div className="text-center">
          <p className="text-lg font-bold text-[var(--ink)]">{view.kind === 'redeem' ? t('claimPrizeTitle') : view.kind === 'review' ? t('claimReviewTitle') : t('claimStampTitle', { count: quantity })}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('claimInstructions')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.qr} alt="QR" className="mx-auto mt-4 w-full max-w-xs rounded-xl border border-[var(--gold)]/20 bg-white p-2" />
          <p className="mt-3 text-sm font-semibold text-[var(--ink)]">
            {t('claimExpiresIn', { seconds: Math.max(0, Math.ceil((view.expiresAt - now) / 1000)) })}
          </p>
          <button type="button" onClick={goHome} className={`${grayButton} mt-4`}>
            {t('cancel')}
          </button>
        </div>
      )}

      {view.name === 'scan' && <FidelityScanner onResult={handleScan} onCancel={cancelScan} />}

      {view.name === 'member' && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-[var(--muted)]">{t('customerCard')}</p>
          <p className="font-mono text-xl font-bold tracking-widest text-[var(--ink)]">{view.member.memberCode}</p>
          <p className="text-3xl font-bold text-[var(--ink)]">
            {view.member.stampsCount}/{view.member.stampsNeeded}
          </p>
          {view.member.stampsCount >= view.member.stampsNeeded ? (
            <button type="button" onClick={() => applyToMember(view.member, 'redeem')} disabled={busy} className={bigGold}>
              <Gift className="h-6 w-6" /> {t('givePrizeNow')}
            </button>
          ) : view.member.reviewBonusAvailable && view.member.nextStampAt ? (
            <>
              <p className="rounded-lg bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
                {t('nextStampAt', { time: new Date(view.member.nextStampAt).toLocaleString() })}
              </p>
              <button type="button" onClick={() => applyToMember(view.member, 'review')} disabled={busy} className={grayButton}>
                <Star className="h-4 w-4" /> {t('giveReviewBonus')}
              </button>
            </>
          ) : view.member.nextStampAt ? (
            <p className="rounded-lg bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
              {t('nextStampAt', { time: new Date(view.member.nextStampAt).toLocaleString() })}
            </p>
          ) : (
            <>
              {quantityStepper}
              <button type="button" onClick={() => applyToMember(view.member, 'stamp')} disabled={busy} className={bigGold}>
                <Stamp className="h-6 w-6" /> {t('addStamps', { count: quantity })}
              </button>
              {view.member.reviewBonusAvailable && (
                <button type="button" onClick={() => applyToMember(view.member, 'review')} disabled={busy} className={grayButton}>
                  <Star className="h-4 w-4" /> {t('giveReviewBonus')}
                </button>
              )}
            </>
          )}
          <button type="button" onClick={goHome} className={grayButton}>
            {t('cancel')}
          </button>
        </div>
      )}

      {view.name === 'result' && (
        <div className="space-y-4 text-center">
          {view.ok ? (
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
          ) : (
            <AlertTriangle className="mx-auto h-16 w-16 text-amber-500" />
          )}
          <p className="text-lg font-bold text-[var(--ink)]">
            {view.ok
              ? view.kind === 'redeem'
                ? t('resultPrizeGiven')
                : view.kind === 'review'
                  ? t('resultReviewGiven')
                  : t('resultStampGiven')
              : t(`status_${view.status}`)}
          </p>
          {view.ok && view.memberCode && view.kind !== 'redeem' && view.stampsCount != null && (
            <p className="text-sm text-[var(--muted)]">
              {t('resultProgress', { code: view.memberCode, count: view.stampsCount, total: card.stampsNeeded })}
            </p>
          )}
          <button type="button" onClick={goHome} className={view.ok ? grayButton : bigGold}>
            {view.ok ? t('backToCassa') : <><RefreshCw className="h-5 w-5" /> {t('backToCassa')}</>}
          </button>
        </div>
      )}
    </div>
  )
}
