// Biglietto digitale di un voucher Base o Pro (/biglietto/CODICE): grafica,
// frase, «per» e «da» viaggiano nel link (chi ha il link ha già il codice,
// quindi non c'è niente da proteggere); qui si leggono e si ripuliscono.

export const CARD_DESIGNS = ['A', 'B', 'C'] as const
export const CARD_PHRASES = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const
export const CARD_CUSTOM_MAX = 110
export const CARD_NAME_MAX = 40

export type CardDesign = (typeof CARD_DESIGNS)[number]
export type CardOptions = { design: CardDesign; phrase: (typeof CARD_PHRASES)[number] | 'custom'; custom: string; to: string; from: string }

const clean = (value: string | null | undefined, max: number) =>
  (value ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

export const CARD_CODE_RE = /^[A-Z0-9-]{6,30}$/

export function cardLink(siteUrl: string, locale: string, code: string, o: CardOptions): string {
  const q = new URLSearchParams({ d: o.design, p: o.phrase === 'custom' ? 'c' : o.phrase })
  if (o.phrase === 'custom' && clean(o.custom, CARD_CUSTOM_MAX)) q.set('t', clean(o.custom, CARD_CUSTOM_MAX))
  if (clean(o.to, CARD_NAME_MAX)) q.set('to', clean(o.to, CARD_NAME_MAX))
  if (clean(o.from, CARD_NAME_MAX)) q.set('from', clean(o.from, CARD_NAME_MAX))
  const prefix = locale === 'it' ? '' : `/${locale}`
  return `${siteUrl.replace(/\/+$/, '')}${prefix}/biglietto/${encodeURIComponent(code)}?${q.toString()}`
}

export function readCardOptions(sp: Record<string, string | string[] | undefined>): CardOptions {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined))
  const d = one('d')
  const p = one('p')
  return {
    design: (CARD_DESIGNS as readonly string[]).includes(d ?? '') ? (d as CardDesign) : 'A',
    phrase: p === 'c' ? 'custom' : (CARD_PHRASES as readonly string[]).includes(p ?? '') ? (p as (typeof CARD_PHRASES)[number]) : 'p2',
    custom: clean(one('t'), CARD_CUSTOM_MAX),
    to: clean(one('to'), CARD_NAME_MAX),
    from: clean(one('from'), CARD_NAME_MAX),
  }
}
