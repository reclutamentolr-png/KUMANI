'use server'

import { createClient } from '@/lib/supabase/server'
import { awardToolPoint } from '@/lib/toolPoints'
import { normalizeLinkUrl } from '@/lib/linkUtils'
import { PREMIUM_BIO_THEME_KEYS, type BioThemeKey } from '@/lib/linkInBioThemes'
import { KU_UNLOCK_LINKINBIO_THEMES, linkInBioThemeUnlockKey } from '@/lib/ku'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'

type LinkItem = {
  id: string
  title: string
  url: string
  icon: string
  enabled: boolean
}

export async function saveLinkInBio(bioText: string, links: LinkItem[], theme: BioThemeKey) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }

  // Gating del piano: stessa regola degli altri strumenti (can_use_tool)
  if (!(await hasActiveToolAccess(supabase, user.id, 'link-in-bio'))) {
    return { success: false, message: 'subscriptionRequired' }
  }

  if (PREMIUM_BIO_THEME_KEYS.includes(theme)) {
    const { data: unlock } = await supabase
      .from('ku_unlock_purchases')
      .select('unlock_key')
      .eq('user_id', user.id)
      .in('unlock_key', [linkInBioThemeUnlockKey(theme), KU_UNLOCK_LINKINBIO_THEMES])
      .limit(1)
      .maybeSingle()
    if (!unlock) return { success: false, locked: true }
  }

  const cleanLinks = links
    .filter((l) => l.title && l.url)
    .map((l) => ({ ...l, url: normalizeLinkUrl(l.icon, l.url) }))

  const { error } = await supabase.from('link_in_bio').upsert(
    {
      user_id: user.id,
      bio_text: bioText,
      links: JSON.stringify(cleanLinks),
      theme,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) return { success: false }

  await awardToolPoint('link-in-bio')
  return { success: true }
}
