'use server'

import { createClient } from '@/lib/supabase/server'
import { bioPlanIsPro, type BioMode } from '@/lib/bioPlan'
import { awardToolPoint } from '@/lib/toolPoints'
import { normalizeLinkUrl } from '@/lib/linkUtils'
import { BIO_THEMES, PREMIUM_BIO_THEME_KEYS, type BioThemeKey } from '@/lib/linkInBioThemes'
import { KU_UNLOCK_LINKINBIO_THEMES, linkInBioThemeUnlockKey } from '@/lib/ku'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'

type LinkItem = {
  id: string
  title: string
  url: string
  icon: string
  enabled: boolean
}

export async function saveLinkInBio(bioText: string, links: LinkItem[], theme: BioThemeKey, mode: BioMode = 'personal', subtitle: string | null = null) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'auth' }
  // Ogni rifiuto finisce nei registri con il motivo (prima non si vedeva)
  const refuse = (message: string, detail?: string) => {
    console.error('[LinkInBio] salvataggio rifiutato:', message, user.id, detail ?? '')
    return { success: false as const, message }
  }

  // Gating del piano: stessa regola degli altri strumenti (can_use_tool)
  if (!(await hasActiveToolAccess(supabase, user.id, 'link-in-bio'))) {
    return refuse('subscriptionRequired')
  }

  // Solo temi esistenti
  if (!Object.prototype.hasOwnProperty.call(BIO_THEMES, theme)) return refuse('theme', String(theme))

  if (PREMIUM_BIO_THEME_KEYS.includes(theme)) {
    const { data: unlock } = await supabase
      .from('ku_unlock_purchases')
      .select('unlock_key')
      .eq('user_id', user.id)
      .in('unlock_key', [linkInBioThemeUnlockKey(theme), KU_UNLOCK_LINKINBIO_THEMES])
      .limit(1)
      .maybeSingle()
    if (!unlock) return { ...refuse('locked', theme), locked: true }
  }

  // Al massimo 30 link, testi accorciati, solo i campi previsti (anche il
  // database ha un limite sulla grandezza)
  const cleanLinks = (Array.isArray(links) ? links : [])
    .map((l) => ({
      id: String(l?.id ?? '').slice(0, 40) || crypto.randomUUID(),
      title: String(l?.title ?? '').trim().slice(0, 80),
      url: String(l?.url ?? '').trim().slice(0, 500),
      icon: /^[a-z0-9_-]{1,30}$/i.test(String(l?.icon ?? '')) ? String(l.icon) : 'default',
      enabled: l?.enabled !== false,
    }))
    .filter((l) => l.title && l.url)
    .slice(0, 30)
    .map((l) => ({ ...l, url: normalizeLinkUrl(l.icon, l.url) }))

  // Pagina «azienda» solo con il Pro (la Scheda attività è del Pro)
  const cleanMode: BioMode = mode === 'business' ? 'business' : 'personal'
  if (cleanMode === 'business' && !(await bioPlanIsPro(user.id))) return refuse('businessPro')

  const { error } = await supabase.from('link_in_bio').upsert(
    {
      user_id: user.id,
      mode: cleanMode,
      // Riga sotto il nome: vuota = nessuna riga, null = professione o città
      subtitle: subtitle === null ? null : String(subtitle).trim().slice(0, 120),
      bio_text: String(bioText ?? '').slice(0, 500),
      links: JSON.stringify(cleanLinks),
      theme,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,mode' }
  )

  if (error) return refuse('saveError', `${error.code} ${error.message}`)

  await awardToolPoint('link-in-bio')
  return { success: true }
}
