'use server'

import { createClient } from '@/lib/supabase/server'
import { parseVatInput, registryLookupUrl, verifyVies } from '@/lib/vat'

export type VatCheckResult = {
  status: 'valid' | 'not_found' | 'invalid_format' | 'unavailable'
  name?: string
  normalized?: string
  registryUrl?: string
}

// Verifica di una partita IVA dentro i moduli (Preventivi, Scheda attività):
// formato + registro europeo VIES. Solo utenti registrati, per evitare abusi.
export async function checkVatNumber(raw: string): Promise<VatCheckResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'unavailable' }

  const parsed = parseVatInput(String(raw ?? '').slice(0, 40))
  if (!parsed || !parsed.ok) return { status: 'invalid_format' }

  const normalized = parsed.normalized
  const registryUrl = registryLookupUrl(normalized) ?? undefined
  // Fuori UE il VIES non risponde: resta solo il formato corretto
  if (!parsed.eu) return { status: 'unavailable', normalized }

  const vies = await verifyVies(normalized)
  if (vies.status === 'valid') {
    const name = (vies.name ?? '').trim()
    return { status: 'valid', normalized, name: name && name !== '---' ? name : undefined }
  }
  if (vies.status === 'invalid') return { status: 'not_found', normalized, registryUrl }
  return { status: 'unavailable', normalized, registryUrl }
}
