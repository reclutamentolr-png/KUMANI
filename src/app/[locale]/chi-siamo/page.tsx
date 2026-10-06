import Link from '@/components/LocalizedLink'
import { pageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
  ArrowLeft,
  Sparkles,
  Heart,
  HandHeart,
  CheckCircle2
} from 'lucide-react'

// Pagina uguale per tutti: preparata in anticipo per ogni lingua e rifatta
// in background (al massimo ogni ora; prima se cambiano lingue o traduzioni)
export const revalidate = 3600

type LocaleProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: LocaleProps): Promise<Metadata> {
  setRequestLocale((await params).locale)
  const t = await getTranslations('aboutPage')
  return pageMetadata('/chi-siamo', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function ChiSiamoPage({ params }: LocaleProps) {
  setRequestLocale((await params).locale)
  const t = await getTranslations('aboutPage')

  const manifestoItems = [1, 2, 3, 4, 5, 6].map((n) => ({
    strong: t(`manifesto${n}Strong`),
    rest: t(`manifesto${n}Rest`)
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{t('backToHome')}</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Titolo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Sparkles className="w-4 h-4" />
            {t('badge')}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {t('title')}
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="space-y-8">
          {/* Il significato del nome */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('nameTitle')}</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>{t('namePara1')}</p>
              <p>{t('namePara2')}</p>
              <p>{t('namePara3')}</p>
            </div>
          </section>

          {/* La storia fondativa */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('storyTitle')}</h2>
            <div className="text-gray-600 space-y-4 text-sm sm:text-base leading-relaxed">
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">{t('story1Title')}</h3>
                <p>{t('story1Text')}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">{t('story2Title')}</h3>
                <p>{t('story2Text1')}</p>
                <p className="mt-2">{t('story2Text2')}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">{t('story3Title')}</h3>
                <p>{t('story3Text')}</p>
              </div>
            </div>
          </section>

          {/* Manifesto */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <HandHeart className="w-5 h-5 text-indigo-600" />
              {t('manifestoTitle')}
            </h2>
            <ul className="space-y-3">
              {manifestoItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-gray-900">{item.strong}</strong> {item.rest}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Chiusura */}
          <section className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-center text-white">
            <Heart className="w-8 h-8 mx-auto mb-3 text-pink-200" />
            <p className="text-lg sm:text-xl font-bold mb-2">{t('closingTitle')}</p>
            <p className="text-white/80 text-sm sm:text-base mb-6">{t('closingSubtitle')}</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-lg font-bold transition-all shadow-xl hover:scale-105"
            >
              {t('closingCta')}
            </Link>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-8 mt-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          © 2026 Kumani — {t('footerTagline')}
        </div>
      </footer>
    </div>
  )
}
