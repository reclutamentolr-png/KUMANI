import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import type { HomeBand as HomeBandConfig } from '@/lib/homeLayouts'

// Fascia fotografica tra due sezioni: una frase del manifesto, oppure il
// richiamo alla community (Bacheca, Kordata, Banca del Tempo, donazioni).
export default async function HomeBand({ band }: { band: HomeBandConfig }) {
  const t = await getTranslations('landingHome')
  return (
    <div className={`relative overflow-hidden ${band.kind === 'quote' ? 'h-52 sm:h-64' : 'py-16 sm:py-20'}`}>
      <Image src={band.image} alt="" fill sizes="100vw" className="object-cover" style={{ objectPosition: band.position ?? 'center' }} />
      {band.kind === 'quote' ? (
        <>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[rgba(15,13,10,0.85)] via-[rgba(15,13,10,0.35)] to-[rgba(15,13,10,0.85)]" />
          <p className="relative flex h-full items-center justify-center px-6 text-center text-2xl font-extrabold text-white drop-shadow sm:text-4xl">
            {t(band.quote ?? 'bandHelp')}
          </p>
        </>
      ) : (
        <>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[rgba(15,13,10,0.94)] via-[rgba(15,13,10,0.75)] to-[rgba(15,13,10,0.4)]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl">
              <p className="inline-flex rounded-full border border-[var(--gold)]/40 px-3 py-1 text-xs font-bold text-[var(--gold-bright)]">{t('bandHelp')}</p>
              <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">{t('bandCommunityTitle')}</h2>
              <p className="mt-3 text-base leading-relaxed text-gray-300 sm:text-lg">{t('bandCommunityText')}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
