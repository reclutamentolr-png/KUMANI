'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// Scanner e PDF: i documenti non passano dal server; qui arriva solo il «fatto»,
// per il KU Karma del giorno (il database controlla piano e una volta al giorno).
export async function scannerDone(): Promise<void> {
  await awardToolPoint('scanner')
}
