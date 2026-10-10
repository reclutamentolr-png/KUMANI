import { CookiePreferencesLink } from '@/components/consent/ConsentGate'
import { CANONICAL_ORIGIN } from '@/lib/seo'
import JsonLd from '@/components/seo/JsonLd'
import Link from '@/components/LocalizedLink'
import HomeLoginLink from '@/components/home/HomeLoginLink'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import {
  Gift,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
  Target,
  Sparkles,
  Ticket,
  BadgePercent,
  Wallet,
  Gem,
  Share2,
  Trophy,
  HandPlatter,
  CalendarDays,
  Plane,
  UtensilsCrossed,
  Coins,
  PartyPopper
} from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import Logo from '@/components/Logo'
import { InstallAppLink } from '@/components/InstallAppBanner'
import HomeNeeds from '@/components/home/HomeNeeds'
import { HOME_NEEDS, type HomeNeed, type HomeNeedItem } from '@/lib/homeNeeds'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import HomeKumanoDelGiorno from '@/components/spotlight/HomeKumanoDelGiorno'
import HomeUpcomingEvents from '@/components/events/HomeUpcomingEvents'
import HomeKordataShowcase from '@/components/convivio/HomeKordataShowcase'
import HomeDonations from '@/components/donations/HomeDonations'
import HomeReviews from '@/components/reviews/HomeReviews'
import HomePlans from '@/components/HomePlans'
import HomeSection from '@/components/home/HomeSection'
import HomeBand from '@/components/home/HomeBand'
import HomeCommunity from '@/components/home/HomeCommunity'
import HeroLogoVideo from '@/components/home/HeroLogoVideo'
import HeroSideImage from '@/components/home/HeroSideImage'
import { HOME_LAYOUT_CONFIG, type HomeLayoutKey } from '@/lib/homeLayouts'

// Contenuto della Home pubblica. `layoutKey`: aspetto scelto dall'Admin
// (cambiano solo sfondi e immagini, mai i contenuti). Usato dalla Home
// (src/app/[locale]/page.tsx, preparata in anticipo e tenuta in memoria) e
// dall'anteprima degli aspetti nell'Admin (admin/anteprima-home/[layout]).
export default async function HomeLanding({ layoutKey }: { layoutKey: HomeLayoutKey }) {
  const [t, tg, tr, tcat, errorT, tInstall, tNeeds, tMarket, tSurprise] = await Promise.all([
    getTranslations('landingHome'),
    getTranslations('guides'),
    getTranslations('reviews'),
    getTranslations('catalog'),
    getTranslations('errorPages'),
    getTranslations('install'),
    getTranslations('homeNeeds'),
    getTranslations('marketplace'),
    getTranslations('surprise'),
  ])
  const L = HOME_LAYOUT_CONFIG[layoutKey]
  // «In cosa possiamo darti una mano?»: per ogni risposta i servizi giusti
  const toolsByName = new Map(getMarketplaceTools(tMarket).map((tool) => [tool.toolName, tool]))
  const needs: HomeNeed[] = HOME_NEEDS.map((need) => ({
    key: need.key,
    icon: need.icon,
    label: tNeeds(`need_${need.key}`),
    intro: tNeeds(`intro_${need.key}`),
    items: (need.items as readonly string[]).flatMap((name): HomeNeedItem[] => {
      if (name === 'events') return [{ name, title: tMarket('events'), description: tMarket('eventsDescription'), href: '/events', iconName: 'Users' }]
      if (name === 'sorprese') return [{ name, title: `KUMANI ${tSurprise('title')}`, description: tSurprise('intro'), href: '/sorprese', iconName: 'Gift' }]
      const tool = toolsByName.get(name)
      return tool ? [{ name, title: tool.title.split(/\s[-–—]\s/)[0], description: tool.description, href: `/strumenti/${name}`, iconName: tool.iconName }] : []
    }),
  }))
  // Apertura con testo a sinistra sul computer (foto a lato)
  const leftHero = L.hero.kind === 'split' || L.hero.kind === 'side'
  const heroBadgeClass =
    'rounded-2xl border border-[var(--gold)]/60 bg-[var(--gold)]/15 px-5 py-3 text-lg font-semibold leading-snug text-white shadow-[0_10px_30px_rgba(199,154,59,0.18)] backdrop-blur sm:px-7 sm:py-4 sm:text-xl'

  // Codice referral, riconoscimento pubblico e Kordata (acquisti di gruppo).
  // Niente "struttura a matrice" in evidenza — non deve sembrare un network.
  const communityCards = [
    { icon: Share2, title: t('communityCard1Title'), desc: t('communityCard1Description') },
    { icon: Trophy, title: t('communityCard3Title'), desc: t('communityCard3Description') }
  ]

  // L'Ecosistema: come gli strumenti si alimentano a vicenda (solo
  // collegamenti che esistono davvero; Events è segnato "in arrivo").
  const synergies = [
    { icon: CalendarDays, title: t('synergy1Title'), desc: t('synergy1Text'), soon: false },
    { icon: Plane, title: t('synergy2Title'), desc: t('synergy2Text'), soon: false },
    { icon: UtensilsCrossed, title: t('synergy3Title'), desc: t('synergy3Text'), soon: false },
    { icon: HandPlatter, title: t('synergy4Title'), desc: t('synergy4Text'), soon: false },
    { icon: Coins, title: t('synergy5Title'), desc: t('synergy5Text'), soon: false },
    { icon: PartyPopper, title: t('synergy6Title'), desc: t('synergy6Text'), soon: false },
  ]

  const steps = [
    { step: '1', icon: Zap, title: t('step1Title'), desc: t('step1Description') },
    { step: '2', icon: Target, title: t('step2Title'), desc: t('step2Description') },
    { step: '3', icon: Ticket, title: t('step3Title'), desc: t('step3Description') }
  ]

  const perks = [
    { icon: BadgePercent, title: t('perk1Title'), desc: t('perk1Description') },
    { icon: Wallet, title: t('perk2Title'), desc: t('perk2Description') },
    { icon: Gift, title: t('perk3Title'), desc: t('perk3Description') },
    { icon: Gem, title: t('perk4Title'), desc: t('perk4Description') }
  ]

  const benefits = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => t(`benefit${n}`))

  // Dati strutturati: chi è KUMANI e il sito
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'KUMANI', url: CANONICAL_ORIGIN, logo: `${CANONICAL_ORIGIN}/icon-512.png`, slogan: t('heroTitle') + ' ' + t('heroAccent'), email: 'support@kumani.io' },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'KUMANI', url: CANONICAL_ORIGIN },
  ]

  return (
    <div className="min-h-screen bg-[var(--ink)] overflow-x-hidden">
      <JsonLd data={ld} />
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-lg border-b border-[var(--gold)]/15 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Logo size={40} priority className="sm:h-10 sm:w-10 h-9 w-9" />
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
      </header>

      {/* Hero Section — a piena larghezza, senza il carosello degli ultimi
          iscritti: tutto lo spazio è per il messaggio "non ti serve una
          promessa, ti serve una mano". */}
      <section
        className={`relative overflow-hidden ${L.hero.kind === 'side' ? 'bg-[#0c0d0c]' : L.hero.kind === 'split' ? 'home-light bg-[var(--background)]' : L.hero.variant === 'radial' ? 'bg-[radial-gradient(ellipse_at_70%_0%,#3a2e17_0%,var(--ink)_60%)]' : ''}`}
      >
        {L.hero.kind === 'photo' && L.hero.image ? (
          <>
            <Image src={L.hero.image} alt="" fill priority sizes="100vw" className="object-cover" />
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,13,10,0.62)_0%,rgba(15,13,10,0.84)_75%)]" />
          </>
        ) : (
          L.hero.kind === 'classic' && <div className="absolute inset-0 bg-gradient-to-b from-[var(--gold)]/10 via-transparent to-transparent"></div>
        )}
        <div
          className={`relative mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 lg:pt-12 pb-16 sm:pb-24 lg:pb-28 ${
            L.hero.kind === 'split'
              ? 'grid max-w-7xl items-center gap-10 text-center lg:grid-cols-[1.1fr_0.9fr] lg:text-left'
              : L.hero.kind === 'side'
                ? 'z-10 max-w-7xl text-center lg:py-28 lg:text-left'
                : 'max-w-4xl text-center'
          }`}
        >
          <div className={L.hero.kind === 'side' ? 'lg:max-w-[46%]' : undefined}>
          <p className="text-2xl sm:text-3xl font-bold tracking-[0.3em] text-[var(--gold-bright)] mb-3 sm:mb-4">KUMANI</p>
          <div className={`flex mb-5 sm:mb-7 ${leftHero ? 'justify-center lg:justify-start' : 'justify-center'}`}>
            {L.hero.video ? <HeroLogoVideo label="KUMANI" /> : <Logo size={96} priority className="sm:h-28 sm:w-28 h-24 w-24" />}
          </div>
          {/* Il manifesto in una frase: ben visibile, non un'etichetta. Nel
              tema con la foto di lato, sul computer sta in alto a destra
              sopra le mani (vedi sotto). */}
          <div className={`mx-auto mb-6 inline-flex max-w-3xl items-center gap-3 sm:mb-8 ${heroBadgeClass} ${L.hero.kind === 'side' ? 'lg:hidden' : ''}`}>
            <Sparkles className="h-5 w-5 shrink-0 text-[var(--gold-bright)] sm:h-6 sm:w-6" />
            {t('heroBadge')}
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white mb-5 sm:mb-7 leading-tight break-words">
            {/* Una riga per pezzo: "Le tue idee," / "le nostre mani." / "Insieme." */}
            {t('heroTitle')
              .split(/(?<=,)\s+/)
              .map((part) => (
                <span key={part} className="block">
                  {part}
                </span>
              ))}
            <span className="block bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] bg-clip-text text-transparent">{t('heroAccent')}</span>
          </h1>
          <p className={`text-lg sm:text-xl text-gray-300 mb-8 sm:mb-10 leading-relaxed max-w-2xl mx-auto ${leftHero ? 'lg:mx-0' : ''}`}>
            {t('heroDescription')}{' '}
            <strong className="text-white">{t('heroDescriptionStrong')}</strong>: {t('heroDescriptionEnd')}
          </p>
          <div className={`flex flex-col sm:flex-row gap-3 sm:gap-4 mb-10 sm:mb-14 justify-center ${leftHero ? 'lg:justify-start' : ''}`}>
            <Link
              href="/register"
              className="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 text-[var(--ink)] px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all shadow-xl hover:shadow-2xl hover:scale-105 flex items-center justify-center gap-2"
            >
              {t('heroCta')}
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
            <HomeLoginLink
              loginLabel={t('login')}
              dashboardLabel={errorT('goDashboard')}
              className="bg-white/5 hover:bg-white/10 backdrop-blur text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all border border-white/15 flex items-center justify-center"
            />
          </div>
          {/* Stats */}
          <div className={`grid grid-cols-3 gap-3 sm:gap-6 max-w-xl mx-auto ${leftHero ? 'lg:mx-0' : ''}`}>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-white">7</div>
              <div className="text-xs sm:text-sm text-gray-400">{t('statLanguagesLabel')}</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-[var(--gold-bright)]">{t('statWeeklyValue')}</div>
              <div className="text-xs sm:text-sm text-gray-400">{t('statWeeklyLabel')}</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-white">40+</div>
              <div className="text-xs sm:text-sm text-gray-400">{t('statServicesLabel')}</div>
            </div>
          </div>
          </div>
          {L.hero.kind === 'split' && L.hero.image && (
            <div className="relative hidden aspect-[4/3] overflow-hidden rounded-[28px] border-[6px] border-white shadow-[0_24px_60px_rgba(23,23,23,0.28)] lg:block">
              <Image src={L.hero.image} alt="" fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
            </div>
          )}
        </div>
        {L.hero.kind === 'side' && L.hero.image && L.hero.mobileImage && (
          <HeroSideImage image={L.hero.image} mobileImage={L.hero.mobileImage} position={L.hero.position} />
        )}
        {L.hero.kind === 'side' && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden lg:block">
            <div className="mx-auto flex max-w-7xl justify-end px-8 pt-12">
              <div className={`pointer-events-auto flex max-w-xl items-center gap-3 text-left ${heroBadgeClass}`}>
                <Sparkles className="h-6 w-6 shrink-0 text-[var(--gold-bright)]" />
                {t('heroBadge')}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 💬 IN COSA POSSIAMO DARTI UNA MANO? Una domanda semplice che porta ai servizi giusti */}
      <HomeSection bg={{ tone: 'light', variant: 'cream' }} className="py-12 sm:py-16">
        <HomeNeeds
          needs={needs}
          texts={{ eyebrow: tNeeds('eyebrow'), title: tNeeds('title'), subtitle: tNeeds('subtitle'), hint: tNeeds('hint'), open: tNeeds('open'), all: tNeeds('all') }}
        />
      </HomeSection>

      {/* 🛠️ SEZIONE: IL MARKETPLACE — i servizi nei tre livelli Gratis, Base
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

          {/* Tre livelli (Gratis, Base, Pro) con l'elenco completo dei servizi */}
          <p className="-mt-4 mb-10 text-center text-sm text-gray-400 sm:-mt-8 sm:text-base">{t('plansTiersDescription')}</p>
          <HomePlans />

          {/* Come si parlano gli strumenti */}
          <div className="mt-10 rounded-3xl border border-[var(--gold)]/25 bg-gradient-to-br from-[var(--gold)]/10 via-white/[0.03] to-transparent p-6 sm:p-8">
            <h3 className="text-xl font-bold text-white sm:text-2xl">{t('synergyTitle')}</h3>
            <p className="mt-1 text-sm text-gray-300 sm:text-base">{t('synergySubtitle')}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {synergies.map((item, index) => (
                <div
                  key={index}
                  className={`relative rounded-2xl border p-4 ${item.soon ? 'border-dashed border-[var(--gold)]/50 bg-transparent' : 'border-[var(--gold)]/15 bg-white/[0.04]'}`}
                >
                  {item.soon && (
                    <span className="absolute right-3 top-3 rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink)]">
                      {t('comingSoon')}
                    </span>
                  )}
                  <item.icon className="mb-2 h-6 w-6 text-[var(--gold-bright)]" />
                  <p className="pr-16 font-bold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </HomeSection>

      {L.bandAfterMarketplace && <HomeBand band={L.bandAfterMarketplace} />}

      {/* 👥 SEZIONE: LA COMMUNITY — Bacheca, Kordata, Banca del Tempo, Eventi
          e Kumano del Giorno, con chi può usare ogni spazio */}
      <HomeSection bg={L.community} className="py-12 sm:py-20">
        <HomeCommunity />
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

      {/* 🎟️ SEZIONE: PROGRAMMA BONUS & COUPON */}
      <HomeSection bg={L.bonus} className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 bg-[var(--gold)]/10 border border-[var(--gold)]/30 px-4 py-1.5 rounded-full text-sm font-medium text-[var(--gold-bright)] mb-4">
              <Ticket className="w-4 h-4" />
              {t('bonusEyebrow')}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 break-words">
              {t('bonusTitle')} <span className="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] bg-clip-text text-transparent">{t('bonusAccent')}</span>
            </h2>
            <p className="text-base sm:text-xl text-gray-300 max-w-3xl mx-auto">
              {t('bonusDescription')}
            </p>
          </div>

          {/* Come funziona: 3 step */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {steps.map((item, index) => (
              <div key={index} className="relative bg-white/[0.03] rounded-2xl p-6 border border-[var(--gold)]/15">
                <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] flex items-center justify-center text-[var(--ink)] font-bold text-sm shadow-lg">
                  {item.step}
                </div>
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] flex items-center justify-center mb-4 mt-2">
                  <item.icon className="w-5 h-5 text-[var(--ink)]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Box trasparenza (importante anche legalmente) */}
          <div className="bg-white/[0.03] border border-[var(--gold)]/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
            <Shield className="w-8 h-8 text-[var(--gold-bright)] flex-shrink-0" />
            <p className="text-gray-200 text-sm sm:text-base leading-relaxed">
              <strong className="text-[var(--gold-bright)]">{t('transparencyLead')}</strong> {t('transparencyRest')}
            </p>
          </div>

          {/* Tipologie di vantaggi — tessere compatte */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {perks.map((perk, index) => (
              <div key={index} className="rounded-xl p-4 sm:p-5 border border-[var(--gold)]/15 bg-white/[0.03] hover:border-[var(--gold)]/40 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] flex items-center justify-center mb-3">
                  <perk.icon className="w-5 h-5 text-[var(--ink)]" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{perk.title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{perk.desc}</p>
              </div>
            ))}
          </div>

          {/* Banner iniziative esclusive con rimando al regolamento */}
          <div className="mt-8 bg-white/[0.03] border border-[var(--gold)]/25 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <Gem className="w-6 h-6 text-[var(--gold-bright)]" />
                {t('bannerTitle')}
              </h3>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                {t('bannerText1')} <strong className="text-white">{t('bannerTextBold')}</strong>{t('bannerText2')}
              </p>
            </div>
            <Link
              href="/terms"
              className="flex-shrink-0 inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-[var(--gold)]/30 text-white px-5 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base"
            >
              {t('bannerCta')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </HomeSection>

      {L.bandAfterBonus && <HomeBand band={L.bandAfterBonus} />}

      {/* Benefits Section */}
      <HomeSection bg={L.benefits} className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4 sm:mb-6 break-words">
                {t('benefitsTitle')}
              </h2>
              <p className="text-base sm:text-xl text-gray-300 mb-6 sm:mb-8">
                {t('benefitsDescription')}
              </p>
              <div className="space-y-3 sm:space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--gold-bright)] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm sm:text-base">{benefit}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 mt-6 sm:mt-8 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 text-[var(--ink)] px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all shadow-xl hover:shadow-2xl"
              >
                {t('benefitsCta')}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </Link>
            </div>
            <div className="relative">
              <div className="relative bg-white/[0.03] rounded-3xl p-6 sm:p-8 border border-[var(--gold)]/25">
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] flex items-center justify-center flex-shrink-0">
                      <Ticket className="w-5 h-5 text-[var(--ink)]" />
                    </div>
                    <div>
                      <div className="text-white font-bold">{t('sideRow1Title')}</div>
                      <div className="text-gray-400 text-sm">{t('sideRow1Description')}</div>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-[var(--ink)]" />
                    </div>
                    <div>
                      <div className="text-white font-bold">{t('sideRow2Title')}</div>
                      <div className="text-gray-400 text-sm">{t('sideRow2Description')}</div>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] flex items-center justify-center flex-shrink-0">
                      <Gem className="w-5 h-5 text-[var(--ink)]" />
                    </div>
                    <div>
                      <div className="text-white font-bold">{t('sideRow3Title')}</div>
                      <div className="text-gray-400 text-sm">{t('sideRow3Description')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 text-[var(--ink)] px-6 sm:px-10 py-3 sm:py-5 rounded-lg font-bold text-base sm:text-xl transition-all shadow-2xl hover:scale-105"
          >
            {t('ctaButton')}
            <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6" />
          </Link>
          <p className="text-white/60 mt-4 text-xs sm:text-sm">
            {t('ctaNote')}
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
            </div>
          </div>
          <p className="text-gray-500 text-xs text-center mt-6 max-w-3xl mx-auto leading-relaxed">
            {t('footerLegalNote1')}
            {' '}
            {t('footerLegalNote2')}
          </p>
        </div>
      </footer>
    </div>
  )
}
