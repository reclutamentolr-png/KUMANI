import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BadgeCheck, CircleAlert, CircleX, PackageCheck } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import DeliveryFrame from '@/components/surprise/DeliveryFrame'
import { DeliverButton, ResendLink } from '@/components/surprise/DeliveryProvider'
import { deliveryCookieName, deliveryManagePath, normalizeDeliveryCode } from '@/lib/surpriseDelivery'
import { deliveryByCode, giftExpired, giftLive, tokenMatches } from '@/lib/surpriseDeliveryServer'

// Verifica del buono (si apre dal QR): solo se è valido o già consegnato,
// senza nomi né contatti. Chi consegna, se ha già aperto il link segreto
// dell'email su questo telefono, segna qui la consegna.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function DeliveryVerifyPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code: raw } = await params
  setRequestLocale(locale)
  const t = await getTranslations('surprise')
  const code = normalizeDeliveryCode(raw)
  const d = code ? await deliveryByCode(code) : null
  const live = !!d && giftLive(d)
  const state: 'invalid' | 'delivered' | 'expired' | 'valid' = !d || !live ? 'invalid' : d.status === 'delivered' ? 'delivered' : giftExpired(d) ? 'expired' : 'valid'
  const isProvider = !!d && live && tokenMatches(d, (await cookies()).get(deliveryCookieName(d.code))?.value)
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
  const Icon = state === 'valid' ? BadgeCheck : state === 'delivered' ? PackageCheck : state === 'expired' ? CircleAlert : CircleX
  const tone = state === 'valid' ? 'text-emerald-400' : state === 'delivered' ? 'text-[var(--gold-bright)]' : state === 'expired' ? 'text-amber-400' : 'text-red-400'

  return (
    <DeliveryFrame>
      <section className="rounded-3xl border border-[var(--gold)]/30 bg-white/[0.04] p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">{t('dlvVerifyTitle')}</p>
        <Icon className={`mx-auto mt-4 h-14 w-14 ${tone}`} aria-hidden />
        <h1 className="mt-3 text-2xl font-extrabold">{t(`dlvVerify_${state}`)}</h1>
        {code && <p className="mt-1 font-mono text-lg font-bold tracking-wider text-[var(--gold-bright)]">{code}</p>}
        <p className="mt-3 text-sm text-white/75">
          {state === 'delivered' && d?.delivered_at
            ? t('dlvVerify_deliveredText', { date: date(d.delivered_at) })
            : state === 'expired' && d?.gift.valid_until
              ? t('dlvVerify_expiredText', { date: date(`${d.gift.valid_until}T12:00:00Z`) })
              : t(`dlvVerify_${state}Text`)}
        </p>
      </section>

      {d && live && state !== 'delivered' &&
        (isProvider ? (
          <section className="mt-5 space-y-3 rounded-3xl bg-white p-5 text-[#171717]">
            <DeliverButton code={d.code} />
            <Link href={deliveryManagePath(d.code)} className="inline-flex min-h-11 items-center text-sm font-semibold text-gray-700 underline underline-offset-4">
              {t('dlvOpenManage')}
            </Link>
          </section>
        ) : (
          <section className="mt-5 space-y-3 rounded-3xl border border-white/15 bg-white/[0.04] p-5">
            <p className="font-bold">{t('dlvVerifyProviderQ')}</p>
            <p className="text-sm text-white/75">{t('dlvVerifyProviderHint')}</p>
            <ResendLink code={d.code} />
          </section>
        ))}
    </DeliveryFrame>
  )
}
