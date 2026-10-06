'use server'

import { getMessages, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { DOC_LOCALES, type DocLocale } from '@/lib/documents'
import { deckCatalog, deckServices } from '@/lib/deck/deckData'
import type { DeckCatalogGroup, DeckPlan, DeckVariant } from '@/lib/deck/types'

// Testi con i numeri dei servizi (plurali ICU della lingua)
const COUNTED_KEYS = ['s5.stats.1.1', 's5.stats.1.2', 's5.stats.1.3', 's5.notes', 's8.plans.1.5', 's8.plans.2.5', 's8.plans.3.5', 's8.notes', 's17.steps.1.2', 'full.sub', 'full.introNotes']

function setPath(obj: Record<string, unknown>, path: string, value: string) {
  const keys = path.split('.')
  let node = obj
  for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>
  node[keys[keys.length - 1]] = value
}

// Testi della presentazione in una lingua (con le correzioni dei traduttori),
// per crearla nel browser al momento del download. Solo per gli iscritti.
// Il numero dei servizi viene dai servizi accesi (marketplace_settings); la
// versione Full riceve anche tutti i servizi per gruppo, nella lingua.
export async function getDeckTexts(
  locale: string,
  variant: DeckVariant = 'lite'
): Promise<{
  texts?: unknown
  minPassEur?: number | null
  landingPassEur?: number | null
  donationPercentBp?: number | null
  catalog?: DeckCatalogGroup[]
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  if (!DOC_LOCALES.includes(locale as DocLocale)) return { error: 'locale' }
  const messages = (await getMessages({ locale })) as Record<string, unknown>
  if (!messages.deckTexts) return { error: 'missing' }
  const [td, tm, th, { data: settings }, { data: donation }] = await Promise.all([
    getTranslations({ locale, namespace: 'deckTexts' }),
    getTranslations({ locale, namespace: 'marketplace' }),
    getTranslations({ locale, namespace: 'hub' }),
    supabase.from('marketplace_settings').select('tool_name, is_enabled, required_plan, pass_enabled, pass_price_cents'),
    // Percentuale di ogni abbonamento donata (Admin → Donazioni)
    supabase.rpc('donation_public_summary'),
  ])
  const rows = (settings ?? []) as { tool_name: string; is_enabled: boolean; required_plan: DeckPlan | null; pass_enabled: boolean; pass_price_cents: number | null }[]
  const on = rows.filter((r) => r.is_enabled)

  // Prezzo del Pass più economico tra i servizi vendibili da soli (Admin)
  const cents = on.filter((r) => r.pass_enabled && r.required_plan !== 'free').map((r) => r.pass_price_cents ?? 0).filter((n) => n > 0)
  const minPassEur = cents.length ? Math.min(...cents) / 100 : null
  // Prezzo del Pass della Landing Page (slide dedicata), se in vendita da sola
  const landing = on.find((r) => r.tool_name === 'landing-page' && r.pass_enabled)
  const landingPassEur = landing?.pass_price_cents ? landing.pass_price_cents / 100 : null
  const donationPercentBp = (donation as { percent_bp?: number } | null)?.percent_bp ?? null

  // Servizi accesi e quanti sono per piano: i numeri vanno nei testi ({price}
  // resta, lo riempie il browser con il prezzo formattato)
  const enabled = new Map(on.map((r) => [r.tool_name, r.required_plan ?? 'free']))
  const { services, counts } = deckServices(enabled, (key) => tm(key), { name: td('full.chatName'), description: td('full.chatDesc') })
  const texts = structuredClone(messages.deckTexts) as Record<string, unknown>
  for (const key of COUNTED_KEYS) setPath(texts, key, td(key, { ...counts, price: '{price}' }))

  const catalog =
    variant === 'full'
      ? deckCatalog(services, {
          label: (group) => (group === 'community' ? td('full.community') : th(`group_${group}`)),
          count: (n) => td('full.count', { count: n }),
          sub: (n) => td('full.groupSub', { count: n }),
          notes: (label, n, names) => td('full.notes', { group: label, count: n, names }),
        })
      : undefined

  return { texts, minPassEur, landingPassEur, donationPercentBp, catalog }
}
