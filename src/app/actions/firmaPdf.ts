'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// Firma PDF: il documento non passa dal server; qui arriva solo il «fatto»,
// per il KU Karma del giorno (il database controlla piano e una volta al giorno).
export async function firmaPdfDone(): Promise<void> {
  await awardToolPoint('firma-pdf')
}
