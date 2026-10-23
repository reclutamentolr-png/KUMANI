'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// KUMANI IMAGO: le grafiche si disegnano nel browser e non passano dal
// server; qui solo il KU Karma del giorno (piano e una volta al giorno li
// controlla il database).
export async function imagoDone(): Promise<void> {
  await awardToolPoint('imago')
}
