import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getEnabledSurpriseKinds, getSurprisePrices, surpriseDb } from '@/lib/surpriseServer'
import { parseSurprisePlan, REVEAL_STYLES, voucherOnly } from '@/lib/surprise'
import { SURPRISE_TEMPLATES } from '@/lib/surpriseTemplates'
import type { Chunk } from '@/lib/kumiChat/knowledge'

// Chiedi a KUMI nella pagina KUMANI Sorpresa: cosa sa KUMI della sorpresa,
// con i tipi accesi dall'Admin, i prezzi di oggi e le sorprese incluse nei piani
// (i tipi spenti non li propone). signedIn: si dice anche il piano di chi chiede
// (non quante gliene restano: la risposta resta in memoria per tutti con lo stesso piano)
export async function surpriseKnowledge(locale: string, signedIn: boolean): Promise<{ chunks: Chunk[]; rule: string; key: string }> {
  const [t, tt, tg, kinds, prices, { data: planRows }, myPlan] = await Promise.all([
    getTranslations({ locale, namespace: 'surprise' }),
    getTranslations({ locale, namespace: 'surpriseTpl' }),
    getTranslations({ locale, namespace: 'guideTexts.sorprese' }),
    getEnabledSurpriseKinds(),
    getSurprisePrices(),
    surpriseDb().from('system_settings').select('key, value').like('key', 'surprise_plan_%'),
    signedIn ? createClient().then(async (s) => parseSurprisePlan((await s.rpc('my_surprise_plan')).data).plan) : Promise.resolve('none' as const),
  ])
  const only = voucherOnly(kinds)
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)
  const v = only ? 'Voucher' : ''
  // I 5 passi della guida «Come si usa»
  const steps = [1, 2, 3, 4, 5].map((n) => `${tg(`step${n}Title`)}: ${tg(`step${n}Text`)}`)
  // Sorprese incluse nei piani (Admin → Impostazioni): quante e ogni quanto
  const setting = new Map((planRows ?? []).map((r) => [r.key as string, Number(r.value)]))
  const EVERY: Record<number, string> = { 1: 'every month', 3: 'every 3 months', 12: 'every year' }
  const included = (plan: 'base' | 'pro') =>
    kinds
      .map((k) => ({ k, n: setting.get(`surprise_plan_${plan}_${k}`) ?? 0, m: setting.get(`surprise_plan_${plan}_${k}_months`) ?? 1 }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.n} × ${t(`kind_${x.k}`)} ${EVERY[x.m] ?? 'every month'}`)
      .join(', ') || 'none'
  const planFacts = [
    `Surprises included in the plans, at no cost: Plus plan ${included('base')}; Pro plan ${included('pro')}. Free plan: none included.`,
    `They renew at the start of each calendar month (or quarter or year, as written); unused ones do not carry over. When the included ones are used up, each extra one is paid at the normal price (${kinds.map((k) => `${t(`kind_${k}`)} ${money(prices[k])}`).join(', ')}), with the card or with KU Karma / KU Points. ${t('planHow')} How many are left is shown on the page in «${t('planTitle', { plan: 'Plus/Pro' })}».`,
    signedIn ? (myPlan === 'none' ? 'The person asking has no Plus or Pro plan: tell them that with Plus or Pro some are included.' : `The person asking has the ${myPlan === 'pro' ? 'Pro' : 'Plus'} plan: when they ask about prices, first remind them how many are included in their plan.`) : '',
  ]
    .filter(Boolean)
    .join(' ')
  const chunks: Chunk[] = [
    { id: 'surprise:plans', title: t('planTitle', { plan: 'Plus/Pro' }), text: planFacts, href: '/sorprese' },
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
  const rule = `They are on the KUMANI Sorpresa page, where you create a gift (a voucher that opens with an animation, sent by link on WhatsApp, email or QR code): questions without a name are about creating a surprise or choosing a gift idea. Suggest gift ideas from the ready-made templates when asked what to give. When talking about the price, always also say how many surprises are included in the Plus and Pro plans.${
    only ? ' Right now only the gift voucher can be created: never suggest or describe surprise journeys of 3 or 7 days or stages.' : ''
  }`
  // «2»: le risposte di prima (senza i piani) non si riusano
  return { chunks, rule, key: `2${only ? 'v' : 'a'}${signedIn ? myPlan : ''}` }
}
