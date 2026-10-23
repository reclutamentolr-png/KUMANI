'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// KUMANI FORMA: il video si taglia e si adatta nel browser e non passa dal
// server; qui solo il KU Karma del giorno (piano e una volta al giorno li
// controlla il database).
export async function formaDone(): Promise<void> {
  await awardToolPoint('forma')
}
