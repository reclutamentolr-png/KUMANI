'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// CALCOLATRICI PRO: tutto è calcolato nel browser e nulla viene salvato.
// Qui solo il punto KU giornaliero (una volta al giorno, controllato dal
// database) dopo il primo risultato calcolato o copiato.
export async function completeCalcolatrici() {
  await awardToolPoint('calcolatrici')
}
