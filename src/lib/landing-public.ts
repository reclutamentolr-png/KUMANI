import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cleanLandingContent, isLandingLocale, isLandingTemplate, SLUG_RE, type PublicLanding } from '@/lib/landing'

// Lettura della Landing Page pubblica (una sola volta per richiesta)
export const loadPublicLanding = cache(async (slugInput: string): Promise<PublicLanding | null> => {
  const slug = String(slugInput ?? '').toLowerCase()
  if (!SLUG_RE.test(slug)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_public_landing', { p_slug: slug })
  if (!data) return null
  const row = data as Record<string, unknown>
  return {
    slug,
    template: isLandingTemplate(row.template) ? row.template : 'scuro',
    accent: typeof row.accent === 'string' ? row.accent : '#c79a3b',
    content_locale: isLandingLocale(row.content_locale) ? row.content_locale : 'it',
    content: cleanLandingContent(row.content),
    updated_at: String(row.updated_at ?? ''),
    referral_code: typeof row.referral_code === 'string' ? row.referral_code : null,
    menu_token: typeof row.menu_token === 'string' ? row.menu_token : null,
  }
})
