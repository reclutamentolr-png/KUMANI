import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CheckCircle2, Clock, PackageCheck, Truck, XCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { confirmShopOrder } from '@/app/actions/shopStore'
import { serviceDb } from '@/lib/shopPayments'
import { mapOrder } from '@/lib/shopServer'
import { formatCents, shopPath } from '@/lib/shop'

// Pagina dell'ordine per il cliente (link nell'email e ritorno dal pagamento)
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function ShopOrderPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string; token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const [{ locale, slug, token }, { paid }] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound()
  if (paid) await confirmShopOrder(token, paid)
  const t = await getTranslations('shopPublic')
  const db = serviceDb()
  const { data: row } = await db.from('shop_orders').select('*').eq('public_token', token).maybeSingle()
  if (!row) notFound()
  const { data: shop } = await db.from('shop_settings').select('slug, name, pickup_info').eq('owner_id', row.owner_id).maybeSingle()
  if (!shop || shop.slug !== slug) notFound()
  const order = mapOrder(row)
  const money = (c: number) => formatCents(c, locale)
  const Icon = order.status === 'pending' ? Clock : order.status === 'cancelled' ? XCircle : order.status === 'shipped' ? Truck : order.status === 'ready' ? PackageCheck : CheckCircle2

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20">
      <header className="bg-[var(--ink)] px-4 py-6 text-white">
        <div className="mx-auto max-w-xl">
          <Link href={shopPath(shop.slug as string)} className="text-sm text-white/70 hover:text-white">
            ← {shop.name as string}
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{order.number ? t('orderTitle', { number: order.number }) : t('orderPendingTitle')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--gold)]/30 bg-white p-4 shadow-sm">
          <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${order.status === 'cancelled' ? 'text-gray-400' : 'text-emerald-600'}`} />
          <div>
            <p className="font-bold text-[var(--ink)]">{t(`orderStatus_${order.status}`)}</p>
            <p className="text-sm text-gray-600">{t(`orderStatusText_${order.status}`, { email: order.customerEmail })}</p>
            {order.status === 'shipped' && order.trackingNumber && (
              <p className="mt-2 text-sm">
                {t('emailTracking', { code: order.trackingNumber })}
                {order.trackingUrl && (
                  <>
                    {' · '}
                    <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                      {t('trackLink')}
                    </a>
                  </>
                )}
              </p>
            )}
            {order.delivery === 'pickup' && shop.pickup_info && order.status !== 'cancelled' && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{shop.pickup_info as string}</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <ul className="space-y-1">
            {order.items.map((i) => (
              <li key={i.product_id} className="flex justify-between gap-3">
                <span>
                  {i.quantity} × {i.name}
                </span>
                <span className="font-semibold">{money(i.price_cents * i.quantity)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 text-gray-500">
              <span>{t(order.delivery === 'pickup' ? 'deliveryPickup' : 'shipping')}</span>
              <span>{order.shippingCents ? money(order.shippingCents) : t('free')}</span>
            </li>
            <li className="flex justify-between gap-3 border-t border-gray-100 pt-1 text-base font-bold">
              <span>{t('total')}</span>
              <span>{money(order.totalCents)}</span>
            </li>
          </ul>
          {order.shipAddress && (
            <p className="mt-3 text-gray-600">
              {t('shipTo')}: {order.customerName}, {order.shipAddress.line}, {order.shipAddress.postal_code} {order.shipAddress.city} ({order.shipAddress.country})
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
