'use server'

import { createClient } from '@/lib/supabase/server'
import { SHAREABLE_TOOL_NAMES } from '@/lib/shareableTools'
import { ensureShareSlug } from '@/lib/shareLinksServer'

// Link corti per inviare il video di un servizio (kumani.io/v/CODICE), uno per
// Kumano e servizio. Vedi la migration share_links e lib/shareLinksServer.

// Il codice corto del Kumano collegato per questo servizio (creato la prima volta)
export async function getMyShareLink(tool: string): Promise<{ slug: string } | null> {
  if (!SHAREABLE_TOOL_NAMES.has(tool)) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const slug = await ensureShareSlug(user.id, tool)
  return slug ? { slug } : null
}

// Un'apertura del link (chiamata dal browser di chi lo apre)
export async function markShareLinkOpened(slug: string) {
  if (!/^[A-Za-z2-9]{6}$/.test(slug)) return
  const supabase = await createClient()
  await supabase.rpc('share_link_opened', { p_slug: slug })
}
