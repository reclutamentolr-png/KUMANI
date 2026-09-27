import Link from '@/components/LocalizedLink'
import { useTranslations } from 'next-intl'
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
  Briefcase,
  Check
} from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import Logo from '@/components/Logo'
import HomeToolsGrid from '@/components/HomeToolsGrid'
import HomeKumanoDelGiorno from '@/components/spotlight/HomeKumanoDelGiorno'

export default function LandingPage() {
  const t = useTranslations('landingHome')

  // Codice referral, riconoscimento pubblico e Kordata (acquisti di gruppo).
  // Niente "struttura a matrice" in evidenza — non deve sembrare un network.
  const communityCards = [
    { icon: Share2, title: t('communityCard1Title'), desc: t('communityCard1Description') },
    { icon: Trophy, title: t('communityCard3Title'), desc: t('communityCard3Description') },
    { icon: HandPlatter, title: t('communityKordataTitle'), desc: t('communityKordataDescription') }
  ]

  // Piani: Base per tutti, Pro per chi lavora con i clienti (prova gratuita).
  const baseFeatures = [1, 2, 3, 4].map((n) => t(`planBaseFeature${n}`))
  const proFeatures = [1, 2, 3, 4].map((n) => t(`planProFeature${n}`))

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

  const benefits = [1, 2, 3, 4, 5, 6, 7].map((n) => t(`benefit${n}`))

  return (
    <div className="min-h-screen bg-[var(--ink)] overflow-x-hidden">
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
            <Link
              href="/login"
              className="text-white/80 hover:text-[var(--gold-bright)] font-medium transition-colors text-sm sm:text-base"
            >
              {t('login')}
            </Link>
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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--gold)]/10 via-transparent to-transparent"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 lg:pt-12 pb-16 sm:pb-24 lg:pb-28 text-center">
          <p className="text-2xl sm:text-3xl font-bold tracking-[0.3em] text-[var(--gold-bright)] mb-3 sm:mb-4">KUMANI</p>
          <div className="flex justify-center mb-5 sm:mb-7">
            <Logo size={96} priority className="sm:h-28 sm:w-28 h-24 w-24" />
          </div>
          <div className="inline-flex items-center gap-2 bg-[var(--gold)]/10 backdrop-blur px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium text-white mb-5 sm:mb-7 border border-[var(--gold)]/30">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--gold-bright)]" />
            {t('heroBadge')}
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white mb-5 sm:mb-7 leading-tight break-words">
            {t('heroTitle')}
            <span className="block bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] bg-clip-text text-transparent">{t('heroAccent')}</span>
          </h1>
          <p className="text-base sm:text-xl text-gray-300 mb-8 sm:mb-10 leading-relaxed max-w-2xl mx-auto">
            {t('heroDescription')}{' '}
            <strong className="text-white">{t('heroDescriptionStrong')}</strong>: {t('heroDescriptionEnd')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-10 sm:mb-14 justify-center">
            <Link
              href="/register"
              className="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 text-[var(--ink)] px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all shadow-xl hover:shadow-2xl hover:scale-105 flex items-center justify-center gap-2"
            >
              {t('heroCta')}
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
            <Link
              href="/login"
              className="bg-white/5 hover:bg-white/10 backdrop-blur text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all border border-white/15 flex items-center justify-center"
            >
              {t('login')}
            </Link>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-xl mx-auto">
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-white">10K+</div>
              <div className="text-xs sm:text-sm text-gray-400">{t('statActiveEntrepreneurs')}</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-[var(--gold-bright)]">49€</div>
              <div className="text-xs sm:text-sm text-gray-400">{t('statYearlyLabel')}</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-white">50+</div>
              <div className="text-xs sm:text-sm text-gray-400">{t('statCountriesLabel')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* 🤝 SEZIONE: CONDIVIDI KUMANI — volutamente minimale, niente
          linguaggio da "rete"/struttura in evidenza. */}
      <section className="py-12 sm:py-20 bg-black/20">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 max-w-5xl mx-auto">
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
          <div className="bg-white/[0.03] border border-[var(--gold)]/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-5xl mx-auto">
            <Shield className="w-8 h-8 text-[var(--gold-bright)] flex-shrink-0" />
            <p className="text-gray-200 text-sm sm:text-base leading-relaxed">
              <strong className="text-[var(--gold-bright)]">{t('communityTransparencyLead')}</strong> {t('communityTransparencyRest')}
            </p>
          </div>
        </div>
      </section>

      {/* 🛠️ SEZIONE: IL MARKETPLACE — raggruppato per categoria, come in
          dashboard, con tessere quadrate invece di schede lunghe. */}
      <section className="py-12 sm:py-20">
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

          <HomeToolsGrid />
        </div>
      </section>

      {/* 💳 SEZIONE: I PIANI — Base per tutti, Pro per i professionisti */}
      <section className="py-12 sm:py-20 bg-black/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 bg-[var(--gold)]/10 border border-[var(--gold)]/30 px-4 py-1.5 rounded-full text-sm font-medium text-[var(--gold-bright)] mb-4">
              <Wallet className="w-4 h-4" />
              {t('plansEyebrow')}
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 break-words">
              {t('plansTitle')} <span className="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] bg-clip-text text-transparent">{t('plansAccent')}</span>
            </h2>
            <p className="text-base sm:text-xl text-gray-300 max-w-3xl mx-auto">{t('plansDescription')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            <div className="flex flex-col rounded-3xl border border-[var(--gold)]/20 bg-white/[0.03] p-6 sm:p-8">
              <h3 className="text-xl font-bold text-white">{t('planBaseName')}</h3>
              <p className="mt-1 text-sm text-gray-400">{t('planBaseDescription')}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-white">49 €</span>
                <span className="text-gray-400">{t('planPerYear')}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {baseFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" /> {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--gold)]/40 bg-white/5 px-6 py-3 font-bold text-white transition-all hover:bg-white/10"
              >
                {t('planBaseCta')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="relative flex flex-col rounded-3xl border-2 border-[var(--gold)] bg-gradient-to-br from-[var(--gold)]/15 via-white/[0.04] to-transparent p-6 shadow-[0_18px_50px_rgba(199,154,59,0.2)] sm:p-8">
              <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--ink)] shadow">
                {t('planProBadge')}
              </span>
              <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                <Briefcase className="h-5 w-5 text-[var(--gold-bright)]" /> {t('planProName')}
              </h3>
              <p className="mt-1 text-sm text-gray-300">{t('planProDescription')}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-[var(--gold-bright)]">149 €</span>
                <span className="text-gray-400">{t('planPerYear')}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {proFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2.5 text-sm text-gray-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" /> {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/register?plan=pro"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-xl transition-all hover:brightness-110"
              >
                {t('planProCta')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-center text-xs text-gray-400">{t('planProTrialNote')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ☀️ OGGI IN COMMUNITY — Kumano del Giorno: fascia compatta dopo gli
          strumenti e prima dei vantaggi. Solo storie approvate e con
          consenso home esplicito; fallback curato sotto la soglia minima. */}
      <HomeKumanoDelGiorno />

      {/* 🎟️ SEZIONE: PROGRAMMA BONUS & COUPON */}
      <section className="py-12 sm:py-20 bg-black/20">
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
      </section>

      {/* Benefits Section */}
      <section className="py-12 sm:py-20">
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
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 bg-gradient-to-r from-[var(--ink)] via-[var(--ink-soft)] to-[var(--ink)] border-y border-[var(--gold)]/25">
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
      </section>

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
              <Link href="/privacy" className="hover:text-[var(--gold-bright)] transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-[var(--gold-bright)] transition-colors">{t('terms')}</Link>
              <Link href="/contact" className="hover:text-[var(--gold-bright)] transition-colors">{t('contact')}</Link>
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
