// Natale su KUMANI (Admin → Natale), parte usata anche nel browser:
// - decorazioni (ghirlanda sotto la barra nera, cappello sul logo): «auto»
//   dal 1° dicembre al 6 gennaio, oppure sempre accese o spente;
// - offerta: sconto sui regali (un anno di Base/Pro da regalare) e sul primo
//   anno di chi si abbona, tra le date scelte. Spenta finché l'Admin non la
//   accende. Si salva in system_settings.christmas.
export type ChristmasMode = 'auto' | 'on' | 'off'

export type ChristmasSettings = {
  decorations: ChristmasMode
  offer: boolean
  giftPct: number
  planPct: number
  from: string
  until: string
}

// L'offerta attiva in questo momento (null = nessuna)
export type ChristmasOffer = { giftPct: number; planPct: number; until: string }

export type ChristmasState = { decorations: boolean; offer: ChristmasOffer | null }

export const CHRISTMAS_MAX_PCT = 50

export const DEFAULT_CHRISTMAS: ChristmasSettings = {
  decorations: 'auto',
  offer: false,
  giftPct: 20,
  planPct: 20,
  from: '2026-12-01',
  until: '2027-01-06',
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const pct = (value: unknown, fallback: number) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), CHRISTMAS_MAX_PCT) : fallback
}

export function parseChristmas(value: unknown): ChristmasSettings {
  let raw: unknown = value
  try {
    raw = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return DEFAULT_CHRISTMAS
  }
  if (!raw || typeof raw !== 'object') return DEFAULT_CHRISTMAS
  const r = raw as Record<string, unknown>
  return {
    decorations: r.decorations === 'on' || r.decorations === 'off' ? r.decorations : 'auto',
    offer: r.offer === true,
    giftPct: pct(r.giftPct, DEFAULT_CHRISTMAS.giftPct),
    planPct: pct(r.planPct, DEFAULT_CHRISTMAS.planPct),
    from: typeof r.from === 'string' && DATE_RE.test(r.from) ? r.from : DEFAULT_CHRISTMAS.from,
    until: typeof r.until === 'string' && DATE_RE.test(r.until) ? r.until : DEFAULT_CHRISTMAS.until,
  }
}

// Data di oggi in Italia (AAAA-MM-GG): Natale e offerta seguono l'ora italiana
export const romeDate = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(now)

export function christmasState(settings: ChristmasSettings, today: string): ChristmasState {
  const monthDay = today.slice(5)
  const season = monthDay >= '12-01' || monthDay <= '01-06'
  const decorations = settings.decorations === 'on' || (settings.decorations === 'auto' && season)
  const offerOn = settings.offer && today >= settings.from && today <= settings.until && (settings.giftPct > 0 || settings.planPct > 0)
  return { decorations, offer: offerOn ? { giftPct: settings.giftPct, planPct: settings.planPct, until: settings.until } : null }
}

// Prezzo scontato in centesimi (mai sotto 1 €)
export const discounted = (cents: number, percent: number) => Math.max(Math.round(cents * (1 - percent / 100)), 100)

// «6 gennaio»: ultimo giorno dell'offerta scritto nella lingua della pagina
export const formatOfferDate = (locale: string, date: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'))
