import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'

// Pass attivi delle persone invitate (pagina Rete, "non ancora attivi"):
// nome del servizio, scadenza e se è un regalo di chi guarda la pagina.
export type MemberPass = { service: string; expiresAt: string; giftFromMe: boolean }

export async function getMemberPasses(userIds: string[], viewerId: string): Promise<Map<string, MemberPass[]>> {
  const result = new Map<string, MemberPass[]>()
  if (!userIds.length) return result
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: rows } = await db
    .from('tool_passes')
    .select('user_id, tool, expires_at, code')
    .in('user_id', userIds)
    .is('revoked_at', null)
    .is('converted_at', null)
    .gt('expires_at', new Date().toISOString())
  if (!rows?.length) return result

  // Codici regalo comprati da chi guarda
  const codes = rows.map((row) => row.code as string | null).filter((code): code is string => !!code)
  const mine = new Set<string>()
  if (codes.length) {
    const { data: gifts } = await db.from('gift_codes').select('code, gift_orders!inner(buyer_id)').in('code', codes).eq('gift_orders.buyer_id', viewerId)
    for (const gift of gifts ?? []) mine.add(gift.code as string)
  }

  const tm = await getTranslations('marketplace')
  const names = new Map(getMarketplaceTools((key) => tm(key)).map((tool) => [tool.toolName, tool.title]))
  for (const row of rows) {
    const list = result.get(row.user_id as string) ?? []
    list.push({ service: names.get(row.tool as string) ?? (row.tool as string), expiresAt: row.expires_at as string, giftFromMe: !!row.code && mine.has(row.code as string) })
    result.set(row.user_id as string, list)
  }
  return result
}
