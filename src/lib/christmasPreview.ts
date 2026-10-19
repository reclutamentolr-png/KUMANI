import { cookies } from 'next/headers'
import { getChristmas } from '@/lib/christmas'

// Anteprima delle decorazioni di Natale solo per lo Staff (Admin → Natale →
// «Anteprima solo per me»): un cookie che vale solo per gli admin, così si
// vede il risultato prima di dicembre senza accenderlo a tutti.
export const CHRISTMAS_PREVIEW_COOKIE = 'kumani_xmas_preview'

export async function christmasDecorationsFor(isAdmin: boolean): Promise<boolean> {
  if ((await getChristmas()).decorations) return true
  if (!isAdmin) return false
  return (await cookies()).get(CHRISTMAS_PREVIEW_COOKIE)?.value === '1'
}
