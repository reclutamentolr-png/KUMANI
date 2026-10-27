import { CookiePreferencesLink } from '@/components/consent/ConsentGate'
import { CANONICAL_ORIGIN } from '@/lib/seo'
import JsonLd from '@/components/seo/JsonLd'
import Link from '@/components/LocalizedLink'
import { CONTACT_INFO } from '@/lib/contactInfo'
import HomeLoginLink from '@/components/home/HomeLoginLink'
import { getLocale, getTranslations } from 'next-intl/server'
import FoundersBanner from '@/components/founders/FoundersBanner'
import { formatOpenDate, getPlansGate } from '@/lib/plansGate'
import {
  Shield,
  ArrowRight,
  Target,
  Ticket,
  Share2,
  CirclePlay,
  Users,
  ShieldAlert,
  Euro,
  LayoutGrid,
  Clock,
  HeartHandshake,
  BadgeCheck,
  Lock,
  Sparkles,
  Coins,
} from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import Logo from '@/components/Logo'
import SocialLinks, { SOCIAL_LINKS } from '@/components/SocialLinks'
import { InstallAppLink } from '@/components/InstallAppBanner'
import HomeNeeds from '@/components/home/HomeNeeds'
import { buildHomeNeeds } from '@/lib/homeNeedsServer'
import HomeKumanoDelGiorno from '@/components/spotlight/HomeKumanoDelGiorno'
import HomeUpcomingEvents from '@/components/events/HomeUpcomingEvents'
import HomeKordataShowcase from '@/components/convivio/HomeKordataShowcase'
import HomeDonations from '@/components/donations/HomeDonations'
import HomeReviews from '@/components/reviews/HomeReviews'
import HomePlans from '@/components/HomePlans'
import HomeSection from '@/components/home/HomeSection'
import HomeBand from '@/components/home/HomeBand'
import HomeCommunity from '@/components/home/HomeCommunity'
import HomeVideo from '@/components/home/HomeVideo'
import { getHomeVideo } from '@/lib/homeVideo'
import { getChristmas } from '@/lib/christmas'
import ChristmasGarland from '@/components/christmas/ChristmasGarland'
import SantaHat from '@/components/christmas/SantaHat'
import HeroLogoVideo from '@/components/home/HeroLogoVideo'
import HeroOrbit from '@/components/home/HeroOrbit'
import { orbitEntries } from '@/lib/homeOrbit'
import { getDisabledTools } from '@/lib/freeTools'

import { getHomeKarma } from '@/lib/homeKarma'
import { DEFAULT_HOME_LAYOUT, HOME_LAYOUT_CONFIG, type HomeLayoutKey } from '@/lib/homeLayouts'
import { getEnabledLocales } from '@/lib/enabledLocales'
import { getAppCounts } from '@/lib/appCounts'

// Contenuto della Home pubblica. `layoutKey`: aspetto scelto dall'Admin
// (cambiano solo sfondi e immagini, mai i contenuti). Usato dalla Home
// (src/app/[locale]/page.tsx, preparata in anticipo e tenuta in memoria) e
// dall'anteprima degli aspetti nell'Admin (admin/anteprima-home/[layout]).
export default async function HomeLanding({ layoutKey }: { layoutKey: HomeLayoutKey }) {
  const [t, tg, tr, tcat, errorT, tInstall, tNeeds, tOrbit] = await Promise.all([
    getTranslations('landingHome'),
    getTranslations('guides'),
    getTranslations('reviews'),
    getTranslations('catalog'),
    getTranslations('errorPages'),
    getTranslations('install'),
    getTranslations('homeNeeds'),
    getTranslations('homeOrbit'),
  ])
  // Schede che girano attorno al logo: un esempio per ogni servizio acceso, di
  // tutte le categorie a turno (vedi lib/homeOrbit). Le prime quattro sono
  // anche quelle fisse del telefono.
  const orbitItems = orbitEntries(await getDisabledTools()).map((e) => ({ title: tOrbit(`${e.key}Title`), text: tOrbit(`${e.key}Text`), scam: e.key.startsWith('scam') }))
  // Un aspetto che non esiste più (salvato prima) usa quello predefinito
  const L = HOME_LAYOUT_CONFIG[layoutKey] ?? HOME_LAYOUT_CONFIG[DEFAULT_HOME_LAYOUT]
  // Video della Home (Admin → Aspetto homepage), di solito il tormentone
  const video = await getHomeVideo()
  // Testi del video: quelli scritti in Admin, altrimenti quelli tradotti del tormentone
  const videoCopy = video?.title ? video : { title: t('videoTitle'), accent: t('videoAccent'), text: t('videoText') }
  // «In cosa possiamo darti una mano?»: per ogni risposta i servizi giusti
  // Numeri sotto l'apertura: lingue attive, servizi e strumenti accesi (decisi dall'Admin)
  const [needs, enabledLocales, counts, karma, christmas] = await Promise.all([buildHomeNeeds(), getEnabledLocales(), getAppCounts(), getHomeKarma(), getChristmas()])
  // Piani non ancora aperti (Admin → Apertura piani): niente prova Pro promessa
  const [gate, locale] = await Promise.all([getPlansGate(), getLocale()])
  const openDate = gate.closed ? formatOpenDate(locale, gate.openDate) : null

  // Codice referral, riconoscimento pubblico e Kordata (acquisti di gruppo).
  // Niente "struttura a matrice" in evidenza — non deve sembrare un network.
  const communityCards = [
    { icon: CirclePlay, title: t('communityCard1Title'), desc: t('communityCard1Description') },
    { icon: Users, title: t('communityCard3Title'), desc: t('communityCard3Description') }
  ]





  // Dati strutturati: chi è KUMANI e il sito
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'KUMANI', url: CANONICAL_ORIGIN, logo: `${CANONICAL_ORIGIN}/icon-512.png`, slogan: t('heroTitle') + ' ' + t('heroAccent'), email: 'support@kumani.io', sameAs: SOCIAL_LINKS.map((s) => s.href) },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'KUMANI', url: CANONICAL_ORIGIN },
  ]

  return (
    <div className="min-h-screen bg-[var(--ink)] overflow-x-hidden">
      <JsonLd data={ld} />
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-lg border-b border-[var(--gold)]/15 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {/* A Natale (Admin → Natale) il logo ha il cappello */}
            <span className="relative">
              <Logo size={40} priority className="sm:h-10 sm:w-10 h-9 w-9" />
              {christmas.decorations && <SantaHat />}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/chi-siamo"
              className="hidden sm:inline-block text-white/80 hover:text-[var(--gold-bright)] font-medium transition-colors text-sm sm:text-base"
            >
              {t('aboutLink')}
            </Link>
            <LanguageSwitcher dark />
            <HomeLoginLink
              loginLabel={t('login')}
              dashboardLabel={errorT('goDashboard')}
              className="text-white/80 hover:text-[var(--gold-bright)] font-medium transition-colors text-sm sm:text-base"
            />
            <Link
              href="/register"
              className="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 text-[var(--ink)] px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl text-sm sm:text-base"
            >
              {t('startNow')}
            </Link>
          </div>
        </div>
        {christmas.decorations && <ChristmasGarland />}
        </header>

      {/* Apertura (bozza): a sinistra la promessa, a destra il logo che gira con
          i servizi intorno (HeroOrbit, solo dal computer); sul telefono il logo
          e quattro schede fisse dei servizi per i privati. */}
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_72%_40%,#3a2e14_0%,#14110b_38%,var(--ink)_70%)]">
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-12 lg:grid-cols-[1fr_1.05fr] lg:gap-6 lg:px-8 lg:py-16">
          <div className="text-center lg:text-left">
            <div className="lg:hidden">
              <HeroLogoVideo label="KUMANI" className="h-40 w-40 sm:h-52 sm:w-52" />
            </div>
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-[var(--gold-bright)] lg:mt-0">{t('heroOrbitEyebrow')}</p>
            <h1 className="mt-3 break-words text-4xl font-extrabold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
              {t('heroOrbitTitle')} <span className="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] bg-clip-text text-transparent">{t('heroOrbitAccent')}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-lg leading-relaxed text-gray-300 sm:text-xl lg:mx-0">{t('heroOrbitText')}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/register"
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-8 py-3.5 text-base font-bold text-[var(--ink)] shadow-xl transition-all hover:brightness-110 sm:text-lg"
              >
                {t('heroDoorsCta')}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/controlla"
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-white/5 px-7 py-3.5 text-base font-bold text-white transition-all hover:bg-white/10 sm:text-lg"
              >
                <ShieldAlert className="h-5 w-5 text-[var(--gold-bright)]" aria-hidden /> {t('heroOrbitCheck')}
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-400">
              {[
                `${counts.tools} ${t('statToolsShort', { count: counts.tools })}`,
                `${counts.services} ${t('statServicesShort', { count: counts.services })}`,
                `${enabledLocales.length} ${t('statLanguagesShort', { count: enabledLocales.length })}`
              ].join(' · ')}
            </p>
            {/* Telefono: quattro schede fisse dei servizi per i privati */}
            <ul className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-2.5 text-left lg:hidden">
              {orbitItems.slice(0, 4).map((item) => (
                <li
                  key={item.title}
                  className={`rounded-2xl px-3.5 py-3 ${item.scam ? 'border border-red-400/60 bg-[#2a0f0d] text-[#ffd9d4]' : 'border border-[var(--gold)]/30 bg-[#1f1a11] text-white'}`}
                >
                  <p className={`text-sm font-extrabold ${item.scam ? 'text-[#ff8a7a]' : 'text-[var(--gold-bright)]'}`}>{item.title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden lg:block">
            <HeroOrbit items={orbitItems} center={<HeroLogoVideo label="KUMANI" className="h-full w-full" />} />
          </div>
        </div>
      </section>

      {/* 💬 IN COSA POSSIAMO DARTI UNA MANO? Una domanda semplice che porta ai servizi giusti */}
      <div id="bisogni" className="scroll-mt-20">
      <HomeSection bg={{ tone: 'light', variant: 'cream' }} className="py-12 sm:py-16">
        <HomeNeeds
          needs={needs}
          texts={{ eyebrow: tNeeds('eyebrow'), title: tNeeds('title'), subtitle: tNeeds('subtitle'), hint: tNeeds('hint'), open: tNeeds('open'), all: tNeeds('all') }}
        />
      </HomeSection>
      </div>

      {/* 🛠️ SEZIONE: IL MARKETPLACE — i servizi nei tre livelli Gratis, Plus
          e Pro, con "Dettagli" per l'elenco completo e trasparente. */}
      <HomeSection bg={L.marketplace} className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 bg-[var(--gold)]/10 border border-[var(--gold)]/30 px-4 py-1.5 rounded-full text-sm font-medium text-[var(--gold-bright)] mb-4">
              <Target className="w-4 h-4" />
              {t('marketplaceEyebrow')}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 break-words">
              {t('marketplaceTitle')} <span className="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] bg-clip-text text-transparent">{t('marketplaceAccent')}</span>{t('marketplaceTitleEnd')}
            </h2>
            <p className="text-base sm:text-xl text-gray-300 max-w-3xl mx-auto">
              {t('marketplaceDescription')}
            </p>
          </div>

          {/* Tre livelli (Gratis, Plus, Pro) con l'elenco completo dei servizi */}
          <p className="-mt-4 mb-10 text-center text-sm text-gray-400 sm:-mt-8 sm:text-base">{t('plansTiersDescription')}</p>
          <HomePlans />
        </div>
      </HomeSection>

      {L.bandAfterMarketplace && <HomeBand band={L.bandAfterMarketplace} />}

      {/* 👥 SEZIONE: LA COMMUNITY — Bacheca, Kordata, Banca del Tempo, Eventi
          e Kumano del Giorno, con chi può usare ogni spazio */}
      <HomeSection bg={L.community} className="py-12 sm:py-20">
        <HomeCommunity />
        {/* 🎵 Il tormentone da YouTube: il lettore si carica solo al play */}
        {video && (
          <div className="mx-auto mt-14 max-w-4xl px-4 text-center sm:mt-20 sm:px-6 lg:px-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              {t('videoEyebrow')}
            </div>
            <h2 className="mb-3 break-words text-3xl font-bold text-white sm:text-5xl">
              {videoCopy.title}{videoCopy.accent && ' '}{videoCopy.accent && (<span className="whitespace-nowrap bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] bg-clip-text text-transparent">{videoCopy.accent}</span>)}
            </h2>
            {videoCopy.text ? <p className="mx-auto mb-8 max-w-2xl text-base text-gray-300 sm:text-lg">{videoCopy.text}</p> : <div className="mb-8" />}
            <HomeVideo id={video.id} title={`${videoCopy.title} ${videoCopy.accent}`.trim()} playLabel={t('videoPlay')} />
          </div>
        )}
      </HomeSection>

      {/* 🤝 SEZIONE: CONDIVIDI KUMANI — volutamente minimale, niente
          linguaggio da "rete"/struttura in evidenza. */}
      <HomeSection bg={L.share} className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 bg-[var(--gold)]/10 border border-[var(--gold)]/30 px-4 py-1.5 rounded-full text-sm font-medium text-[var(--gold-bright)] mb-4">
              <Share2 className="w-4 h-4" />
              {t('communityEyebrow')}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 break-words">
              {t('communityTitle')} <span className="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] bg-clip-text text-transparent">{t('communityAccent')}</span>
            </h2>
            <p className="text-base sm:text-xl text-gray-300 max-w-2xl mx-auto">
              {t('communityDescription')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 max-w-4xl mx-auto">
            {communityCards.map((card, index) => (
              <div key={index} className="rounded-2xl p-6 border border-[var(--gold)]/15 bg-white/[0.03] hover:border-[var(--gold)]/40 transition-colors">
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] flex items-center justify-center mb-4">
                  <card.icon className="w-5 h-5 text-[var(--ink)]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{card.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* Box trasparenza: i badge di community non sono compensi */}
          <div className="bg-white/[0.03] border border-[var(--gold)]/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-4xl mx-auto">
            <Shield className="w-8 h-8 text-[var(--gold-bright)] flex-shrink-0" />
            <p className="text-gray-200 text-sm sm:text-base leading-relaxed">
              <strong className="text-[var(--gold-bright)]">{t('communityTransparencyLead')}</strong> {t('communityTransparencyRest')}
            </p>
          </div>
        </div>
      </HomeSection>

      {/* ☀️ OGGI IN COMMUNITY — Kumano del Giorno: fascia compatta dopo gli
          strumenti e prima dei vantaggi. Solo storie approvate e con
          consenso home esplicito; fallback curato sotto la soglia minima. */}
      <HomeKumanoDelGiorno />

      {/* 📅 PROSSIMI EVENTI — KUMANI Events, una data per serie */}
      <HomeUpcomingEvents />

      {/* 🤝 KORDATA IN CORSO — acquisti di gruppo in vetrina (approvati dallo Staff) */}
      <HomeKordataShowcase />

      {/* Recensioni verificate di chi ha acquistato */}
      <HomeReviews />

      {/* 🎟️ KU KARMA: cosa si guadagna e cosa si prende, con i valori decisi
          dall'Admin (solo i vantaggi accesi). Sezione chiara: la colonna
          «Li spendi» è scura per staccare, con colori scritti a mano perché
          home-light non li schiarisca. */}
      <HomeSection bg={L.bonus} className="py-12 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center sm:mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-4 py-1.5 text-sm font-semibold text-[#7a5b12]">
              <Coins className="h-4 w-4" aria-hidden /> {t('karmaEyebrow')}
            </div>
            <h2 className="mb-4 break-words text-3xl font-extrabold text-white sm:text-5xl">
              {t('karmaTitle')} <span className="bg-gradient-to-r from-[#b8891c] to-[var(--gold)] bg-clip-text text-transparent">{t('karmaAccent')}</span>
            </h2>
            <p className="mx-auto max-w-3xl text-base text-gray-300 sm:text-lg">{t('karmaText')}</p>
          </div>

          <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:gap-6">
            <div className="flex-1 rounded-3xl border border-[var(--gold)]/35 bg-white p-6 shadow-[0_18px_40px_-28px_rgba(23,23,23,0.45)] sm:p-8">
              <h3 className="text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">{t('karmaEarnTitle')}</h3>
              <ul className="mt-5 divide-y divide-[var(--gold)]/20">
                {[
                  { label: t('earnLogin'), value: t('earnPerDay', { n: karma.dailyLogin }) },
                  { label: t('earnTool'), value: karma.toolMin === karma.toolMax ? t('earnPerDay', { n: karma.toolMin }) : t('earnRange', { min: karma.toolMin, max: karma.toolMax }) },
                  ...(karma.fincheck ? [{ label: t('earnFincheck'), value: `+${karma.fincheck}` }] : []),
                  { label: t('earnExtra'), value: t('earnExtraValue') },
                ].map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-4 py-3 text-base sm:text-lg">
                    <span className="text-[#3d382e]">{row.label}</span>
                    <b className="shrink-0 text-right text-[#8a6a1a]">{row.value}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-center" aria-hidden>
              <span className="flex h-12 w-12 rotate-90 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] shadow-lg lg:rotate-0">
                <ArrowRight className="h-6 w-6" />
              </span>
            </div>
            <div className="flex-1 rounded-3xl bg-[#15120c] p-6 shadow-[0_18px_40px_-24px_rgba(23,23,23,0.7)] sm:p-8">
              <h3 className="text-2xl font-extrabold text-[#e8c872] sm:text-3xl">{t('karmaSpendTitle')}</h3>
              <ul className="mt-5 divide-y divide-[#3a2e14]">
                {[
                  ...(karma.renewal ? [{ label: t('spendRenewal', { discount: karma.renewal.discount }), value: karma.renewal.cost }] : []),
                  ...(karma.surprise ? [{ label: t('spendSurprise'), value: karma.surprise }] : []),
                  { label: t('spendListing'), value: karma.listing },
                  ...(karma.showcase ? [{ label: t('spendShowcase'), value: karma.showcase }] : []),
                  ...(karma.theme ? [{ label: t('spendTheme'), value: karma.theme }] : []),
                ].map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-4 py-3 text-base sm:text-lg">
                    <span className="text-[#f4efe3]">{row.label}</span>
                    <b className="shrink-0 whitespace-nowrap text-[#e8c872]">{t('karmaAmount', { n: row.value })}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-gray-300 sm:text-base">
            {t('karmaFooter')}{' '}
            <Link href="/terms" className="font-semibold text-[#7a5b12] underline underline-offset-2">
              {t('karmaRules')}
            </Link>{' '}
            · {t('karmaWallet')}
          </p>
        </div>
      </HomeSection>

      {L.bandAfterBonus && <HomeBand band={L.bandAfterBonus} />}

      {/* Perché scegliere KUMANI: titolo, poi otto schede uguali in griglia */}
      <HomeSection bg={L.benefits} className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl sm:mb-10">
            <h2 className="mb-4 break-words text-2xl font-bold text-white sm:mb-5 sm:text-4xl">{t('benefitsTitle')}</h2>
            <p className="text-base text-gray-300 sm:text-xl">{t('benefitsDescription')}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {[
              { Icon: ShieldAlert, title: t('why1Title'), text: t('why1Text') },
              { Icon: Euro, title: t('benefitCard1Title'), text: t('benefitCard1Text') },
              { Icon: BadgeCheck, title: t('why2Title'), text: t('why2Text') },
              { Icon: LayoutGrid, title: t('benefitCard2Title'), text: t('benefitCard2Text') },
              { Icon: Lock, title: t('why3Title'), text: t('why3Text') },
              { Icon: Clock, title: t('benefitCard7Title'), text: t('benefitCard7Text') },
              { Icon: Sparkles, title: t('why5Title'), text: openDate ? t('why5TextSoon') : t('why5Text') },
              { Icon: HeartHandshake, title: t('benefitCard8Title'), text: t('benefitCard8Text') },
            ].map(({ Icon, title, text }) => (
              <li key={title} className="flex flex-col gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white/[0.04] p-4 sm:p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)]">
                  <Icon className="h-5 w-5 text-[var(--ink)]" aria-hidden />
                </span>
                <span>
                  <span className="block text-lg font-bold text-white">{title}</span>
                  <span className="block text-sm leading-relaxed text-gray-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-8 text-center sm:mt-10">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 text-base font-bold text-[var(--ink)] shadow-xl transition-all hover:shadow-2xl hover:brightness-110 sm:px-8 sm:py-4 sm:text-lg"
            >
              {t('benefitsCta')}
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
          </div>
        </div>
      </HomeSection>

      {/* ❤️ DONAZIONI: prima della chiamata finale */}
      <HomeDonations />

      {/* CTA Section */}
      <HomeSection bg={L.cta} className="py-12 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Ticket className="w-12 h-12 sm:w-16 sm:h-16 text-[var(--gold-bright)] mx-auto mb-4 sm:mb-6" />
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 break-words">
            {t('ctaTitle')}
          </h2>
          <p className="text-base sm:text-xl text-white/80 mb-6 sm:mb-8">
            {t('ctaDescription')}
          </p>
          {/* Lancio Beta anche accanto all'ultimo pulsante */}
          <div className="mx-auto max-w-xl text-left">
            <FoundersBanner variant="card" cta={false} />
          </div>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 text-[var(--ink)] px-6 sm:px-10 py-3 sm:py-5 rounded-lg font-bold text-base sm:text-xl transition-all shadow-2xl hover:scale-105"
          >
            {t('ctaButton')}
            <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6" />
          </Link>
          <p className="text-white/60 mt-4 text-xs sm:text-sm">
            {openDate ? t('ctaNoteSoon', { date: openDate }) : t('ctaNote')}
          </p>
        </div>
      </HomeSection>

      {/* Footer */}
      <footer className="bg-black/50 border-t border-[var(--gold)]/15 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Logo size={40} className="sm:h-10 sm:w-10 h-9 w-9" />
              <div>
                <span className="block text-xs text-gray-500">Mani che ti danno una mano.</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-gray-400 text-sm">
              <Link href="/chi-siamo" className="hover:text-[var(--gold-bright)] transition-colors">{t('aboutLink')}</Link>
              <Link href="/guida" className="hover:text-[var(--gold-bright)] transition-colors">{tg('linkLabel')}</Link>
              <Link href="/recensioni" className="hover:text-[var(--gold-bright)] transition-colors">{tr('footerLink')}</Link>
              <Link href="/catalogo" className="hover:text-[var(--gold-bright)] transition-colors">{tcat('footerLink')}</Link>
              <Link href="/privacy" className="hover:text-[var(--gold-bright)] transition-colors">Privacy</Link>
              <CookiePreferencesLink className="hover:text-[var(--gold-bright)] transition-colors" />
              <Link href="/terms" className="hover:text-[var(--gold-bright)] transition-colors">{t('terms')}</Link>
              <Link href="/contact" className="hover:text-[var(--gold-bright)] transition-colors">{t('contact')}</Link>
              <InstallAppLink className="cursor-pointer hover:text-[var(--gold-bright)] transition-colors">{tInstall('menuLink')}</InstallAppLink>
            </div>
            <div className="text-gray-400 text-xs sm:text-sm text-center">
              {t('copyright')}
              {CONTACT_INFO.company.name && (
                <span className="mt-1 block text-[11px] text-gray-500 sm:text-xs">
                  {CONTACT_INFO.company.name}
                  {CONTACT_INFO.company.vatNumber && ` · P.IVA ${CONTACT_INFO.company.vatNumber}`}
                </span>
              )}
            </div>
          </div>
          {/* YouTube, Instagram e TikTok di KUMANI */}
          <div className="mt-6">
            <SocialLinks label={(name) => t('socialFollow', { name })} />
          </div>
          <p className="text-gray-500 text-xs text-center mt-6 max-w-3xl mx-auto leading-relaxed">
            {t('footerLegalNote1')}
            {' '}
            {t('footerLegalNote2')}
          </p>
          {/* Chi ha realizzato il sito */}
          <p className="mt-4 text-center text-xs text-gray-500">{t('builtBy', { name: 'MC TEKNOLOGY' })}</p>
        </div>
      </footer>
    </div>
  )
}
