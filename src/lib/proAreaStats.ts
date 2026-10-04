import type { SupabaseClient } from '@supabase/supabase-js'

// Numeri "a colpo d'occhio" per l'Area Professionisti: ogni strumento Pro
// mostra un dato della propria attività. Letti con il client dell'utente
// (RLS: solo i propri dati); se una lettura fallisce il dato manca e la
// scheda mostra la descrizione dello strumento.
export type ProAreaStats = {
  fidelity?: { members: number; stamps30d: number }
  preventivi?: { thisMonth: number }
  'digital-receipt'?: { pending: number }
  'qr-code-pro'?: { scans: number }
  offermaker?: { clicks: number }
  menu?: { items: number; soldOut: number }
  'landing-page'?: { published: boolean; unread: number }
}

const sumClicks = (rows: { click_count: number | null }[] | null) => (rows ?? []).reduce((sum, row) => sum + (row.click_count ?? 0), 0)

export async function getProAreaStats(supabase: SupabaseClient, userId: string): Promise<ProAreaStats> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [card, quotes, receipts, qrCodes, campaigns, menuItems, landing, landingUnread] = await Promise.all([
    supabase.from('fidelity_cards').select('id').eq('owner_id', userId).maybeSingle(),
    supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('issue_date', monthStart),
    supabase.from('digital_receipts').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('confirmed_at', null),
    supabase.from('qr_pro_codes').select('click_count').eq('user_id', userId),
    supabase.from('offermaker_campaigns').select('click_count').eq('user_id', userId),
    supabase.from('menu_items').select('available, menus!inner(owner_id)').eq('menus.owner_id', userId),
    supabase.from('landing_pages').select('is_published').eq('owner_id', userId).maybeSingle(),
    supabase.from('landing_messages').select('id', { count: 'exact', head: true }).eq('owner_id', userId).is('read_at', null),
  ])

  const stats: ProAreaStats = {}

  if (!card.error) {
    if (card.data) {
      const [members, stamps] = await Promise.all([
        supabase.from('fidelity_members').select('id', { count: 'exact', head: true }).eq('card_id', card.data.id),
        supabase
          .from('fidelity_events')
          .select('quantity')
          .eq('card_id', card.data.id)
          .eq('kind', 'stamp')
          .gte('created_at', since30d),
      ])
      if (!members.error && !stamps.error) {
        stats.fidelity = {
          members: members.count ?? 0,
          stamps30d: (stamps.data ?? []).reduce((sum, row) => sum + (row.quantity ?? 1), 0),
        }
      }
    } else {
      stats.fidelity = { members: 0, stamps30d: 0 }
    }
  }
  if (!quotes.error) stats.preventivi = { thisMonth: quotes.count ?? 0 }
  if (!receipts.error) stats['digital-receipt'] = { pending: receipts.count ?? 0 }
  if (!qrCodes.error) stats['qr-code-pro'] = { scans: sumClicks(qrCodes.data) }
  if (!campaigns.error) stats.offermaker = { clicks: sumClicks(campaigns.data) }
  if (!menuItems.error) {
    const rows = (menuItems.data ?? []) as { available: boolean }[]
    stats.menu = { items: rows.length, soldOut: rows.filter((row) => !row.available).length }
  }

  if (!landing.error && !landingUnread.error) stats['landing-page'] = { published: landing.data?.is_published === true, unread: landingUnread.count ?? 0 }

  return stats
}
