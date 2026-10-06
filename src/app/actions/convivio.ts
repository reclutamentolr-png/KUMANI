'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isToolOnline } from '@/lib/toolOnline'
import { checkVat, verifyVies } from '@/lib/vat'
import type { ConvivioCard, ConvivioDetail, ConvivioLeaderStatus, ConvivioMessage, MySupplierInfo, SupplierSearchResult } from '@/lib/convivio'

// Convivio: le regole (verifica, soglia, adesioni, chat) sono nelle funzioni
// SQL convivio_*; qui solo il passaggio dal browser. La verifica d'identità
// e le regole sono in actions/verification.

// Client di servizio: solo il server scrive l'esito della verifica VIES.
const getServiceClient = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    console.error(`[Convivio] ${name} failed:`, error.message)
    return null
  }
  return data as T
}

export async function getLeaderStatus(): Promise<ConvivioLeaderStatus | null> {
  return rpc<ConvivioLeaderStatus>('convivio_my_leader_status')
}

export async function listConvivi(filter: 'open' | 'mine' | 'supplier'): Promise<ConvivioCard[]> {
  return (await rpc<ConvivioCard[]>('convivio_list', { p_filter: filter })) ?? []
}

export async function getConvivio(id: string): Promise<ConvivioDetail | null> {
  return rpc<ConvivioDetail>('convivio_detail', { p_group: id })
}

export async function createConvivio(input: {
  title: string
  description: string
  category: string
  supplier: string
  unit: string
  retail: number | null
  price: number
  min: number
  max: number | null
  expiresAt: string
  pickup: string
  // Fornitore KUMANI: se è l'utente stesso è un'offerta del fornitore Pro
  supplierId?: string | null
}): Promise<{ id?: string; error?: string }> {
  if (!(await isToolOnline('convivio'))) return { error: 'suspended' }
  const result = await rpc<{ id?: string; error?: string }>('convivio_create', {
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_supplier: input.supplier,
    p_unit: input.unit,
    p_retail: input.retail,
    p_price: input.price,
    p_min: input.min,
    p_max: input.max,
    p_expires: input.expiresAt,
    p_pickup: input.pickup,
    p_supplier_id: input.supplierId ?? null,
  })
  return result ?? { error: 'saveError' }
}

export async function updateConvivioInfo(id: string, description: string, pickup: string): Promise<string> {
  if (!(await isToolOnline('convivio'))) return 'suspended'
  return (await rpc<string>('convivio_update_info', { p_group: id, p_description: description, p_pickup: pickup })) ?? 'saveError'
}

export async function joinConvivio(id: string, quantity: number, note: string, sharePhone: boolean): Promise<string> {
  if (!(await isToolOnline('convivio'))) return 'suspended'
  return (await rpc<string>('convivio_join', { p_group: id, p_quantity: quantity, p_note: note, p_share_phone: sharePhone })) ?? 'saveError'
}

export async function leaveConvivio(id: string): Promise<string> {
  if (!(await isToolOnline('convivio'))) return 'suspended'
  return (await rpc<string>('convivio_leave', { p_group: id })) ?? 'saveError'
}

export async function setConvivioStatus(id: string, status: 'ordered' | 'completed' | 'cancelled'): Promise<string> {
  if (!(await isToolOnline('convivio'))) return 'suspended'
  return (await rpc<string>('convivio_set_status', { p_group: id, p_status: status })) ?? 'saveError'
}

export async function getConvivioMessages(id: string): Promise<ConvivioMessage[] | null> {
  return rpc<ConvivioMessage[] | null>('convivio_messages_list', { p_group: id })
}

export async function sendConvivioMessage(id: string, body: string): Promise<string> {
  if (!(await isToolOnline('convivio'))) return 'suspended'
  return (await rpc<string>('convivio_send', { p_group: id, p_body: body })) ?? 'saveError'
}

export async function reportConvivio(id: string, reason: string): Promise<boolean> {
  return (await rpc<boolean>('convivio_report', { p_group: id, p_reason: reason })) === true
}

// ---------- Fornitori KUMANI (professionisti Pro) ----------

export async function getMySupplier(): Promise<MySupplierInfo | null> {
  return rpc<MySupplierInfo>('convivio_my_supplier')
}

// Salva la scheda fornitore. La partita IVA si controlla qui (formato per
// paese, cifra di controllo italiana); per i paesi UE si prova la verifica
// sul VIES, che però non blocca mai il salvataggio.
// Esiti: 'ok' | 'ok_vies_invalid' | 'ok_vies_unavailable' | codice d'errore.
export async function saveSupplier(input: {
  businessName: string
  vatNumber: string
  vatCountry?: string
  city: string
  category: string
  description: string
  accepts: boolean
}): Promise<string> {
  if (!(await isToolOnline('convivio'))) return 'suspended'
  const vat = checkVat(input.vatCountry || 'IT', input.vatNumber)
  if (!vat.ok) {
    return vat.reason === 'checksum' ? 'invalid_vat_checksum' : vat.reason === 'country' ? 'invalid_vat_country' : 'invalid_vat'
  }

  const saved = await rpc<string>('convivio_supplier_save', {
    p_business: input.businessName,
    p_vat: vat.normalized,
    p_city: input.city,
    p_category: input.category,
    p_description: input.description,
    p_accepts: input.accepts,
    p_vat_country: vat.country,
  })
  if (saved !== 'ok') return saved ?? 'saveError'
  // Fuori UE non c'è una verifica online: resta "da verificare"
  if (!vat.eu) return 'ok'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'ok'

  const vies = await verifyVies(vat.normalized)
  if (vies.status === 'unavailable') return 'ok_vies_unavailable'

  const { error } = await getServiceClient()
    .from('convivio_suppliers')
    .update({
      vat_status: vies.status,
      vat_checked_at: new Date().toISOString(),
      vat_registered_name: vies.status === 'valid' ? (vies.name ?? null) : null,
    })
    .eq('user_id', user.id)
    // Solo se il numero è ancora quello appena verificato
    .eq('vat_number', vat.normalized)
  if (error) {
    console.error('[Kordata] VIES status update failed:', error.message)
    return 'ok_vies_unavailable'
  }
  return vies.status === 'valid' ? 'ok' : 'ok_vies_invalid'
}

export async function searchSuppliers(query: string): Promise<SupplierSearchResult[]> {
  return (await rpc<SupplierSearchResult[]>('convivio_supplier_search', { p_query: query })) ?? []
}

export async function supplierRespond(id: string, action: 'accept' | 'decline' | 'counter', price?: number | null, min?: number | null): Promise<string> {
  if (!(await isToolOnline('convivio'))) return 'suspended'
  return (await rpc<string>('convivio_supplier_respond', { p_group: id, p_action: action, p_price: price ?? null, p_min: min ?? null })) ?? 'saveError'
}

export async function answerCounter(id: string, accept: boolean): Promise<string> {
  if (!(await isToolOnline('convivio'))) return 'suspended'
  return (await rpc<string>('convivio_counter_answer', { p_group: id, p_accept: accept })) ?? 'saveError'
}

export async function reviewConvivio(id: string, target: 'supplier' | 'leader', rating: number, comment: string): Promise<string> {
  if (!(await isToolOnline('convivio'))) return 'suspended'
  return (await rpc<string>('convivio_review', { p_group: id, p_target: target, p_rating: rating, p_comment: comment })) ?? 'saveError'
}

// ---------- Commissione KUMANI a carico del fornitore Pro ----------

export type ConvivioFee = {
  id: string
  group_id: string
  title: string
  quantity: number
  price: number
  percent: number
  amount: number
  status: 'due' | 'paid' | 'waived'
  created_at: string
}

export type ConvivioMyFees = { percent: number; fees: ConvivioFee[] }

export async function getMyConvivioFees(): Promise<ConvivioMyFees> {
  const data = await rpc<ConvivioMyFees>('convivio_my_fees')
  return { percent: Number(data?.percent ?? 3), fees: data?.fees ?? [] }
}
