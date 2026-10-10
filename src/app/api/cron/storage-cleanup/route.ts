import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Pulizia giornaliera dei file non più usati (Vercel Cron, vedi vercel.json):
// foto del CV sostituite e immagini tolte dai preventivi, più vecchie dei
// giorni impostati dall'Admin (Limiti e pulizia → days_orphan_files). L'elenco
// lo prepara il database (storage_orphans); qui si cancellano con le API
// dello Storage, che tolgono davvero i file (non solo la riga).
// In più, KUMANI Nexus: le Sfide vecchie (con le loro mosse, la parte che pesa)
// e il registro della lingua del giorno. Risultati e giorni di fila restano.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const nexus = await cleanNexus(db)

  const { data, error } = await db.rpc('storage_orphans', { p_limit: 500 })
  if (error) {
    console.error('[storage-cleanup] orphans failed:', error.message)
    return NextResponse.json({ error: 'orphans_failed' }, { status: 500 })
  }
  const byBucket = new Map<string, string[]>()
  for (const row of (data ?? []) as { bucket: string; name: string }[]) {
    byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row.name])
  }
  const removed: Record<string, number> = {}
  for (const [bucket, names] of byBucket) {
    removed[bucket] = 0
    for (let i = 0; i < names.length; i += 100) {
      const chunk = names.slice(i, i + 100)
      const { error: removeError } = await db.storage.from(bucket).remove(chunk)
      if (removeError) console.error(`[storage-cleanup] ${bucket}:`, removeError.message)
      else removed[bucket] += chunk.length
    }
  }
  return NextResponse.json({ removed, nexus, at: new Date().toISOString() })
}

// KUMANI Nexus: sfide finite o annullate da più di 30 giorni, mai iniziate da
// più di 3, ferme da più di 2 (nessuno le gioca più); mosse e giocatori si
// cancellano con loro. La lingua del giorno serve solo per oggi e ieri.
async function cleanNexus(db: SupabaseClient) {
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
  const counts: Record<string, number> = {}
  const run = async (label: string, query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await query
    if (error) console.error(`[storage-cleanup] nexus ${label}:`, error.message)
    counts[label] = count ?? 0
  }
  await run('finished', db.from('nexus_duels').delete({ count: 'exact' }).in('status', ['finished', 'cancelled']).lt('updated_at', ago(30)))
  await run('waiting', db.from('nexus_duels').delete({ count: 'exact' }).eq('status', 'waiting').lt('created_at', ago(3)))
  await run('stalled', db.from('nexus_duels').delete({ count: 'exact' }).eq('status', 'live').lt('updated_at', ago(2)))
  await run('days', db.from('nexus_days').delete({ count: 'exact' }).lt('day', ago(7).slice(0, 10)))
  return counts
}
