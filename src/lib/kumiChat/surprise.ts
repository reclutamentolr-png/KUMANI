import { getTranslations } from 'next-intl/server'
import { getEnabledSurpriseKinds, getSurprisePrices } from '@/lib/surpriseServer'
import { REVEAL_STYLES, voucherOnly } from '@/lib/surprise'
import { SURPRISE_TEMPLATES } from '@/lib/surpriseTemplates'
import type { Chunk } from '@/lib/kumiChat/knowledge'

// Chiedi a KUMI nella pagina KUMANI Sorpresa: cosa sa KUMI della sorpresa,
// con i tipi accesi dall'Admin e i prezzi di oggi (i tipi spenti non li propone)
export async function surpriseKnowledge(locale: string): Promise<{ chunks: Chunk[]; rule: string; key: string }> {
  const [t, tt, tg, kinds, prices] = await Promise.all([
    getTranslations({ locale, namespace: 'surprise' }),
    getTranslations({ locale, namespace: 'surpriseTpl' }),
    getTranslations({ locale, namespace: 'guideTexts.sorprese' }),
    getEnabledSurpriseKinds(),
    getSurprisePrices(),
  ])
  const only = voucherOnly(kinds)
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)
  const v = only ? 'Voucher' : ''
  // Della guida solo i passi ancora validi con il solo buono (il 1° e il 2°
  // elencano i vecchi modelli e i percorsi: modelli e aperture sono qui sotto)
  const steps = (only ? [4, 5] : [1, 2, 3, 4, 5]).map((n) => `${tg(`step${n}Title`)}: ${tg(`step${n}Text`)}`)
  const chunks: Chunk[] = [
    {
      id: 'surprise:what',
      title: t('title'),
      text: [t(`intro${v}`), t('how1'), t('how2'), t('how3'), t('freeUntilPay'), ...kinds.map((k) => `${t(`kind_${k}`)} (${money(prices[k])}): ${t(`kind_${k}_desc`)}`)].join(' '),
      href: '/sorprese',
    },
    { id: 'surprise:steps', title: tg('title'), text: steps.join(' '), href: '/guida/sorprese' },
    {
      id: 'surprise:ideas',
      title: t('templatesTitle'),
      text: [
        `${t('templatesTitle')}: ${SURPRISE_TEMPLATES.filter((tpl) => kinds.includes(tpl.kind))
          .map((tpl) => `${tt(`${tpl.key}_name`)} (${tt(`${tpl.key}_desc`)})`)
          .join('; ')}.`,
        `${REVEAL_STYLES.map((r) => t(`reveal_${r}`)).join(', ')}.`,
      ].join(' '),
      href: '/sorprese',
    },
    { id: 'surprise:delivery', title: t('dlvSectionTitle'), text: [t('dlvSectionHint'), t('dlvExplain1'), t('dlvExplain2'), t('dlvExplain3'), t('dlvMailHow')].join(' '), href: '/sorprese' },
  ]
  const rule = `They are on the KUMANI Sorpresa page, where you create a gift (a voucher that opens with an animation, sent by link on WhatsApp, email or QR code): questions without a name are about creating a surprise or choosing a gift idea. Suggest gift ideas from the ready-made templates when asked what to give.${
    only ? ' Right now only the gift voucher can be created: never suggest or describe surprise journeys of 3 or 7 days or stages.' : ''
  }`
  return { chunks, rule, key: only ? 'v' : 'a' }
}
