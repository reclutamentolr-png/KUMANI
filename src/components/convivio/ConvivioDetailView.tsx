'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import ChatRetentionNote from '@/components/ChatRetentionNote'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { BadgeCheck, Check, Clock, Flag, LoaderCircle, MapPin, MessageCircle, Minus, Package, Pencil, Phone, Plus, Send, Share2, Star, Truck, Users, X } from 'lucide-react'
import {
  answerCounter,
  getConvivio,
  getConvivioMessages,
  reviewConvivio,
  supplierRespond,
  joinConvivio,
  leaveConvivio,
  reportConvivio,
  sendConvivioMessage,
  setConvivioStatus,
  updateConvivioInfo,
} from '@/app/actions/convivio'
import { createClient } from '@/lib/supabase/client'
import { formatEuro, savingPercent, type ConvivioDetail, type ConvivioMessage } from '@/lib/convivio'
import { ProgressBar, STATUS_STYLE } from './ConvivioCardItem'

// Dettaglio di una cordata: adesione (con quantità), avanzamento in tempo
// reale, istruzioni di pagamento/ritiro, chat del gruppo, azioni del
// capocordata, condivisione e segnalazione.
export default function ConvivioDetailView({ initial, siteUrl, myReferral }: { initial: ConvivioDetail; siteUrl: string; myReferral: string | null }) {
  const t = useTranslations('convivio')
  const locale = useLocale()
  const [data, setData] = useState(initial)
  const [messages, setMessages] = useState<ConvivioMessage[]>([])
  const [quantity, setQuantity] = useState(initial.my_quantity ?? 1)
  const [note, setNote] = useState(initial.my_note ?? '')
  const [sharePhone, setSharePhone] = useState(!!initial.my_share_phone)
  const [counter, setCounter] = useState<{ price: string; min: string } | null>(null)
  const [review, setReview] = useState<{ target: 'supplier' | 'leader'; rating: number; comment: string } | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [info, setInfo] = useState({ description: initial.description, pickup: initial.pickup_info })
  const [now, setNow] = useState(0)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const refresh = useCallback(async () => {
    const [detail, msgs] = await Promise.all([getConvivio(initial.id), getConvivioMessages(initial.id)])
    if (detail) setData(detail)
    setMessages(msgs ?? [])
  }, [initial.id])

  // Tempo reale (solo per chi fa parte del gruppo) + controllo di riserva
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    refresh()
    const supabase = createClient()
    let active = true
    ;(async () => {
      if (!data.is_member) return
      await supabase.realtime.setAuth()
      if (!active) return
      channelRef.current = supabase
        .channel(`convivio:${initial.id}`, { config: { private: true } })
        .on('broadcast', { event: '*' }, () => refresh())
        .subscribe()
    })()
    const fallback = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 60000)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      clearInterval(fallback)
      document.removeEventListener('visibilitychange', onVisible)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [initial.id, data.is_member, refresh])

  const run = async (action: () => Promise<string>, success?: string) => {
    setBusy(true)
    setNotice(null)
    const result = await action()
    setBusy(false)
    setNotice(result === 'ok' ? (success ?? null) : t(`error_${result}`))
    await refresh()
  }

  const saving = savingPercent(data)
  const open = data.status === 'open'
  const reached = data.people >= data.min_participants
  const ms = new Date(data.expires_at).getTime() - now
  const hours = Math.floor(ms / 3600000)
  const left = ms <= 0 ? t('expired') : hours < 24 ? t('hoursLeft', { count: Math.max(1, hours) }) : t('daysLeft', { count: Math.ceil(hours / 24) })
  // Il link porta il codice invito di chi condivide: chi si iscrive entra
  // nella sua rete (come per gli strumenti condivisi).
  const shareUrl = `${siteUrl}/convivio/${data.id}${myReferral ? `?ref=${encodeURIComponent(myReferral)}` : ''}`
  // Possono invitare capocordata, fornitore confermato e partecipanti, a Kordata aperta
  const canInvite = open && (data.is_leader || !!data.my_quantity || (data.is_supplier && data.supplier_status === 'confirmed'))
  const inviteWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, '_blank')
  const shareText = t('shareText', { title: data.title, price: formatEuro(data.group_price, locale), people: data.people, min: data.min_participants })

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: data.title, text: shareText, url: shareUrl })
      } catch {
        // Annullato.
      }
      return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, '_blank')
  }

  const report = async () => {
    const reason = prompt(t('reportPrompt'))
    if (!reason?.trim()) return
    const ok = await reportConvivio(data.id, reason)
    setNotice(ok ? t('reported') : t('error_saveError'))
  }

  const statusBanner = {
    awaiting_supplier:
      data.supplier_status === 'counter'
        ? t('banner_counter', { price: formatEuro(data.counter_price ?? data.group_price, locale), min: data.counter_min ?? data.min_participants })
        : t('banner_awaiting_supplier', { name: data.supplier_name }),
    declined: t('banner_declined'),
    open: reached ? t('banner_open_reached') : t('banner_open', { missing: data.min_participants - data.people }),
    reached: t('banner_reached'),
    failed: t('banner_failed'),
    ordered: t('banner_ordered'),
    completed: t('banner_completed'),
    cancelled: t('banner_cancelled'),
  }[data.status]

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-5">
        <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">{t(`category_${data.category}`)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[data.status]}`}>{t(`status_${data.status}`)}</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">{data.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4" /> {data.supplier_name}
            </span>
            {data.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {data.city}
              </span>
            )}
            {!data.supplier_is_leader && (
              <span className="flex items-center gap-1">
                <BadgeCheck className="h-4 w-4 text-[var(--gold)]" /> {t('leaderBy', { name: data.leader_name ?? '' })}
                {data.leader_rating.count > 0 && <RatingStars rating={data.leader_rating} />}
              </span>
            )}
            {data.supplier_kumani && (
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${data.supplier_status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                <BadgeCheck className="h-3.5 w-3.5" /> {data.supplier_status === 'confirmed' ? t('supplierConfirmed') : t('supplierPending')}
                {data.supplier_rating && data.supplier_rating.count > 0 && <RatingStars rating={data.supplier_rating} />}
              </span>
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--ink)]">{formatEuro(data.group_price, locale)}</span>
            {data.unit_label && <span className="text-sm text-[var(--muted)]">/ {data.unit_label}</span>}
            {data.retail_price && saving ? (
              <>
                <span className="text-sm text-gray-400 line-through">{formatEuro(data.retail_price, locale)}</span>
                <span className="rounded bg-emerald-100 px-2 text-sm font-bold text-emerald-700">-{saving}%</span>
              </>
            ) : null}
          </div>

          <div className="mt-4">
            <ProgressBar people={data.people} min={data.min_participants} max={data.max_participants} />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" /> {t('peopleOfMin', { people: data.people, min: data.min_participants })}
                {data.max_participants ? ` · ${t('maxPeople', { max: data.max_participants })}` : ''}
              </span>
              {open && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {left}
                </span>
              )}
            </div>
          </div>
          <p className="mt-4 rounded-xl bg-[var(--gold-pale)]/60 px-4 py-3 text-sm font-medium text-[var(--ink)]">{statusBanner}</p>

          {editing ? (
            <div className="mt-4 space-y-3">
              <textarea className="w-full rounded-xl border border-[var(--gold)]/30 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 p-3 text-sm" rows={4} maxLength={2000} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />
              <textarea className="w-full rounded-xl border border-[var(--gold)]/30 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 p-3 text-sm" rows={3} maxLength={1000} value={info.pickup} onChange={(e) => setInfo({ ...info, pickup: e.target.value })} />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await run(() => updateConvivioInfo(data.id, info.description, info.pickup), t('saved'))
                    setEditing(false)
                  }}
                  className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white"
                >
                  {t('save')}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600">
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {data.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">{data.description}</p>}
              <div className="mt-4 rounded-xl border border-[var(--gold)]/15 bg-[var(--background)] p-4">
                <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
                  <Truck className="h-4 w-4 text-[var(--gold)]" /> {t('pickupTitle')}
                </p>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{data.pickup_info || '—'}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">{t('paymentsNotice')}</p>
              </div>
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={share} className="flex items-center gap-1.5 rounded-lg border border-[var(--gold)]/40 px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
              <Share2 className="h-4 w-4" /> {t('share')}
            </button>
            {data.is_leader && !editing && ['open', 'ordered'].includes(data.status) && (
              <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg border border-[var(--gold)]/40 px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
                <Pencil className="h-4 w-4" /> {t('editInfo')}
              </button>
            )}
            {!data.is_leader && (
              <button type="button" onClick={report} className="ml-auto flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-red-600">
                <Flag className="h-3.5 w-3.5" /> {t('report')}
              </button>
            )}
          </div>
        </div>

        {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}

        {/* Invita amici: capocordata e partecipanti, finché la Kordata è aperta */}
        {canInvite && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
            <p className="font-bold text-[var(--ink)]">{t('inviteTitle')}</p>
            <p className="mt-1 text-sm text-gray-700">
              {reached ? t('inviteBodyReached') : t('inviteBody', { missing: data.min_participants - data.people })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={inviteWhatsApp}
                className="flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white shadow-sm hover:brightness-105"
              >
                <MessageCircle className="h-5 w-5" /> {t('inviteWhatsApp')}
              </button>
              <button type="button" onClick={share} className="flex items-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-white px-4 py-3 text-sm font-semibold text-[var(--ink)]">
                <Share2 className="h-4 w-4" /> {t('otherApps')}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">{t('inviteHint')}</p>
          </div>
        )}

        {/* Adesione */}
        {!data.is_leader && !data.is_supplier && (open || data.my_quantity) && (
          <div className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
            <p className="mb-3 font-bold text-[var(--ink)]">{data.my_quantity ? t('yourPledge') : t('joinTitle')}</p>
            {open ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-xl border border-[var(--gold)]/30">
                    <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="p-2.5" aria-label="-">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center font-bold">{quantity}</span>
                    <button type="button" onClick={() => setQuantity((q) => Math.min(50, q + 1))} className="p-2.5" aria-label="+">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-sm text-[var(--muted)]">
                    {data.unit_label || t('units')} · {t('total')} <strong className="text-[var(--ink)]">{formatEuro(quantity * data.group_price, locale)}</strong>
                  </span>
                </div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder={t('notePlaceholder')}
                  className="mt-3 w-full rounded-xl border border-[var(--gold)]/30 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 px-3 py-2 text-sm"
                />
                {data.supplier_kumani && (
                  <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={sharePhone} onChange={(e) => setSharePhone(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
                    {t('sharePhone', { name: data.supplier_name })}
                  </label>
                )}
                <p className="mt-2 text-xs text-[var(--muted)]">{t('pledgeHint')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => joinConvivio(data.id, quantity, note, sharePhone), data.my_quantity ? t('pledgeUpdated') : t('joined'))}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-50"
                  >
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {data.my_quantity ? t('updatePledge') : t('joinButton')}
                  </button>
                  {data.my_quantity && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => confirm(t('leaveConfirm')) && run(() => leaveConvivio(data.id), t('left'))}
                      className="rounded-xl px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      {t('leave')}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-700">{t('yourPledgeLocked', { quantity: data.my_quantity ?? 0, total: formatEuro((data.my_quantity ?? 0) * data.group_price, locale) })}</p>
            )}
          </div>
        )}

        {/* Richiesta al fornitore KUMANI: accetta, rifiuta o controproposta */}
        {data.is_supplier && !data.is_leader && data.supplier_status === 'pending' && data.status === 'awaiting_supplier' && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
            <p className="font-bold text-[var(--ink)]">{t('supplierRequestTitle', { name: data.leader_name ?? '' })}</p>
            <p className="mt-1 text-sm text-gray-700">
              {t('supplierRequestBody', { price: formatEuro(data.group_price, locale), min: data.min_participants })}
            </p>
            <p className="mt-1 text-xs text-gray-600">{t('feeAcceptNotice')}</p>
            {counter ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input className="rounded-xl border border-[var(--gold)]/30 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 px-3 py-2 text-sm" inputMode="decimal" value={counter.price} placeholder={t('fieldPrice')} onChange={(e) => setCounter({ ...counter, price: e.target.value })} />
                <input className="rounded-xl border border-[var(--gold)]/30 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 px-3 py-2 text-sm" type="number" min={2} value={counter.min} placeholder={t('fieldMin')} onChange={(e) => setCounter({ ...counter, min: e.target.value })} />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => supplierRespond(data.id, 'counter', Number(counter.price.replace(',', '.')), Number(counter.min)), t('counterSent')).then(() => setCounter(null))}
                  className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white"
                >
                  {t('sendCounter')}
                </button>
                <button type="button" onClick={() => setCounter(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600">
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => run(() => supplierRespond(data.id, 'accept'), t('supplierAccepted'))} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">
                  {t('supplierAccept')}
                </button>
                <button
                  type="button"
                  onClick={() => setCounter({ price: String(data.group_price).replace('.', ','), min: String(data.min_participants) })}
                  className="rounded-xl border border-[var(--gold)]/40 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)]"
                >
                  {t('supplierCounter')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => confirm(t('supplierDeclineConfirm')) && run(() => supplierRespond(data.id, 'decline'), t('supplierDeclined'))}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  {t('supplierDecline')}
                </button>
              </div>
            )}
          </div>
        )}

        {data.is_leader && data.supplier_status === 'counter' && data.status === 'awaiting_supplier' && (
          <div className="rounded-2xl border-2 border-[var(--gold)]/60 bg-[var(--gold-pale)]/60 p-5">
            <p className="font-bold text-[var(--ink)]">{t('counterReceived', { name: data.supplier_name })}</p>
            <p className="mt-1 text-sm text-gray-700">
              {t('counterDetails', { price: formatEuro(data.counter_price ?? data.group_price, locale), min: data.counter_min ?? data.min_participants })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => run(() => answerCounter(data.id, true), t('counterAccepted'))} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">
                {t('acceptCounter')}
              </button>
              <button type="button" disabled={busy} onClick={() => confirm(t('rejectCounterConfirm')) && run(() => answerCounter(data.id, false))} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                {t('rejectCounter')}
              </button>
            </div>
          </div>
        )}

        {/* Fornitore confermato (non capocordata): ordine e consegna */}
        {data.is_supplier && !data.is_leader && data.supplier_status === 'confirmed' && (
          <div className="rounded-2xl border border-[var(--ink)]/20 bg-[var(--ink)] p-5 text-white">
            <p className="mb-1 font-bold">{t('supplierPanel')}</p>
            <p className="mb-4 text-sm text-white/70">{t('leaderPanelHint', { quantity: data.quantity })}</p>
            <div className="flex flex-wrap gap-2">
              {(data.status === 'open' || data.status === 'reached') && (
                <button
                  type="button"
                  disabled={busy || !reached}
                  onClick={() => confirm(t('orderConfirm')) && run(() => setConvivioStatus(data.id, 'ordered'), t('orderedDone'))}
                  className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] disabled:opacity-40"
                >
                  {t('markInPreparation')}
                </button>
              )}
              {data.status === 'ordered' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => confirm(t('completeConfirm')) && run(() => setConvivioStatus(data.id, 'completed'), t('completedDone'))}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white"
                >
                  {t('markCompleted')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Recensioni a Convivio consegnato */}
        {data.status === 'completed' && data.my_quantity && (
          <div className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
            <p className="mb-3 font-bold text-[var(--ink)]">{t('reviewTitle')}</p>
            <div className="flex flex-wrap gap-2">
              {(['supplier', 'leader'] as const)
                .filter((target) => (target === 'supplier' ? data.supplier_kumani : !data.supplier_is_leader))
                .map((target) =>
                  data.my_reviews.includes(target) ? (
                    <span key={target} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      ✓ {t(target === 'supplier' ? 'reviewedSupplier' : 'reviewedLeader')}
                    </span>
                  ) : (
                    <button
                      key={target}
                      type="button"
                      onClick={() => setReview({ target, rating: 5, comment: '' })}
                      className="flex items-center gap-1 rounded-xl border border-[var(--gold)]/30 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-gray-50"
                    >
                      <Star className="h-4 w-4 text-amber-400" /> {t(target === 'supplier' ? 'reviewSupplier' : 'reviewLeader')}
                    </button>
                  )
                )}
            </div>
            {review && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setReview({ ...review, rating: n })} aria-label={String(n)}>
                      <Star className={`h-7 w-7 ${n <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full rounded-xl border border-[var(--gold)]/30 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 p-3 text-sm"
                  rows={2}
                  maxLength={300}
                  value={review.comment}
                  placeholder={t('reviewPlaceholder')}
                  onChange={(e) => setReview({ ...review, comment: e.target.value })}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => reviewConvivio(data.id, review.target, review.rating, review.comment), t('reviewThanks')).then(() => setReview(null))}
                    className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white"
                  >
                    {t('sendReview')}
                  </button>
                  <button type="button" onClick={() => setReview(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600">
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Azioni del capocordata */}
        {data.is_leader && (
          <div className="rounded-2xl border border-[var(--ink)]/20 bg-[var(--ink)] p-5 text-white">
            <p className="mb-1 font-bold">{t('leaderPanel')}</p>
            <p className="mb-4 text-sm text-white/70">{t('leaderPanelHint', { quantity: data.quantity })}</p>
            <div className="flex flex-wrap gap-2">
              {(data.status === 'open' || data.status === 'reached') && (
                <button
                  type="button"
                  disabled={busy || !reached}
                  onClick={() => confirm(t('orderConfirm')) && run(() => setConvivioStatus(data.id, 'ordered'), t('orderedDone'))}
                  className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] disabled:opacity-40"
                >
                  {t('markOrdered')}
                </button>
              )}
              {data.status === 'ordered' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => confirm(t('completeConfirm')) && run(() => setConvivioStatus(data.id, 'completed'), t('completedDone'))}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white"
                >
                  {t('markCompleted')}
                </button>
              )}
              {['open', 'awaiting_supplier', 'declined', 'reached', 'failed', 'ordered'].includes(data.status) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => confirm(t('cancelConfirm')) && run(() => setConvivioStatus(data.id, 'cancelled'), t('cancelledDone'))}
                  className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-white/10"
                >
                  <X className="h-4 w-4" /> {t('cancelConvivio')}
                </button>
              )}
            </div>
            {!reached && (data.status === 'open' || data.status === 'reached') && <p className="mt-3 text-xs text-white/60">{t('orderNeedsMin')}</p>}
          </div>
        )}
      </div>

      {/* Partecipanti e chat (solo per chi fa parte del gruppo) */}
      <div className="space-y-5">
        {data.is_member ? (
          <>
            <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
              <p className="mb-3 font-bold text-[var(--ink)]">{t('participants', { count: data.people })}</p>
              {data.participants.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{t('noParticipants')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.participants.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-gray-800">
                        {p.name ?? '—'}
                        {p.note && <span className="ml-2 text-xs text-[var(--muted)]">“{p.note}”</span>}
                        {p.phone && (
                          <a href={`tel:${p.phone}`} className="ml-2 inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--gold)]">
                            <Phone className="h-3 w-3" /> {p.phone}
                          </a>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold text-[var(--ink)]">×{p.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex h-[420px] flex-col rounded-2xl border border-[var(--gold)]/25 bg-white shadow-sm">
              <p className="border-b border-[var(--gold)]/15 px-5 py-3 font-bold text-[var(--ink)]">{t('chatTitle')}</p>
              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--muted)]">{t('chatEmpty')}</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? 'rounded-br-md bg-[var(--ink)] text-white' : 'rounded-bl-md bg-gray-100 text-gray-900'}`}>
                        {!m.mine && (
                          <p className="mb-0.5 text-[11px] font-bold opacity-70">
                            {m.name}
                            {m.is_leader ? ` · ${t('leaderTag')}` : ''}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <ChatRetentionNote className="mx-3 mt-2" />
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!text.trim()) return
                  const body = text
                  setText('')
                  const result = await sendConvivioMessage(data.id, body)
                  if (result !== 'ok') setNotice(t(`error_${result}`))
                  refresh()
                }}
                className="flex gap-2 border-t border-[var(--gold)]/15 p-3"
              >
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={t('chatPlaceholder')} className="flex-1 rounded-xl border border-[var(--gold)]/30 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 px-3 py-2 text-sm" />
                <button type="submit" disabled={!text.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)] disabled:opacity-40" aria-label={t('send')}>
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white/70 p-5 text-sm text-[var(--muted)]">{t('joinToSeeChat')}</div>
        )}
      </div>
    </div>
  )
}

function RatingStars({ rating }: { rating: { avg: number | null; count: number } }) {
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 text-xs font-normal text-amber-600">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {rating.avg} ({rating.count})
    </span>
  )
}
