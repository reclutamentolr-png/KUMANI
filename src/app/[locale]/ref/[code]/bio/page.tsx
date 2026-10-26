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
import { normalizeLinkUrl } from '@/lib/linkUtils'
import PublicPageOffline from '@/components/PublicPageOffline'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

type ServiceDb = SupabaseClient

// Pagina «come azienda» (solo con il Pro): nome, logo e città della Scheda
// attività. Null = si mostra la persona.
async function bioBusiness(service: ServiceDb, userId: string): Promise<{ name: string; city: string; logoUrl: string | null } | null> {
  const { data: bio } = await service.from('link_in_bio').select('mode').eq('user_id', userId).maybeSingle()
  if (bio?.mode !== 'business') return null
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
export async function generateMetadata({ params }: { params: Promise<{ locale: string; code: string }> }): Promise<Metadata> {
  const { locale, code } = await params
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: profile } = await service.from('profiles').select('id, first_name, last_name, occupation').eq('referral_code', code).maybeSingle()
  if (!profile) return { title: { absolute: 'KUMANI' } }
  const [{ data: bio }, business] = await Promise.all([service.from('link_in_bio').select('bio_text, subtitle').eq('user_id', profile.id).maybeSingle(), bioBusiness(service, profile.id)])
  const t = await getTranslations({ locale, namespace: 'bioPublic' })
  const name = business?.name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'KUMANI'
  // Riga sotto il nome scritta nella bio, altrimenti città (azienda) o professione
  const subtitle = typeof bio?.subtitle === 'string' ? bio.subtitle : business ? business.city : profile.occupation
  const description = (bio?.bio_text || subtitle || t('fallbackBio')).slice(0, 200)
  const title = subtitle ? `${name} · ${subtitle}` : name
  return {
    title: { absolute: `${title} · KUMANI` },
    description,
    openGraph: { title, description, type: 'profile', siteName: 'KUMANI', url: `${SITE_URL}/ref/${code}/bio` },
    twitter: { card: 'summary', title, description },
  }
}

export default async function LinkInBioPublicPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params
  const code = resolvedParams.code
  
  // 1. Trova il profilo. I visitatori anonimi non leggono più la tabella
  // profiles: la pagina bio (pubblica per scelta del titolare) la legge lato
  // server con service role, solo le colonne che mostra.
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
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
      occupation
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
  const { data: linkInBio } = await service
    .from('link_in_bio')
    .select('bio_text, links, theme, brand_colors, subtitle')
    .eq('user_id', profile.id)
    .maybeSingle()

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

  // Come azienda (Pro): nome, logo e città della Scheda attività
  const business = await bioBusiness(service, profile.id)
  const shownName = business ? business.name : [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  // Riga sotto il nome scritta nella bio (vuota = nessuna), altrimenti città
  // (azienda) o professione del profilo
  const subtitle = typeof linkInBio?.subtitle === 'string' ? linkInBio.subtitle : business ? business.city : profile.occupation

  const baseUrl = SITE_URL
  // Si condivide questa pagina (la bio), non quella di iscrizione
  const profileUrl = `${baseUrl}/ref/${code}/bio`
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
            {business?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo della Scheda attività (storage pubblico)
              <img src={business.logoUrl} alt={business.name} className={`mb-4 h-28 w-28 rounded-full object-cover shadow-xl ${theme.avatarBg}`} />
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