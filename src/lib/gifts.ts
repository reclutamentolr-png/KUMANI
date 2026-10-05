// Regali: codici GIFT-XXXX-XXXX comprati con carta per il Pass di un servizio
// o per un anno di KUMANI Base/Pro, da mandare a chi si vuole (link
// /regalo/CODICE). Regole nelle funzioni SQL *gift* (migration gifts).

export const GIFT_TYPE = 'gift'
export const GIFT_MAX_QUANTITY = 10
export const GIFT_MESSAGE_MAX = 300
export const GIFT_CODE_RE = /^GIFT-[A-Z0-9]{4}-[A-Z0-9]{4}$/

export type GiftKind = 'pass' | 'plan'
export type GiftCodeStatus = 'valid' | 'redeemed' | 'expired' | 'revoked' | 'not_found'
export type GiftRedeemReason =
  | 'not_authenticated'
  | 'not_found'
  | 'revoked'
  | 'already_used'
  | 'expired'
  | 'self'
  | 'not_allowed'
  | 'unavailable'
  | 'already_included'
  | 'already_subscribed'
  | 'error'

export type GiftCodeInfo = {
  status: GiftCodeStatus
  kind?: GiftKind
  tool?: string | null
  plan?: 'base' | 'pro' | null
  message?: string | null
  valid_until?: string
  giver_name?: string | null
  giver_referral?: string | null
  mine?: boolean
  redeemed_by_me?: boolean
}

export type GiftOrderCode = { code: string; valid_until: string; redeemed_at: string | null; redeemed_name: string | null; revoked: boolean }

export type GiftOrder = {
  id: string
  kind: GiftKind
  tool: string | null
  plan: 'base' | 'pro' | null
  quantity: number
  amount_cents: number
  message: string | null
  created_at: string
  refunded: boolean
  codes: GiftOrderCode[]
}

export const normalizeGiftCode = (code: string) => code.trim().toUpperCase()

// Percorso della pagina del regalo (senza prefisso lingua)
export const giftPath = (code: string) => `/regalo/${encodeURIComponent(code)}`

// Pagina pubblica che spiega cosa si regala (visibile senza account): la
// presentazione del servizio per un Pass, il catalogo dei servizi per Base/Pro
export const giftInfoPath = (kind: GiftKind | null | undefined, tool: string | null | undefined) =>
  kind === 'pass' && tool ? `/strumenti/${encodeURIComponent(tool)}` : '/catalogo'
