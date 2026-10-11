'use server'

import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { MY_DATA_SERVICES, myDataService, type MyDataTable } from '@/lib/myData'

// «I miei dati nei servizi»: chi ha effettuato l'accesso vede, scarica e
// cancella i propri dati di ogni servizio anche senza piano attivo (i dati
// sono suoi). Si usa il service role, sempre filtrato sull'utente di sessione.

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// Righe della persona in una tabella (con le scadenze di Casa separate da Life Calendar)
function scoped(db: SupabaseClient, spec: MyDataTable, userId: string) {
  return {
    count: () => {
      let q = db.from(spec.table).select('*', { count: 'exact', head: true }).eq(spec.column, userId)
      if (spec.casa === 'only') q = q.not('casa_home_id', 'is', null)
      if (spec.casa === false) q = q.is('casa_home_id', null)
      return q
    },
    rows: (from: number, to: number) => {
      let q = db.from(spec.table).select('*').eq(spec.column, userId)
      if (spec.casa === 'only') q = q.not('casa_home_id', 'is', null)
      if (spec.casa === false) q = q.is('casa_home_id', null)
      return q.order('created_at', { ascending: true }).range(from, to)
    },
    remove: () => {
      let q = db.from(spec.table).delete().eq(spec.column, userId)
      if (spec.casa === 'only') q = q.not('casa_home_id', 'is', null)
      if (spec.casa === false) q = q.is('casa_home_id', null)
      return q
    },
  }
}

export type MyDataSummary = { key: string; tool: string; count: number }

export async function listMyData(): Promise<MyDataSummary[]> {
  const userId = await sessionUserId()
  if (!userId) return []
  const db = service()
  const result = await Promise.all(
    MY_DATA_SERVICES.map(async (s) => {
      const counts = await Promise.all(s.tables.map(async (spec) => (await scoped(db, spec, userId).count()).count ?? 0))
      return { key: s.key, tool: s.tool, count: counts.reduce((a, b) => a + b, 0) }
    })
  )
  return result.filter((r) => r.count > 0)
}

// Copia dei dati di un servizio (JSON), da salvare sul proprio dispositivo
export async function exportMyData(key: string): Promise<{ success: true; data: Record<string, unknown[]> } | { success: false }> {
  const userId = await sessionUserId()
  const svc = myDataService(key)
  if (!userId || !svc) return { success: false }
  const db = service()
  const data: Record<string, unknown[]> = {}
  for (const spec of svc.tables) {
    const { data: rows, error } = await fetchAllRows((from, to) => scoped(db, spec, userId).rows(from, to))
    if (error) return { success: false }
    const label = spec.casa === 'only' ? `${spec.table} (casa)` : spec.table
    data[label] = rows
  }
  return { success: true, data }
}

// Tutti i file della persona in uno spazio (anche nelle sottocartelle)
async function listFiles(db: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 3) return []
  const { data } = await db.storage.from(bucket).list(prefix, { limit: 1000 })
  const files: string[] = []
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`
    if (item.id) files.push(path)
    else files.push(...(await listFiles(db, bucket, path, depth + 1)))
  }
  return files
}

// Cancella tutti i dati di un servizio (e i suoi file). Non si torna indietro.
export async function deleteMyData(key: string): Promise<{ success: boolean }> {
  const userId = await sessionUserId()
  const svc = myDataService(key)
  if (!userId || !svc) return { success: false }
  const db = service()
  for (const spec of svc.tables) {
    const { error } = await scoped(db, spec, userId).remove()
    if (error) {
      console.error(`[myData] ${spec.table}:`, error.message)
      return { success: false }
    }
  }
  for (const bucket of svc.buckets) {
    const files = await listFiles(db, bucket, userId)
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await db.storage.from(bucket).remove(files.slice(i, i + 100))
      if (error) console.error(`[myData] ${bucket}:`, error.message)
    }
  }
  return { success: true }
}
