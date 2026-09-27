import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import ToolBackLink from '@/components/ToolBackLink'
import QRGeneratorTool from '@/components/QRGeneratorTool'
import { 
  QrCode, 
  ArrowLeft, 
  Share2, 
  Download, 
  Sparkles,
  Smartphone
} from 'lucide-react'

// ✅ Aggiunto params per ottenere la lingua corrente
export default async function QRGeneratorPage({ params }: { params: Promise<{ locale: string }> }) {
  // ✅ Ottieni la lingua dall'URL (es. 'it', 'en', 'fr')
  const { locale } = await params
  const t = await getTranslations('qrGenerator')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('referral_code, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  const baseUrl = SITE_URL
  
  // ✅ URL CORRETTO: include la lingua dinamica (es. /it/ref/CODICE)
  const referralUrl = `${baseUrl}/${locale}/ref/${profile.referral_code}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <ToolBackLink
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors font-medium"
            dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('back')}
          </ToolBackLink>
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            {t('badge')}
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-3">
            {t('heroTitle')}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            {t('heroDescription')}
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <Smartphone className="w-8 h-8 text-indigo-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">{t('instantTitle')}</h3>
            <p className="text-sm text-gray-600">{t('instantDescription')}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <Share2 className="w-8 h-8 text-purple-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">{t('shareTitle')}</h3>
            <p className="text-sm text-gray-600">{t('shareDescription')}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <Download className="w-8 h-8 text-pink-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">{t('downloadTitle')}</h3>
            <p className="text-sm text-gray-600">{t('downloadDescription')}</p>
          </div>
        </div>

        {/* Tool */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <QRGeneratorTool 
            referralCode={profile.referral_code}
            referralUrl={referralUrl}
            userName={`${profile.first_name} ${profile.last_name}`}
          />
        </div>

        {/* Tips */}
        <div className="mt-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {t('tipsTitle')}
          </h3>
          <ul className="space-y-2 text-indigo-100 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-white font-bold">•</span>
              <span>{t('tipOne')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white font-bold">•</span>
              <span>{t('tipTwo')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white font-bold">•</span>
              <span>{t('tipThree')}</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}