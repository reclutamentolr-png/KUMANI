'use server'

import { createClient } from '@/lib/supabase/server'
import { bioPlanIsPro, type BioMode } from '@/lib/bioPlan'
import { awardToolPoint } from '@/lib/toolPoints'
import { normalizeLinkUrl } from '@/lib/linkUtils'
import { BIO_THEMES, PREMIUM_BIO_THEME_KEYS, type BioThemeKey } from '@/lib/linkInBioThemes'
import { KU_UNLOCK_LINKINBIO_THEMES, linkInBioThemeUnlockKey } from '@/lib/ku'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { slugify, slugProblem } from '@/lib/landing'
import { nameUsedByOthers } from '@/lib/publicNames'

type LinkItem = {
  id: string
  title: string
  url: string
  icon: string
  enabled: boolean
}

// slug: nome dell'indirizzo kumani.io/bio/<nome>; vuoto = nessun nome (resta
// il link con il codice), undefined = non si cambia
export async function saveLinkInBio(bioText: string, links: LinkItem[], theme: BioThemeKey, mode: BioMode = 'personal', subtitle: string | null = null, slug?: string | null) {
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

  const cleanSlug = slug === undefined ? undefined : String(slug ?? '').trim().toLowerCase() || null
  if (cleanSlug) {
    const problem = slugProblem(cleanSlug)
    if (problem) return { success: false as const, message: problem }
    if (await nameUsedByOthers(cleanSlug, user.id)) return { success: false as const, message: 'slugTaken' }
  }

  const { error } = await supabase.from('link_in_bio').upsert(
    {
      user_id: user.id,
      mode: cleanMode,
      // Riga sotto il nome: vuota = nessuna riga, null = professione o città
      subtitle: subtitle === null ? null : String(subtitle).trim().slice(0, 120),
      bio_text: String(bioText ?? '').slice(0, 500),
      links: JSON.stringify(cleanLinks),
      theme,
      ...(cleanSlug === undefined ? {} : { slug: cleanSlug }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,mode' }
  )

  // Nome già usato (anche dall'altra pagina, privato o azienda)
  if (error?.code === '23505') return { success: false as const, message: 'slugTaken' }
  if (error) return refuse('saveError', `${error.code} ${error.message}`)

  await awardToolPoint('link-in-bio')
  return { success: true }
}

// Nome libero? (controllo mentre si scrive; quello vero è al salvataggio)
export async function checkBioSlug(slugInput: string, mode: BioMode): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'auth' }
  const slug = String(slugInput ?? '').trim().toLowerCase()
  const problem = slugProblem(slug)
  if (problem) return { ok: false, message: problem }
  if (await nameUsedByOthers(slug, user.id)) return { ok: false, message: 'slugTaken' }
  // Lo stesso nome non può servire alla pagina privata e a quella azienda
  const { data: other } = await supabase.from('link_in_bio').select('mode').eq('user_id', user.id).eq('slug', slug).neq('mode', mode).maybeSingle()
  if (other) return { ok: false, message: 'slugOtherPage' }
  return { ok: true }
}

// Nome proposto per una pagina ancora senza nome: per l'azienda quello della
// Landing Page, poi il nome dell'attività; per il privato nome e cognome. Solo nomi
// validi e liberi; se il nome è preso si prova con un numero (mario-rossi-2).
export async function suggestBioSlug(mode: BioMode): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const [{ data: landing }, { data: card }, { data: me }, { data: mine }] = await Promise.all([
    supabase.from('landing_pages').select('slug').eq('owner_id', user.id).maybeSingle(),
    supabase.from('quote_issuer_profiles').select('company_name').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('first_name, last_name').eq('id', user.id).maybeSingle(),
    supabase.from('link_in_bio').select('mode, slug').eq('user_id', user.id),
  ])
  const taken = new Set((mine ?? []).filter((r) => r.mode !== mode && r.slug).map((r) => r.slug as string))
  const personName = slugify([me?.first_name, me?.last_name].filter(Boolean).join(' '))
  const companyName = slugify(String(card?.company_name ?? ''))
  const bases = (mode === 'business' ? [landing?.slug as string | undefined, companyName] : [personName]).filter((b): b is string => !!b)
  const usable = async (name: string) => !slugProblem(name) && !taken.has(name) && !(await nameUsedByOthers(name, user.id))
  for (const base of bases) if (await usable(base)) return base
  const named = mode === 'business' ? companyName : personName
  if (named) for (let n = 2; n <= 9; n++) if (await usable(`${named.slice(0, 37)}-${n}`)) return `${named.slice(0, 37)}-${n}`
  return null
}
