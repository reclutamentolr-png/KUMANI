'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Gift, LoaderCircle } from 'lucide-react'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { adminListGiftOrders, type AdminGiftCode, type AdminGiftOrder, type AdminGiftPerson } from '@/app/actions/gifts'

const euro = (cents: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const day = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Admin → Voucher e coupon → Regali: regali comprati dagli utenti (Pass di un
// servizio o un anno di Base/Pro), con lo stato di ogni codice. Il rimborso
// si fa da Stripe: i codici non ancora attivati si annullano da soli.
export default function GiftOrdersPanel() {
  const marketplaceT = useTranslations('marketplace')
  const toolNames = useMemo(() => new Map(getMarketplaceTools((key) => marketplaceT(key)).map((tool) => [tool.toolName, tool.title])), [marketplaceT])
  const [orders, setOrders] = useState<AdminGiftOrder[] | null>(null)
  const [people, setPeople] = useState<Record<string, AdminGiftPerson>>({})
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await adminListGiftOrders()
    setOrders(result.orders)
    setPeople(result.people)
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono, come PassCodesPanel).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const person = (id: string | null) => {
    if (!id) return '—'
    const p = people[id]
    return p ? `${`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—'}${p.email ? ` (${p.email})` : ''}` : 'account cancellato'
  }
  const item = (o: AdminGiftOrder) => (o.kind === 'plan' ? `Un anno di KUMANI ${o.plan === 'pro' ? 'Pro' : 'Base'}` : `Pass ${toolNames.get(o.tool ?? '') ?? o.tool}`)
  const codeState = (c: AdminGiftCode, o: AdminGiftOrder) =>
    c.revoked_at || o.refunded_at
      ? { text: 'annullato', cls: 'bg-red-50 text-red-700' }
      : c.redeemed_at
        ? { text: `attivato da ${person(c.redeemed_by)} il ${day(c.redeemed_at)}`, cls: 'bg-emerald-50 text-emerald-700' }
        : new Date(c.valid_until) < new Date()
          ? { text: 'scaduto', cls: 'bg-gray-100 text-gray-600' }
          : { text: `da attivare entro il ${day(c.valid_until)}`, cls: 'bg-amber-50 text-amber-800' }

  const totals = (orders ?? []).reduce(
    (acc, o) => ({
      amount: acc.amount + (o.refunded_at ? 0 : o.amount_cents),
      codes: acc.codes + o.gift_codes.length,
      used: acc.used + o.gift_codes.filter((c) => c.redeemed_at).length,
    }),
    { amount: 0, codes: 0, used: 0 }
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Regali comprati dagli utenti dalla pagina «Regala KUMANI»: ogni codice attiva per un anno il Pass di un servizio oppure KUMANI Base o Pro, per chi lo
        riceve. Si attivano entro un anno dall&apos;acquisto; chi compra non può usare i propri. Nessun KU Point sui regali. Per un rimborso usa Stripe: i
        codici non ancora attivati si annullano automaticamente.
      </p>
      {orders && orders.length > 0 && (
        <p className="text-sm font-semibold text-gray-800">
          {orders.length} ordini · {euro(totals.amount)} incassati · {totals.used} codici attivati su {totals.codes}
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {orders === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nessun regalo comprato.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className={`rounded-xl border bg-white p-4 shadow-sm ${o.refunded_at ? 'border-red-200 opacity-75' : 'border-gray-200'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                  <Gift className="h-4 w-4 text-amber-500" /> {item(o)} × {o.quantity}
                </p>
                <p className="text-xs text-gray-500">
                  {day(o.created_at)} · {euro(o.amount_cents)}
                  {o.refunded_at ? ` · rimborsato il ${day(o.refunded_at)}` : ''}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                Acquirente: {person(o.buyer_id)}
                {o.stripe_payment_intent ? ` · ${o.stripe_payment_intent}` : ''}
              </p>
              {o.message && <p className="mt-1 text-xs italic text-gray-600">“{o.message}”</p>}
              <ul className="mt-2 space-y-1">
                {o.gift_codes.map((c) => {
                  const state = codeState(c, o)
                  return (
                    <li key={c.code} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-gray-800">{c.code}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${state.cls}`}>{state.text}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
