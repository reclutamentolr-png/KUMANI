import type { SupabaseClient } from '@supabase/supabase-js'
import type { Reaction } from '@/lib/surprise'

// Ringraziamenti non letti di chi ha creato sorprese (busta in «Le mie
// sorprese», popup in dashboard). Letti con il client della persona: le
// regole del database mostrano solo i ringraziamenti delle sue sorprese.

export type UnreadReply = {
  id: string
  giftId: string
  giftTitle: string
  recipientName: string
  reaction: Reaction | null
  message: string
  photoUrl: string | null
  createdAt: string
}

export async function getUnreadReplies(supabase: SupabaseClient, limit = 5): Promise<{ items: UnreadReply[]; total: number }> {
  const { data, count } = await supabase
    .from('surprise_replies')
    .select('id, gift_id, reaction, message, photo_path, created_at, surprise_gifts!inner(title, recipient_name)', { count: 'exact' })
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = (data ?? []) as unknown as {
    id: string
    gift_id: string
    reaction: Reaction | null
    message: string
    photo_path: string | null
    created_at: string
    surprise_gifts: { title: string; recipient_name: string } | { title: string; recipient_name: string }[]
  }[]
  const paths = rows.map((r) => r.photo_path).filter(Boolean) as string[]
  const { data: signed } = paths.length ? await supabase.storage.from('surprise-media').createSignedUrls(paths, 3600) : { data: [] }
  const urls = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]))
  return {
    total: count ?? rows.length,
    items: rows.map((r) => {
      const gift = Array.isArray(r.surprise_gifts) ? r.surprise_gifts[0] : r.surprise_gifts
      return {
        id: r.id,
        giftId: r.gift_id,
        giftTitle: gift?.title ?? '',
        recipientName: gift?.recipient_name ?? '',
        reaction: r.reaction,
        message: r.message,
        photoUrl: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
        createdAt: r.created_at,
      }
    }),
  }
}
