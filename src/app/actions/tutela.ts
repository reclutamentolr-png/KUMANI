'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// KUMANI TUTELA: le spunte restano sul dispositivo; qui solo il KU Karma del
// giorno (una volta al giorno, controllato dal database).
export async function tutelaDone(): Promise<void> {
  await awardToolPoint('tutela')
}
