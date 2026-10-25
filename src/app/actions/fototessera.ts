'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// Fototessera: la foto non passa dal server; qui arriva solo il «fatto»,
// per il KU Karma del giorno (il database controlla piano e una volta al giorno).
export async function fototesseraDone(): Promise<void> {
  await awardToolPoint('fototessera')
}
