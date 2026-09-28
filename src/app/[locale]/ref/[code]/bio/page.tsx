import { SITE_URL } from '@/lib/siteUrl'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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
  ExternalLink
} from 'lucide-react'

import ShareButton from '@/components/ShareButton'
import { resolveBioTheme } from '@/lib/linkInBioThemes'
import { normalizeLinkUrl } from '@/lib/linkUtils'
import PublicPageOffline from '@/components/PublicPageOffline'

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
    .select('bio_text, links, theme')
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

  const baseUrl = SITE_URL
  const profileUrl = `${baseUrl}/ref/${code}`
  const theme = resolveBioTheme(linkInBio?.theme)

  // Mappa sicura delle icone (usando solo icone garantite in lucide-react)
  const getIcon = (iconName: string) => {
    const icons: Record<string, any> = {
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
    <div className={`min-h-screen ${theme.pageBg} py-12 px-4`}>
      <div className="max-w-md mx-auto">
        {/* Card Principale */}
        <div className={`${theme.cardBg} rounded-3xl p-8 shadow-2xl`}>

          {/* Avatar */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className={`w-28 h-28 rounded-full ${theme.avatarBg} ${theme.avatarText} flex items-center justify-center text-5xl font-bold shadow-xl mb-4`}>
              {(profile.first_name || 'U').charAt(0).toUpperCase()}
            </div>
            <h1 className={`text-3xl font-bold mb-2 ${theme.nameText}`}>
              {profile.first_name} {profile.last_name}
            </h1>
            {profile.occupation && (
              <p className={`text-sm mb-2 ${theme.secondaryText}`}>{profile.occupation}</p>
            )}
            {linkInBio?.bio_text ? (
              <p className={`text-sm leading-relaxed ${theme.secondaryText}`}>{linkInBio.bio_text}</p>
            ) : (
              <p className={`text-sm ${theme.secondaryText}`}>Professionista Kumani</p>
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
            Powered by <span className="font-semibold">Kumani</span>
          </p>
        </div>
      </div>
    </div>
  )
}