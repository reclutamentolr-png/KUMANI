import type { SupabaseClient } from '@supabase/supabase-js'
import type { KumaniDoc, PersonalDoc } from '@/lib/documents'

// Letture per la pagina Documenti, con il client dell'utente: le regole del
// database (RLS) mostrano solo i documenti pubblicati e solo i dati propri.

export async function listKumaniDocuments(supabase: SupabaseClient): Promise<KumaniDoc[]> {
  const { data, error } = await supabase
    .from('kumani_documents')
    .select('id, title, description, category, sort_order, is_published, files:kumani_document_files(id, locale, format, file_name, size_bytes, uploaded_at)')
    .eq('is_published', true)
    .order('sort_order')
    .order('created_at')
  if (error) {
    console.error('[documenti] elenco non letto:', error.message)
    return []
  }
  return (data ?? []) as unknown as KumaniDoc[]
}

const LIMIT = 50

export async function listPersonalDocuments(supabase: SupabaseClient, userId: string): Promise<PersonalDoc[]> {
  const [quotes, receipts, cvs, coupons, events, vouchers, received, homeDocs] = await Promise.all([
    supabase.from('quotes').select('id, quote_number, client_name, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(LIMIT),
    supabase.from('digital_receipts').select('id, object_name, recipient_name, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(LIMIT),
    supabase.from('cvs').select('id, title, full_name, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(LIMIT),
    supabase.from('wallet_coupons').select('id, title, code, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(LIMIT),
    supabase
      .from('event_participants')
      .select('id, pass_token, status, created_at, event:events(title, starts_at)')
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(LIMIT),
    supabase
      .from('subscription_vouchers')
      .select('id, code, buyer_name, sold_at, status, created_at')
      .eq('created_by', userId)
      .not('sold_at', 'is', null)
      .neq('status', 'revoked')
      .order('sold_at', { ascending: false })
      .limit(LIMIT),
    // Ricevute fatte da altri e confermate con l'accesso
    supabase.rpc('my_received_receipts', { p_limit: LIMIT }),
    // KUMANI Casa: i documenti di ogni casa
    supabase.from('casa_documents').select('id, home_id, title, created_at, home:casa_homes(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(LIMIT),
  ])

  const docs: PersonalDoc[] = []
  for (const q of quotes.data ?? [])
    docs.push({ kind: 'quote', id: q.id, title: `#${q.quote_number}`, subtitle: q.client_name || null, date: q.created_at, href: `/marketplace/preventivi/${q.id}` })
  for (const r of receipts.data ?? [])
    docs.push({ kind: 'receipt', id: r.id, title: r.object_name || '', subtitle: r.recipient_name || null, date: r.created_at, href: `/marketplace/digital-receipt/${r.id}` })
  for (const c of cvs.data ?? [])
    docs.push({ kind: 'cv', id: c.id, title: c.title || c.full_name || '', subtitle: c.title && c.full_name ? c.full_name : null, date: c.created_at, href: `/marketplace/kumani-cv/${c.id}` })
  for (const c of coupons.data ?? [])
    docs.push({ kind: 'coupon', id: c.id, title: c.title || c.code, subtitle: c.code, date: c.created_at, href: '/wallet' })
  for (const e of events.data ?? []) {
    const ev = (Array.isArray(e.event) ? e.event[0] : e.event) as { title?: string; starts_at?: string } | null
    if (!e.pass_token) continue
    docs.push({ kind: 'event', id: e.id, title: ev?.title || '', subtitle: null, date: ev?.starts_at || e.created_at, href: `/events/pass/${e.pass_token}` })
  }
  for (const v of vouchers.data ?? [])
    docs.push({ kind: 'voucher', id: v.id, title: v.code, subtitle: v.buyer_name || null, date: v.sold_at || v.created_at, href: `/wallet/voucher/${v.id}` })

  for (const r of (received.data ?? []) as { code: string; object_name: string; delivery_date: string; confirmed_at: string | null }[])
    docs.push({ kind: 'receipt_received', id: r.code, title: r.object_name || r.code, subtitle: null, date: r.confirmed_at || r.delivery_date, href: `/ricevute/${r.code}` })

  for (const d of homeDocs.data ?? []) {
    const home = (Array.isArray(d.home) ? d.home[0] : d.home) as { name?: string } | null
    docs.push({ kind: 'home_doc', id: d.id, title: d.title, subtitle: home?.name || null, date: d.created_at, href: `/marketplace/casa/${d.home_id}?tab=documents` })
  }

  for (const res of [quotes, receipts, cvs, coupons, events, vouchers, received, homeDocs]) if (res.error) console.error('[documenti] personali:', res.error.message)
  return docs
}
