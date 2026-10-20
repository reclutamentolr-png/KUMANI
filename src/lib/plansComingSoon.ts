import { getTranslations } from 'next-intl/server'
import { formatOpenDate, getPlansGate } from '@/lib/plansGate'
import type { SupabaseClient } from '@supabase/supabase-js'

// Dati del riquadro «Piani in arrivo» per una pagina: null se i piani sono
// aperti. joined: la persona è già in lista per l'avviso.
export async function getComingSoon(supabase: SupabaseClient, userId: string | null, locale: string) {
  const gate = await getPlansGate()
  if (!gate.closed) return null
  const [t, { data }] = await Promise.all([
    getTranslations({ locale, namespace: 'plansSoon' }),
    userId ? supabase.from('plan_waitlist').select('user_id').eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const date = formatOpenDate(locale, gate.openDate)
  return {
    joined: !!data,
    texts: { title: t('title', { date }), text: t('text'), notify: t('notify'), joined: t('joined', { date }) },
  }
}

// Pagine pubbliche (negozio, preventivo): solo la data, senza «Avvisami»
// perché chi paga può non avere un account KUMANI. null a pagamenti aperti.
export async function getPaymentsSoon(locale: string) {
  const gate = await getPlansGate()
  if (!gate.closed) return null
  const t = await getTranslations({ locale, namespace: 'plansSoon' })
  return { title: t('publicTitle', { date: formatOpenDate(locale, gate.openDate) }), text: t('publicText') }
}

export type PaymentsSoon = Awaited<ReturnType<typeof getPaymentsSoon>>
export type ComingSoon = Awaited<ReturnType<typeof getComingSoon>>
