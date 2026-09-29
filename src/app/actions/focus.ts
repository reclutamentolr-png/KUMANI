'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// KUMANI Focus: alla prima sessione di concentrazione completata il punto KU
// giornaliero (una volta al giorno, controllato dal database). Le statistiche
// restano nel browser: nessun altro dato viene salvato.
export async function completeFocusSession() {
  await awardToolPoint('focus')
}
