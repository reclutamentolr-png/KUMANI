'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { localizedPath, notifyUser } from '@/lib/push'
import { locales } from '../../../i18n'

// Admin → Servizi: tester di un servizio «Solo Staff». Oltre allo Staff, gli
// iscritti scelti qui lo aprono e lo usano in anteprima (tool_access nel
// database). Quando lo si accende per tutti, l'elenco non serve più ma resta.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const TOOL_RE = /^[a-z0-9-]{2,40}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ToolTester = { id: string; name: string; email: string | null; addedAt: string }

export async function adminListToolTesters(toolName: string): Promise<ToolTester[]> {
  if (!(await verifyAdmin('marketplace.write')) || !TOOL_RE.test(toolName)) return []
  const { data: rows } = await db().from('tool_testers').select('user_id, added_at').eq('tool_name', toolName).order('added_at')
  const ids = (rows ?? []).map((r) => r.user_id as string)
  if (!ids.length) return []
  const { data: people } = await db().from('profiles').select('id, first_name, last_name, email').in('id', ids)
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]))
  return (rows ?? []).map((r) => {
    const p = byId.get(r.user_id as string)
    return {
      id: r.user_id as string,
      name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '—',
      email: (p?.email as string | null) ?? null,
      addedAt: r.added_at as string,
    }
  })
}

// Aggiunge un tester e gli manda un avviso con il link al servizio
export async function adminAddToolTester(toolName: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await verifyAdmin('marketplace.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!TOOL_RE.test(toolName) || !UUID_RE.test(userId)) return { success: false, error: 'Dati non validi' }
  const { error } = await db().from('tool_testers').upsert({ tool_name: toolName, user_id: userId, added_by: admin.id }, { onConflict: 'tool_name,user_id', ignoreDuplicates: true })
  if (error) return { success: false, error: error.message }

  // Nome e indirizzo del servizio nelle lingue dell'avviso
  const titles: Record<string, { title: string; href: string }> = {}
  for (const locale of locales) {
    const tm = await getTranslations({ locale, namespace: 'marketplace' })
    const tool = getMarketplaceTools(tm).find((x) => x.toolName === toolName)
    titles[locale] = { title: tool?.title ?? toolName, href: tool?.href ?? '/app' }
  }
  await notifyUser(
    userId,
    'staff',
    (t, locale) => ({
      title: t('testerTitle'),
      body: t('testerBody', { tool: titles[locale]?.title ?? toolName }),
      url: localizedPath(locale, titles[locale]?.href ?? '/app'),
      tag: `tester-${toolName}`,
    }),
    { kind: 'tool_tester', ref: toolName }
  )
  return { success: true }
}

export async function adminRemoveToolTester(toolName: string, userId: string): Promise<boolean> {
  if (!(await verifyAdmin('marketplace.write')) || !TOOL_RE.test(toolName) || !UUID_RE.test(userId)) return false
  const { error } = await db().from('tool_testers').delete().eq('tool_name', toolName).eq('user_id', userId)
  return !error
}
