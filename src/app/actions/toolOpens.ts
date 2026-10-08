'use server'

import { createClient } from '@/lib/supabase/server'

// Apertura di un servizio (una volta al giorno per utente, vedi
// ToolOpenTracker): serve solo alle statistiche dei servizi più usati in
// Admin → Panoramica. Il database ignora utenti non collegati e nomi sconosciuti.
export async function recordToolOpen(tool: string): Promise<void> {
  if (!/^[a-z0-9-]{2,40}$/.test(tool)) return
  try {
    const supabase = await createClient()
    await supabase.rpc('record_tool_open', { p_tool: tool })
  } catch {
    // Statistica facoltativa: nessun errore per l'utente
  }
}
