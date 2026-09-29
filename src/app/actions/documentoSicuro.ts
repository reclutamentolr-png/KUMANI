'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// DOCUMENTO SICURO: dopo il primo download o condivisione, il punto KU
// giornaliero (una volta al giorno, controllato dal database). La foto non
// arriva mai al server: qui non si salva nient'altro.
export async function completeDocumentoSicuro() {
  await awardToolPoint('documento-sicuro')
}
