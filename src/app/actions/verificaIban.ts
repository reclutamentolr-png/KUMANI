'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// VERIFICA IBAN: il controllo avviene tutto nel browser. Dopo il primo IBAN
// valido si assegna il punto KU giornaliero (una volta al giorno, controllato
// dal database). Nessun IBAN viene inviato o salvato.
export async function completeVerificaIban() {
  await awardToolPoint('verifica-iban')
}
