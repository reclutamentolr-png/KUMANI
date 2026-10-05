'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { checkVat, verifyVies } from '@/lib/vat'
import { verifyTaxCode } from '@/app/actions/verification'

// Prova Pro gratuita: solo con Partita IVA verificata oppure, per chi lavora
// senza Partita IVA, con il codice fiscale (coerente con nome, cognome e
// data di nascita del profilo). Una prova per Partita IVA o codice fiscale,
// per sempre (regole finali in grant_pro_trial()).

export type ProTrialResult = { success: boolean; reason?: string; endsAt?: string }

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export async function startVerifiedProTrial(input: { type: 'vat' | 'tax_code'; country?: string; value: string }): Promise<ProTrialResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, reason: 'not_logged' }

  let idValue: string
  let viesName: string | null = null
  if (input.type === 'vat') {
    const check = checkVat(input.country || 'IT', input.value)
    if (!check.ok) return { success: false, reason: `vat_${check.reason}` }
    if (check.eu) {
      // Il VIES dice se la Partita IVA esiste; se il servizio non risponde
      // non si blocca chi è in regola (basta il controllo del formato)
      const vies = await verifyVies(check.normalized)
      if (vies.status === 'invalid') return { success: false, reason: 'vat_vies_invalid' }
      viesName = vies.status === 'valid' ? (vies.name ?? null) : null
    }
    idValue = check.normalized
  } else {
    // Stesso controllo della verifica d'identità: il codice deve corrispondere
    // ai dati del profilo e non essere già usato da un altro account
    const verified = await verifyTaxCode(input.value)
    if (!verified.success) return { success: false, reason: verified.error ?? 'tax_code_invalid' }
    const { data: me } = await service().from('profiles').select('tax_code').eq('id', user.id).maybeSingle()
    if (!me?.tax_code) return { success: false, reason: 'tax_code_invalid' }
    idValue = me.tax_code as string
  }

  const { data, error } = await service()
    .rpc('grant_pro_trial', { p_user: user.id, p_type: input.type, p_value: idValue })
    .maybeSingle<{ status: string; trial_ends_at: string | null }>()
  if (error || !data) return { success: false, reason: 'error' }
  if (data.status !== 'ok') return { success: false, reason: data.status }

  // Partita IVA nei dati dell'attività (Preventivi, firma email…), se non c'è già
  if (input.type === 'vat') {
    const db = service()
    const { data: issuer } = await db.from('quote_issuer_profiles').select('vat_number, company_name').eq('user_id', user.id).maybeSingle()
    if (!issuer) await db.from('quote_issuer_profiles').insert({ user_id: user.id, vat_number: idValue.replace(/^IT/, ''), company_name: viesName })
    else if (!issuer.vat_number) await db.from('quote_issuer_profiles').update({ vat_number: idValue.replace(/^IT/, ''), company_name: issuer.company_name ?? viesName }).eq('user_id', user.id)
  }

  revalidatePath('/dashboard')
  revalidatePath('/pro')
  return { success: true, endsAt: data.trial_ends_at ?? undefined }
}
