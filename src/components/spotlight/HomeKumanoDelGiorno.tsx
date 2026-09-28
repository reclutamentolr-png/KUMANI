import { getLocale, getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import { ArrowRight, Sun } from 'lucide-react'
import { SPOTLIGHT_LOCALE_FLAGS } from '@/lib/spotlight'
import { getHomeKumano, isSpotlightOnline } from '@/lib/spotlightHome'

// Fascia "Oggi in community" della landing pubblica: una storia vera,
// consensata e moderata, al posto del vecchio carosello "ultimi iscritti".
// Nessun dato di sessione qui dentro (la card è uguale per tutti ed è
// cachata con tag, vedi lib/spotlightHome.ts): per questo la micro-CTA
// "racconta la tua storia" è mostrata a tutti e porta a
// /marketplace/spotlight, che rimanda al login chi non è iscritto.
export default async function HomeKumanoDelGiorno() {
  const t = await getTranslations('spotlightHome')
  const locale = await getLocale()
  if (!(await isSpotlightOnline())) return null
  const kumano = await getHomeKumano()

  // Cold start: finché il pool home è sotto soglia, storia curata dal team
  // — dichiarata come tale, mai spacciata per un utente reale.
  const card = kumano
    ? {
        name: kumano.display_name,
        meta: [kumano.profession, [kumano.city, kumano.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
        story: kumano.story,
        flag: kumano.story_locale ? SPOTLIGHT_LOCALE_FLAGS[kumano.story_locale] : undefined,
        storyLocale: kumano.story_locale ?? undefined,
      }
    : {
        name: t('fallbackName'),
        meta: t('fallbackMeta'),
        story: t('fallbackStory'),
        flag: undefined,
        storyLocale: undefined,
      }

  const today = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  return (
    <section className="py-10 sm:py-14 border-t border-[var(--gold)]/10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--gold)]/25 bg-white/[0.03] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
              <Sun className="w-4 h-4" />
              {t('eyebrow')}
            </span>
            <span className="text-xs text-gray-400">{today}</span>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 rounded-full border border-[var(--gold)]/30 bg-black/30 p-1.5">
              <Logo size={48} className="h-11 w-11 sm:h-12 sm:w-12" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">{card.name}</h3>
                {card.flag && (
                  <span
                    className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-gray-300"
                    title={t('originalLanguage')}
                  >
                    {card.flag} {card.storyLocale?.toUpperCase()}
                  </span>
                )}
              </div>
              {card.meta && <p className="text-xs sm:text-sm text-gray-400">{card.meta}</p>}
              <blockquote lang={card.storyLocale} className="mt-3 text-sm sm:text-base leading-relaxed text-gray-200 line-clamp-3">
                «{card.story}»
              </blockquote>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 sm:pl-[76px]">
            <Link href="/spotlight" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold-bright)] hover:text-white transition-colors">
              {t('readFull')}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/spotlight" className="text-sm text-gray-400 hover:text-white transition-colors">
              {t('archive')}
            </Link>
            <Link href="/marketplace/spotlight" className="text-sm text-gray-400 hover:text-white transition-colors sm:ml-auto">
              {t('tellYourStory')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
