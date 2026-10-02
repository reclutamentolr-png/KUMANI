'use server'

import { verifyAdmin } from '@/lib/verifyAdmin'
import { platformReports, type PlatformReport } from '@/lib/platforms'

// Admin → Piattaforme collegate: stato e consumi dei servizi esterni.
export async function adminPlatformReports(): Promise<{ success: boolean; reports?: PlatformReport[]; checkedAt?: string; error?: string }> {
  const admin = await verifyAdmin('stats.read')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  try {
    return { success: true, reports: await platformReports(), checkedAt: new Date().toISOString() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
