'use server'

import { randomUUID } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { normalizeTaxCode, validateTaxCode } from '@/lib/codiceFiscale'

// Verifica "Kumano Verificato" condivisa da Kordata ed Events:
// identità (codice fiscale italiano OPPURE documento controllato dallo Staff)
// e accettazione delle regole. Le colonne privilegiate di profiles
// (tax_code, convivio_terms_at, events_terms_at) si scrivono solo con il
// client di servizio, dopo i controlli fatti qui.

type Result = { success: boolean; error?: string }

export type IdentityDocType = 'passport' | 'id_card' | 'driving_license' | 'residence_permit'

const DOC_TYPES: IdentityDocType[] = ['passport', 'id_card', 'driving_license', 'residence_permit']
const MAX_FILE_SIZE = 5 * 1024 * 1024
const FILE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const getServiceClient = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// Codice fiscale italiano: deve corrispondere a nome, cognome e data di
// nascita del profilo. Un codice già verificato non si sostituisce
// (altrimenti si libererebbe per un secondo account).
export async function verifyTaxCode(taxCode: string): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'notLoggedIn' }

  const { data: profile } = await supabase.rpc('get_my_profile').maybeSingle<{ first_name: string; last_name: string; date_of_birth: string | null }>()
  if (!profile) return { success: false, error: 'notLoggedIn' }
  const birthDate = profile.date_of_birth && profile.date_of_birth !== '2000-01-01' ? profile.date_of_birth : null
  if (!birthDate) return { success: false, error: 'birthdateMissing' }

  const code = normalizeTaxCode(taxCode)
  const problem = validateTaxCode(code, { firstName: profile.first_name ?? '', lastName: profile.last_name ?? '', birthDate })
  if (problem) return { success: false, error: `taxCode_${problem}` }

  const service = getServiceClient()
  const { data: current } = await service.from('profiles').select('tax_code, is_blocked').eq('id', user.id).maybeSingle()
  if (!current || current.is_blocked) return { success: false, error: 'blocked' }
  if (current.tax_code === code) return { success: true }
  if (current.tax_code) return { success: false, error: 'taxCode_used' }

  const { error } = await service.from('profiles').update({ tax_code: code }).eq('id', user.id)
  if (error) return { success: false, error: error.code === '23505' ? 'taxCode_used' : 'saveError' }
  return { success: true }
}

// Documento d'identità (per chi non ha il codice fiscale italiano): la foto
// va nel bucket privato 'identity-docs', la vede solo lo Staff e viene
// cancellata dopo il controllo.
export async function submitIdentityDocument(formData: FormData): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { success: false, error: 'notLoggedIn' }

  const docType = String(formData.get('docType') ?? '') as IdentityDocType
  const countryCode = String(formData.get('countryCode') ?? '').trim().toUpperCase()
  const file = formData.get('file')
  if (!DOC_TYPES.includes(docType)) return { success: false, error: 'docType' }
  if (!/^[A-Z]{2}$/.test(countryCode)) return { success: false, error: 'country' }
  if (!(file instanceof File) || file.size === 0) return { success: false, error: 'fileMissing' }
  if (file.size > MAX_FILE_SIZE) return { success: false, error: 'fileTooBig' }
  const ext = FILE_TYPES[file.type]
  if (!ext) return { success: false, error: 'fileType' }

  const service = getServiceClient()
  const { data: profile } = await service.from('profiles').select('tax_code, is_blocked').eq('id', userId).maybeSingle()
  if (!profile || profile.is_blocked) return { success: false, error: 'blocked' }
  if (profile.tax_code) return { success: false, error: 'alreadyVerified' }

  const { data: existing } = await service
    .from('identity_verifications')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved'])
    .limit(1)
  if (existing?.some((row) => row.status === 'approved')) return { success: false, error: 'alreadyVerified' }
  if (existing?.length) return { success: false, error: 'alreadyPending' }

  const path = `${userId}/${randomUUID()}.${ext}`
  const { error: uploadError } = await service.storage
    .from('identity-docs')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (uploadError) {
    console.error('[Verification] upload failed:', uploadError.message)
    return { success: false, error: 'uploadError' }
  }

  const { error } = await service
    .from('identity_verifications')
    .insert({ user_id: userId, doc_type: docType, country_code: countryCode, file_path: path })
  if (error) {
    // Niente riga → niente foto orfana nel bucket
    await service.storage.from('identity-docs').remove([path])
    return { success: false, error: error.code === '23505' ? 'alreadyPending' : 'saveError' }
  }
  return { success: true }
}

// Regole accettate: Kordata (capocordata) oppure Events (organizzatore).
export async function acceptRules(kind: 'kordata' | 'events' | 'timebank'): Promise<Result> {
  if (kind !== 'kordata' && kind !== 'events' && kind !== 'timebank') return { success: false, error: 'saveError' }
  const userId = await currentUserId()
  if (!userId) return { success: false, error: 'notLoggedIn' }

  const service = getServiceClient()
  const { data: profile } = await service.from('profiles').select('is_blocked').eq('id', userId).maybeSingle()
  if (!profile || profile.is_blocked) return { success: false, error: 'blocked' }

  const column = kind === 'kordata' ? 'convivio_terms_at' : kind === 'events' ? 'events_terms_at' : 'timebank_terms_at'
  const { error } = await service
    .from('profiles')
    .update({ [column]: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { success: false, error: 'saveError' }
  return { success: true }
}
