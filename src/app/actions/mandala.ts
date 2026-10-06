'use server'

import { awardToolPoint } from '@/lib/toolPoints'

// MANDALA: salvare o condividere un disegno dà il KU Karma del giorno (una
// volta al giorno, controllato dal database) e vale come passo del
// «benessere di oggi». Il disegno resta nel browser.
export async function completeMandala() {
  await awardToolPoint('mandala')
}
