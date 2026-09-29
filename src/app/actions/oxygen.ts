'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// OXYGEN: a fine sessione il punto KU giornaliero (una volta al giorno,
// controllato dal database). Nessun altro dato viene salvato.
export async function completeOxygenSession() {
  await awardToolPoint('oxygen')
}
