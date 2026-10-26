import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/siteUrl'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation' // ✅ IMPORT AGGIUNTO PER RISOLVERE TS2304
import {
  Link2,
  Camera,
  AtSign,
  Play,
  Briefcase,
  Globe,
  Mail,
  Phone,
  MessageCircle,
  MapPin,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'

import ShareButton from '@/components/ShareButton'
import { getTranslations } from 'next-intl/server'
import { resolveBioTheme, brandBioVars } from '@/lib/linkInBioThemes'
import BioThemeScene from '@/components/BioThemeScene'
import LogoCircle from '@/components/LogoCircle'
import { normalizeLinkUrl } from '@/lib/linkUtils'
import PublicPageOffline from '@/components/PublicPageOffline'
import { profilePhotoUrl } from '@/lib/profilePhoto'

// Pagina pubblica di Link in Bio. Indirizzo con il nome scelto:
// /bio/<nome>. Indirizzi con il codice (di prima, sempre validi; con un nome
// portano a /bio/<nome>): /ref/<codice>/bio (pagina «privato») e
// /ref/<codice>/bio/azienda (pagina «azienda», solo Pro).

type ServiceDb = SupabaseClient
export type BioPageMode = 'personal' | 'business'

const serviceDb = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Riga della pagina richiesta. Senza pagina «privato» l'indirizzo /bio mostra
// la pagina «azienda» (chi l'aveva salvata così prima delle due pagine)
async function bioRow(service: ServiceDb, userId: string, mode: BioPageMode) {
  const cols = 'mode, bio_text, links, theme, brand_colors, subtitle, slug, show_photo'
  const { data } = await service.from('link_in_bio').select(cols).eq('user_id', userId).eq('mode', mode).maybeSingle()
  if (data || mode === 'business') return data
  return (await service.from('link_in_bio').select(cols).eq('user_id', userId).eq('mode', 'business').maybeSingle()).data
}

// Indirizzo da condividere: quello con il nome, se c'è
function bioPageUrl(code: string, mode: BioPageMode, slug: unknown) {
  return typeof slug === 'string' && slug ? `${SITE_URL}/bio/${slug}` : `${SITE_URL}/ref/${code}/bio${mode === 'business' ? '/azienda' : ''}`
}

// /bio/<nome>: di chi è e quale pagina (privato o azienda). Null = nessuno
export async function bioBySlug(slug: string): Promise<{ code: string; mode: BioPageMode } | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null
  const service = serviceDb()
  const { data: row } = await service.from('link_in_bio').select('user_id, mode').eq('slug', slug).maybeSingle()
  if (!row) return null
  const { data: profile } = await service.from('profiles').select('referral_code').eq('id', row.user_id).maybeSingle()
  if (!profile?.referral_code) return null
  return { code: profile.referral_code as string, mode: row.mode === 'business' ? 'business' : 'personal' }
}

// Indirizzo con il codice di una pagina che ha un nome: dove portarlo
// (/bio/<nome>), altrimenti null e si mostra lì
export async function bioSlugFor(code: string, mode: BioPageMode): Promise<string | null> {
  const service = serviceDb()
  const { data: profile } = await service.from('profiles').select('id').eq('referral_code', code).maybeSingle()
  if (!profile) return null
  const row = await bioRow(service, profile.id, mode)
  return typeof row?.slug === 'string' && row.slug ? row.slug : null
}

// Pagina «azienda» (solo con il Pro): nome, logo e città della Scheda
// attività. Null = si mostra la persona.
async function bioBusiness(service: ServiceDb, userId: string, rowMode: string | null | undefined): Promise<{ name: string; city: string; logoUrl: string | null } | null> {
  if (rowMode !== 'business') return null
  const [{ data: plan }, { data: card }] = await Promise.all([
    service.rpc('plan_of', { p_user_id: userId }),
    service.from('quote_issuer_profiles').select('company_name, city, logo_path').eq('user_id', userId).maybeSingle(),
  ])
  const name = String(card?.company_name ?? '').trim()
  if (plan !== 'pro' || !name) return null
  const logoUrl = card?.logo_path ? service.storage.from('quote-logos-v2').getPublicUrl(card.logo_path as string).data.publicUrl : null
  return { name, city: String(card?.city ?? '').trim(), logoUrl }
}

// Titolo e anteprima propri (WhatsApp, social, scheda del browser): nome,
// professione e presentazione di chi ha la pagina
export async function bioMetadata(locale: string, code: string, mode: BioPageMode): Promise<Metadata> {
  const service = serviceDb()
  const { data: profile } = await service.from('profiles').select('id, first_name, last_name, occupation').eq('referral_code', code).maybeSingle()
  if (!profile) return { title: { absolute: 'KUMANI' } }
  const bio = await bioRow(service, profile.id, mode)
  const business = await bioBusiness(service, profile.id, bio?.mode)
  const t = await getTranslations({ locale, namespace: 'bioPublic' })
  const name = business?.name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'KUMANI'
  // Riga sotto il nome scritta nella bio, altrimenti città (azienda) o professione
  const subtitle = typeof bio?.subtitle === 'string' ? bio.subtitle : business ? business.city : profile.occupation
  const description = (bio?.bio_text || subtitle || t('fallbackBio')).slice(0, 200)
  const title = subtitle ? `${name} · ${subtitle}` : name
  return {
    title: { absolute: `${title} · KUMANI` },
    description,
    alternates: { canonical: bioPageUrl(code, mode, bio?.slug) },
    openGraph: { title, description, type: 'profile', siteName: 'KUMANI', url: bioPageUrl(code, mode, bio?.slug) },
    twitter: { card: 'summary', title, description },
  }
}

export async function BioPublic({ code, mode }: { code: string; mode: BioPageMode }) {
  // 1. Trova il profilo. I visitatori anonimi non leggono più la tabella
  // profiles: la pagina bio (pubblica per scelta del titolare) la legge lato
  // server con service role, solo le colonne che mostra.
  const service = serviceDb()
  const { data: profile, error } = await service
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      referral_code,
      email,
      phone,
      country_code,
      occupation,
      avatar_path
    `)
    .eq('referral_code', code)
    .single()

  // ✅ Se c'è errore o il profilo non esiste, reindirizza alla pagina 404
  if (error || !profile) {
    notFound()
  }

  // Piano scaduto o Link in bio spento dallo Staff: pagina offline (i dati
  // restano salvati e tornano visibili al rinnovo).
  const { data: status } = await service.rpc('public_page_status', { p_kind: 'bio', p_code: code })
  if (status === 'offline') return <PublicPageOffline kind="profile" />

  // 2. Trova la bio e i link personalizzati (se esistono).
  // La RLS di link_in_bio consente la lettura solo al proprietario: la pagina
  // è pubblica, quindi leggiamo con service role, solo le colonne mostrate e
  // solo la riga di questo profilo.
  const linkInBio = await bioRow(service, profile.id, mode)
  // Pagina «azienda»: solo se c'è e solo con il Pro
  const business = await bioBusiness(service, profile.id, linkInBio?.mode)
  if (mode === 'business' && !linkInBio) notFound()
  if (mode === 'business' && !business) return <PublicPageOffline kind="profile" />

  // Solo i link che il Kumano ha effettivamente inserito nell'editor — niente
  // link "Unisciti al mio team" iniettato automaticamente: la pagina deve
  // riflettere esattamente ciò che è stato scritto, non aggiungere contenuti
  // extra il visitatore non ha chiesto di vedere.
  // Tollerante: links può arrivare come stringa JSON o già come array (jsonb)
  type BioLink = { id: string; title: string; url: string; icon: string; enabled: boolean }
  let links: BioLink[] = []
  try {
    const raw: unknown = typeof linkInBio?.links === 'string' ? JSON.parse(linkInBio.links) : linkInBio?.links
    links = Array.isArray(raw) ? (raw as BioLink[]) : []
  } catch {
    links = []
  }

  // Pagina «privato»: foto del profilo, se il titolare l'ha scelta
  const photoUrl = !business && linkInBio?.mode !== 'business' && linkInBio?.show_photo === true ? profilePhotoUrl(profile.avatar_path) : null

  // Come azienda (Pro): nome, logo e città della Scheda attività
  const shownName = business ? business.name : [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  // Riga sotto il nome scritta nella bio (vuota = nessuna), altrimenti città
  // (azienda) o professione del profilo
  const subtitle = typeof linkInBio?.subtitle === 'string' ? linkInBio.subtitle : business ? business.city : profile.occupation

  // Si condivide questa pagina (la bio), non quella di iscrizione
  const profileUrl = bioPageUrl(code, mode, linkInBio?.slug)
  const t = await getTranslations('bioPublic')
  // Tema «brand»: i colori della Scheda attività (se mancano, il tema di partenza)
  const brandVars = linkInBio?.theme === 'brand' ? brandBioVars(linkInBio?.brand_colors) : undefined
  const theme = resolveBioTheme(linkInBio?.theme === 'brand' && !brandVars ? null : linkInBio?.theme)

  // Mappa sicura delle icone (usando solo icone garantite in lucide-react)
  const getIcon = (iconName: string) => {
    const icons: Record<string, LucideIcon> = {
      instagram: Camera,
      facebook: Globe,
      twitter: AtSign,
      youtube: Play,
      linkedin: Briefcase,
      website: Globe,
      email: Mail,
      phone: Phone,
      whatsapp: MessageCircle,
      location: MapPin,
      referral: Link2,
      default: ExternalLink
    }
    return icons[iconName?.toLowerCase()] || icons.default
  }

  return (
    <div className={`relative min-h-screen ${theme.pageBg} py-12 px-4`} style={brandVars as React.CSSProperties | undefined}>
      {theme.scene && <BioThemeScene scene={theme.scene} className="pointer-events-none fixed inset-0 h-full w-full" />}
      <div className="relative max-w-md mx-auto">
        {/* Card Principale */}
        <div className={`${theme.cardBg} rounded-3xl p-8 shadow-2xl`}>

          {/* Avatar */}
          <div className="flex flex-col items-center text-center mb-8">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={shownName} className="mb-4 h-28 w-28 rounded-full object-cover shadow-xl" />
            ) : business?.logoUrl ? (
              <LogoCircle src={business.logoUrl} alt={business.name} className="mb-4 h-28 w-28 shadow-xl" />
            ) : (
              <div className={`w-28 h-28 rounded-full ${theme.avatarBg} ${theme.avatarText} flex items-center justify-center text-5xl font-bold shadow-xl mb-4`}>
                {(shownName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className={`text-3xl font-bold mb-2 ${theme.nameText}`}>{shownName}</h1>
            {subtitle && (
              <p className={`text-sm mb-2 ${theme.secondaryText}`}>{subtitle}</p>
            )}
            {linkInBio?.bio_text ? (
              <p className={`text-sm leading-relaxed ${theme.secondaryText}`}>{linkInBio.bio_text}</p>
            ) : (
              !subtitle && !business && <p className={`text-sm ${theme.secondaryText}`}>{t('fallbackBio')}</p>
            )}
          </div>

          {/* Link */}
          <div className="space-y-3 mb-8">
            {links.filter((l) => l.enabled !== false).map((link, index) => {
              const Icon = getIcon(link.icon)
              return (
                <a
                  key={link.id || index}
                  href={normalizeLinkUrl(link.icon, link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex items-center gap-3 backdrop-blur rounded-xl p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg ${theme.linkBg}`}
                >
                  <div className={`w-10 h-10 rounded-full ${theme.linkIconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${theme.linkIconText}`} />
                  </div>
                  <span className={`flex-1 font-semibold text-center ${theme.linkText}`}>
                    {link.title}
                  </span>
                  <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              )
            })}
          </div>

          {/* PULSANTE CONDIVIDI */}
          <div className="flex justify-center mb-4">
            <ShareButton url={profileUrl} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className={`text-xs ${theme.footerText}`}>
            {t('poweredBy')} <span className="font-semibold">KUMANI</span>
          </p>
        </div>
      </div>
    </div>
  )
}