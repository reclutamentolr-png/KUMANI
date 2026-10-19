'use server'

import { randomBytes } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { SHAREABLE_TOOL_NAMES } from '@/lib/shareableTools'

// Link corti per inviare il video di un servizio (kumani.io/v/CODICE), uno per
// Kumano e servizio. Vedi la migration share_links.
const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Senza caratteri che si confondono (0/O, 1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const newSlug = () => [...randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('')

// Il codice corto del Kumano collegato per questo servizio (creato la prima volta)
export async function getMyShareLink(tool: string): Promise<{ slug: string } | null> {
  if (!SHAREABLE_TOOL_NAMES.has(tool)) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const service = db()
  const { data: existing } = await service.from('share_links').select('slug').eq('user_id', user.id).eq('tool', tool).maybeSingle()
  if (existing) return { slug: existing.slug }
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newSlug()
    const { error } = await service.from('share_links').insert({ slug, user_id: user.id, tool })
    if (!error) return { slug }
    // Già creato in un'altra scheda nello stesso momento
    if (error.code === '23505') {
      const { data: again } = await service.from('share_links').select('slug').eq('user_id', user.id).eq('tool', tool).maybeSingle()
      if (again) return { slug: again.slug }
    } else {
      console.error('[share_links] creazione non riuscita:', error.message)
      return null
    }
  }
  return null
}

// Un'apertura del link (chiamata dal browser di chi lo apre)
export async function markShareLinkOpened(slug: string) {
  if (!/^[A-Za-z2-9]{6}$/.test(slug)) return
  const supabase = await createClient()
  await supabase.rpc('share_link_opened', { p_slug: slug })
}
