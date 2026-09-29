'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// Firma Email: dopo la prima copia o il primo download il punto KU
// giornaliero (una volta al giorno, controllato dal database). La firma
// resta nel browser: nessun altro dato viene salvato.
export async function completeFirmaEmail() {
  await awardToolPoint('firma-email')
}
