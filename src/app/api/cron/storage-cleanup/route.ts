import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Pulizia giornaliera dei file non più usati (Vercel Cron, vedi vercel.json):
// foto del CV sostituite e immagini tolte dai preventivi, più vecchie dei
// giorni impostati dall'Admin (Limiti e pulizia → days_orphan_files). L'elenco
// lo prepara il database (storage_orphans); qui si cancellano con le API
// dello Storage, che tolgono davvero i file (non solo la riga).

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
  return NextResponse.json({ removed, at: new Date().toISOString() })
}
