// Solo server (usa crypto di Node, cookie e service role): mai importare
// da un componente client.
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const getFidelityServiceClient = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// ---- PIN del negozio (sblocca la modalità cassa sui dispositivi senza account)

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pin, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(pin, salt, 32)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

// ---- Codici casuali

// Token segreto della tessera cliente (link /f/[token]).
export function newMemberToken(): string {
  return randomBytes(18).toString('base64url')
}

// Codice QR usa e getta mostrato in cassa.
export function newClaimCode(): string {
  return randomBytes(18).toString('base64url')
}

// Codice pubblico della tessera (QR personale del cliente): 8 caratteri
// senza lettere ambigue (0/O, 1/I/L), leggibile anche a voce.
const MEMBER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function newMemberCode(): string {
  let code = ''
  for (let i = 0; i < 8; i++) code += MEMBER_CODE_ALPHABET[randomInt(MEMBER_CODE_ALPHABET.length)]
  return code
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

// ---- Portafoglio del cliente: le tessere ricordate da questo browser.
// Cookie httpOnly impostato dal server (più durevole del localStorage, che
// Safari cancella dopo 7 giorni senza visite).

const WALLET_COOKIE = 'kumi_wallet'
const WALLET_MAX = 30

export async function readWalletTokens(): Promise<string[]> {
  const raw = (await cookies()).get(WALLET_COOKIE)?.value ?? ''
  return raw.split('.').filter((token) => /^[A-Za-z0-9_-]{16,64}$/.test(token)).slice(0, WALLET_MAX)
}

export async function addWalletToken(token: string): Promise<void> {
  const current = await readWalletTokens()
  if (current.includes(token)) return
  const next = [token, ...current].slice(0, WALLET_MAX)
  ;(await cookies()).set(WALLET_COOKIE, next.join('.'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 400,
  })
}

// ---- Accesso alla modalità cassa: il titolare loggato, oppure un
// dispositivo sbloccato con il PIN (cookie di sessione per tessera).

const cassaCookieName = (cardId: string) => `kumi_cassa_${cardId.replace(/-/g, '')}`
const CASSA_SESSION_DAYS = 30

export async function hasCassaAccess(cardId: string): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const service = getFidelityServiceClient()
  const { data: card } = await service.from('fidelity_cards').select('owner_id').eq('id', cardId).maybeSingle()
  if (!card) return false
  // La cassa funziona solo se il titolare ha ancora la Kumi Card nel piano e
  // lo Staff non ha spento lo strumento (come nel menù e negli eventi).
  const { data: access } = await service.rpc('tool_access', { p_user_id: card.owner_id, p_tool: 'fidelity' }).maybeSingle<{ allowed: boolean }>()
  if (!access?.allowed) return false
  if (user && card.owner_id === user.id) return true

  const secret = (await cookies()).get(cassaCookieName(cardId))?.value
  if (!secret) return false
  const { data: session } = await service
    .from('fidelity_cassa_sessions')
    .select('id')
    .eq('card_id', cardId)
    .eq('token_hash', sha256(secret))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return !!session
}

export async function openCassaSession(cardId: string): Promise<void> {
  const secret = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + CASSA_SESSION_DAYS * 24 * 60 * 60 * 1000)
  await getFidelityServiceClient()
    .from('fidelity_cassa_sessions')
    .insert({ card_id: cardId, token_hash: sha256(secret), expires_at: expires.toISOString() })
  ;(await cookies()).set(cassaCookieName(cardId), secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  })
}

export async function closeCassaSession(cardId: string): Promise<void> {
  const store = await cookies()
  const secret = store.get(cassaCookieName(cardId))?.value
  if (secret) {
    await getFidelityServiceClient().from('fidelity_cassa_sessions').delete().eq('token_hash', sha256(secret))
  }
  store.delete(cassaCookieName(cardId))
}

// Cambio PIN: tutti i dispositivi sbloccati col vecchio PIN vanno riloggati.
export async function revokeAllCassaSessions(cardId: string): Promise<void> {
  await getFidelityServiceClient().from('fidelity_cassa_sessions').delete().eq('card_id', cardId)
}
