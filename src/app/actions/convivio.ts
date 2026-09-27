'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { normalizeTaxCode, validateTaxCode } from '@/lib/codiceFiscale'
import type { ConvivioCard, ConvivioDetail, ConvivioLeaderStatus, ConvivioMessage, MySupplierInfo, SupplierSearchResult } from '@/lib/convivio'

// Convivio: le regole (verifica, soglia, adesioni, chat) sono nelle funzioni
// SQL convivio_*; qui solo il passaggio dal browser, più la verifica del
// codice fiscale (che scrive con il client di servizio dopo i controlli).

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

// Diventare capocordata: codice fiscale verificato + accettazione regole.
export async function becomeLeader(taxCode: string, acceptTerms: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'notLoggedIn' }
  if (!acceptTerms) return { success: false, error: 'terms' }

  const { data: profile } = await supabase.rpc('get_my_profile').maybeSingle<{ first_name: string; last_name: string; date_of_birth: string | null }>()
  if (!profile) return { success: false, error: 'notLoggedIn' }
  const birthDate = profile.date_of_birth && profile.date_of_birth !== '2000-01-01' ? profile.date_of_birth : null
  if (!birthDate) return { success: false, error: 'birthdateMissing' }

  const code = normalizeTaxCode(taxCode)
  const problem = validateTaxCode(code, { firstName: profile.first_name ?? '', lastName: profile.last_name ?? '', birthDate })
  if (problem) return { success: false, error: `taxCode_${problem}` }

  const { error } = await getServiceClient()
    .from('profiles')
    .update({ tax_code: code, convivio_terms_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { success: false, error: error.code === '23505' ? 'taxCode_used' : 'saveError' }
  return { success: true }
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
  return (await rpc<string>('convivio_update_info', { p_group: id, p_description: description, p_pickup: pickup })) ?? 'saveError'
}

export async function joinConvivio(id: string, quantity: number, note: string, sharePhone: boolean): Promise<string> {
  return (await rpc<string>('convivio_join', { p_group: id, p_quantity: quantity, p_note: note, p_share_phone: sharePhone })) ?? 'saveError'
}

export async function leaveConvivio(id: string): Promise<string> {
  return (await rpc<string>('convivio_leave', { p_group: id })) ?? 'saveError'
}

export async function setConvivioStatus(id: string, status: 'ordered' | 'completed' | 'cancelled'): Promise<string> {
  return (await rpc<string>('convivio_set_status', { p_group: id, p_status: status })) ?? 'saveError'
}

export async function getConvivioMessages(id: string): Promise<ConvivioMessage[] | null> {
  return rpc<ConvivioMessage[] | null>('convivio_messages_list', { p_group: id })
}

export async function sendConvivioMessage(id: string, body: string): Promise<string> {
  return (await rpc<string>('convivio_send', { p_group: id, p_body: body })) ?? 'saveError'
}

export async function reportConvivio(id: string, reason: string): Promise<boolean> {
  return (await rpc<boolean>('convivio_report', { p_group: id, p_reason: reason })) === true
}

// ---------- Fornitori KUMANI (professionisti Pro) ----------

export async function getMySupplier(): Promise<MySupplierInfo | null> {
  return rpc<MySupplierInfo>('convivio_my_supplier')
}

export async function saveSupplier(input: {
  businessName: string
  vatNumber: string
  city: string
  category: string
  description: string
  accepts: boolean
}): Promise<string> {
  return (
    (await rpc<string>('convivio_supplier_save', {
      p_business: input.businessName,
      p_vat: input.vatNumber,
      p_city: input.city,
      p_category: input.category,
      p_description: input.description,
      p_accepts: input.accepts,
    })) ?? 'saveError'
  )
}

export async function searchSuppliers(query: string): Promise<SupplierSearchResult[]> {
  return (await rpc<SupplierSearchResult[]>('convivio_supplier_search', { p_query: query })) ?? []
}

export async function supplierRespond(id: string, action: 'accept' | 'decline' | 'counter', price?: number | null, min?: number | null): Promise<string> {
  return (await rpc<string>('convivio_supplier_respond', { p_group: id, p_action: action, p_price: price ?? null, p_min: min ?? null })) ?? 'saveError'
}

export async function answerCounter(id: string, accept: boolean): Promise<string> {
  return (await rpc<string>('convivio_counter_answer', { p_group: id, p_accept: accept })) ?? 'saveError'
}

export async function reviewConvivio(id: string, target: 'supplier' | 'leader', rating: number, comment: string): Promise<string> {
  return (await rpc<string>('convivio_review', { p_group: id, p_target: target, p_rating: rating, p_comment: comment })) ?? 'saveError'
}
