import { randomBytes } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { SITE_URL } from '@/lib/siteUrl'

// Codici corti dei link dei Kumani (tabella share_links): uno per persona e
// per uso, creato la prima volta e poi sempre lo stesso.
// - video di un servizio: kumani.io/v/CODICE (tool = nome del servizio)
// - invito personale: kumani.io/i/CODICE (tool = INVITE_TOOL)
export const INVITE_TOOL = 'invito'

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Senza caratteri che si confondono (0/O, 1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const newSlug = () => [...randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('')

export async function ensureShareSlug(userId: string, tool: string): Promise<string | null> {
  const service = db()
  const find = async () => (await service.from('share_links').select('slug').eq('user_id', userId).eq('tool', tool).maybeSingle()).data?.slug ?? null
  const existing = await find()
  if (existing) return existing
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newSlug()
    const { error } = await service.from('share_links').insert({ slug, user_id: userId, tool })
    if (!error) return slug
    // Già creato nello stesso momento (altra scheda) o codice già usato: si riprova
    if (error.code !== '23505') {
      console.error('[share_links] creazione non riuscita:', error.message)
      return null
    }
    const again = await find()
    if (again) return again
  }
  return null
}

// Link d'invito corto del Kumano (senza lingua: chi lo apre lo vede nella
// sua); se non si riesce a crearlo, il link lungo con il codice invito
export async function getInviteUrl(userId: string, fallback: string): Promise<string> {
  const slug = await ensureShareSlug(userId, INVITE_TOOL).catch(() => null)
  return slug ? `${SITE_URL}/i/${slug}` : fallback
}
