'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Copy, Mail, MessageCircle, Share2 } from 'lucide-react'
import { giftInfoPath, giftPath, type GiftOrder, type GiftOrderCode } from '@/lib/gifts'

// I regali comprati: ogni codice con il suo stato e i pulsanti per mandarlo.
export default function GiftOrdersList({ orders, names, baseUrl }: { orders: GiftOrder[]; names: Record<string, string>; baseUrl: string }) {
  const t = useTranslations('gifts')
  const locale = useLocale()
  const [copied, setCopied] = useState<string | null>(null)
  // Momento del caricamento: basta per dire se un codice è scaduto
  const [now] = useState(() => Date.now())
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(cents / 100)
  const link = (code: string) => `${baseUrl}${giftPath(code)}`
  // Messaggio da mandare: il regalo con il suo link, poi dove leggere di cosa si tratta
  const message = (order: GiftOrder, code: string) =>
    `${t('shareText', { item: names[order.id] ?? '' })} ${link(code)}\n\n${t('shareLearnMore')} ${baseUrl}${giftInfoPath(order.kind, order.tool)}`

  const status = (c: GiftOrderCode) =>
    c.revoked
      ? { label: t('status_revoked'), cls: 'bg-red-50 text-red-700' }
      : c.redeemed_at
        ? { label: c.redeemed_name ? t('status_redeemedBy', { name: c.redeemed_name, date: date(c.redeemed_at) }) : t('status_redeemed', { date: date(c.redeemed_at) }), cls: 'bg-emerald-50 text-emerald-700' }
        : new Date(c.valid_until).getTime() < now
          ? { label: t('status_expired'), cls: 'bg-gray-100 text-gray-600' }
          : { label: t('status_valid', { date: date(c.valid_until) }), cls: 'bg-[var(--gold-pale)] text-[var(--ink)]' }

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(link(code))
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Appunti non disponibili
    }
  }

  const share = async (order: GiftOrder, code: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t('shareTitle'), text: message(order, code) })
      } catch {
        // Annullato
      }
      return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message(order, code))}`, '_blank')
  }

  if (orders.length === 0) return <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-[var(--muted)]">{t('noOrders')}</p>

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-bold text-[var(--ink)]">
              {names[order.id]} × {order.quantity}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {date(order.created_at)} · {money(order.amount_cents)}
            </p>
          </div>
          {order.message && <p className="mt-1 text-sm italic text-gray-600">“{order.message}”</p>}
          {order.refunded && <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{t('refundedNote')}</p>}
          <ul className="mt-3 divide-y divide-gray-100">
            {order.codes.map((c) => {
              const s = status(c)
              const usable = !c.revoked && !c.redeemed_at && new Date(c.valid_until).getTime() >= now
              return (
                <li key={c.code} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                  <span className="font-mono text-sm font-bold tracking-wider text-[var(--ink)]">{c.code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                  {usable && (
                    <span className="ml-auto flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => share(order, c.code)} className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-xs font-bold text-[var(--gold-bright)]">
                        <Share2 className="h-3.5 w-3.5" /> {t('send')}
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(message(order, c.code))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="WhatsApp"
                        className="flex items-center rounded-lg border border-gray-200 px-2 py-1.5 text-emerald-600 hover:bg-emerald-50"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={`mailto:?subject=${encodeURIComponent(t('shareTitle'))}&body=${encodeURIComponent(message(order, c.code))}`}
                        aria-label="Email"
                        className="flex items-center rounded-lg border border-gray-200 px-2 py-1.5 text-gray-600 hover:bg-gray-50"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                      <button type="button" onClick={() => copy(c.code)} aria-label={t('copyLink')} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                        {copied === c.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{copied === c.code ? t('copied') : t('copyLink')}</span>
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
