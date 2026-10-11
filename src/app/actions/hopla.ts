'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// Hoplà: i file non passano dal server; qui arriva solo il «fatto», per il
// KU Karma del giorno (il database controlla piano e una volta al giorno).
export async function hoplaReceived(): Promise<void> {
  await awardToolPoint('hopla')
}
