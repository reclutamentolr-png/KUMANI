import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowRight, Star } from 'lucide-react'
import { isEmptySpotlightProfile, type SpotlightProfile } from '@/lib/spotlight'

// Teaser "Kumano del Giorno" sul dashboard: la categoria Community non ha
// una propria accordion tra gli strumenti (vedi DashboardTipo2 — è
// esclusa da toolsByCategory perché già rappresentata inline da
// CommunityPreview), quindi questo nuovo tool ha bisogno del proprio
// piccolo blocco accanto ad essa, altrimenti resta visibile solo dalla
// pagina categoria del marketplace.
export default async function KumanoDelGiornoPreview() {
  const t = await getTranslations('spotlight')
  const supabase = await createClient()
  const { data: todaysKumanoRaw } = await supabase.rpc('get_todays_kumano')
  const todaysKumano = todaysKumanoRaw as unknown as SpotlightProfile | null
  const hasTodaysKumano = !isEmptySpotlightProfile(todaysKumano)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-6 h-6 text-[var(--gold)]" fill="currentColor" />
          {t('title')}
        </h2>
        <Link href="/spotlight" className="text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)] flex items-center gap-1">
          {t('viewPublicPage')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {hasTodaysKumano && todaysKumano ? (
        <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4">
          <p className="font-bold text-gray-900">{todaysKumano.display_name}</p>
          <p className="mb-2 text-xs text-gray-500">
            {[todaysKumano.profession, [todaysKumano.city, todaysKumano.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
          </p>
          <p className="text-sm text-gray-700 line-clamp-2">{todaysKumano.story}</p>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-dashed border-yellow-300 rounded-xl p-6 text-center">
          <Star className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">{t('noKumanoToday')}</p>
        </div>
      )}

      <Link
        href="/app/spotlight"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
      >
        {t('ctaJoinButton')}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
