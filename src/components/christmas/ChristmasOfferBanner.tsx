import { cookies } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { formatOfferDate, getChristmas, romeDate } from '@/lib/christmas'
import ChristmasOfferCard from '@/components/christmas/ChristmasOfferCard'

export const CHRISTMAS_BANNER_COOKIE = 'kumani_xmas_banner_hidden'

// Offerta di Natale in cima alla Home (Admin → Natale): regalare un anno di
// KUMANI e, a chi non è abbonato, lo sconto sul primo anno. Chiuso con la
// «x» non si rivede fino al giorno dopo (cookie con la data di oggi).
export default async function ChristmasOfferBanner({ subscribed }: { subscribed: boolean }) {
  const { offer } = await getChristmas()
  if (!offer) return null
  const today = romeDate(new Date())
  if ((await cookies()).get(CHRISTMAS_BANNER_COOKIE)?.value === today) return null
  const showGift = offer.giftPct > 0
  const showSelf = offer.planPct > 0 && !subscribed
  if (!showGift && !showSelf) return null
  const [t, locale] = await Promise.all([getTranslations('christmas'), getLocale()])
  const until = formatOfferDate(locale, offer.until)
  return (
    <ChristmasOfferCard
      today={today}
      cookieName={CHRISTMAS_BANNER_COOKIE}
      texts={{
        title: t('title'),
        gift: showGift ? t('giftLine', { pct: offer.giftPct }) : null,
        self: showSelf ? t('selfLine', { pct: offer.planPct }) : null,
        until: t('until', { date: until }),
        giftCta: t('giftCta'),
        selfCta: t('selfCta'),
        close: t('close'),
      }}
    />
  )
}
