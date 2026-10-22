'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// KUMANI VOX: il video e la voce restano nel telefono (trascrizione nel
// browser); qui arriva solo il «fatto», per il KU Karma del giorno (il
// database controlla piano e una volta al giorno).
export async function voxDone(): Promise<void> {
  await awardToolPoint('vox')
}
