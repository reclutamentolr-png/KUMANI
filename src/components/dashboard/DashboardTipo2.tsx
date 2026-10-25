import { getLocale, getTranslations } from 'next-intl/server'
import { getPlansGate } from '@/lib/plansGate'
import Link from '@/components/LocalizedLink'
import { ArrowRight, CheckCircle2, Crown, Hourglass, Sparkles, BadgeCheck, Gift, BookOpen, FolderOpen } from 'lucide-react'
import CopyButton from '@/components/CopyButton'
import VoucherActivationButton from '@/components/VoucherActivationButton'
import AffinityBadge from './AffinityBadge'
import HomeServices from './HomeServices'
import type { CommunityItem } from './CommunityBlock'
import type { MyProfile } from '@/lib/myProfile'
import type { ServiceItem } from '@/lib/servicesCatalog'
import type { KarmaToday } from '@/lib/karmaToday'
import NativeShareButton from '@/components/NativeShareButton'
import QuickCheckBox from '@/components/ecosystem/QuickCheckBox'
import KarmaInfoButton from './KarmaInfoButton'
import HomeViewSwitch from './HomeViewSwitch'
import NeedSearch from './NeedSearch'
import type { HomeView } from '@/lib/homeView'

// Home: corta. In cima lo stato (KU Karma, abbonamento, codice invito), poi
// la fascia «Oggi» e «In cosa possiamo darti una mano?», gli inviti, l'Area
// Professionisti e la Sorpresa, i servizi preferiti, gli usati di recente e
// un suggerimento, e le guide. Tutti i servizi sono nella pagina Servizi; rete, Kumano del Giorno
// e donazioni nella pagina Community (menu fisso in basso).
const TILE =
  'flex min-w-0 flex-col rounded-2xl border border-[var(--gold)]/30 bg-white p-3 shadow-[0_6px_18px_rgba(23,23,23,0.06)] transition-colors hover:border-[var(--gold)] sm:p-4'
const TILE_LABEL = 'flex items-center gap-1 text-[10px] font-bold uppercase tracking-normal sm:tracking-wide text-[var(--muted)] sm:text-xs'

export default async function DashboardTipo2({
  profile,
  shareUrl,
  services,
  community = [],
  favoriteToolNames,
  basePrice,
  proTrialDaysLeft = null,
  agenda = null,
  needs = null,
  afterStatus = null,
  invites = null,
  proBlock = null,
  extras = null,
  welcome = null,
  welcomeFooter = null,
  solveEntry = null,
  view = 'full',
  iconHome = null,
  wellness = null,
  karmaToday = null,
  proPrice,
}: {
  profile: MyProfile | null
  shareUrl: string
  // Tutti i servizi accesi, con lo stato per l'utente (getServicesCatalog)
  services: ServiceItem[]
  // Vista Lite: la sezione Community dopo «Usati di recente»
  community?: CommunityItem[]
  favoriteToolNames: string[]
  // Prezzo del piano Plus già formattato (es. "49 €")
  basePrice: string
  // Prova Pro in corso: il riquadro dell'abbonamento propone Pro come
  // scelta principale e il Plus come alternativa.
  proTrialDaysLeft?: number | null
  // Fascia «Oggi» (agenda unica), già pronta dal server
  agenda?: React.ReactNode
  // «In cosa possiamo darti una mano?» in versione compatta
  needs?: React.ReactNode
  // Messaggi da leggere: subito sotto la riga di stato
  afterStatus?: React.ReactNode
  // Inviti (chi ti ha invitato, Kumano verificato, notifiche, recensione)
  invites?: React.ReactNode
  // Area Professionisti (Pro) oppure l'invito a provare il Pro
  proBlock?: React.ReactNode
  // KUMANI Sorpresa e simili, in fondo
  extras?: React.ReactNode
  // Home di benvenuto (nuovi iscritti Gratis): al posto del resto della pagina
  welcome?: React.ReactNode
  // «Mostra la Home completa», in fondo alla Home di benvenuto
  welcomeFooter?: React.ReactNode
  // «Hai un problema? Risolviamolo insieme» (KUMANI Risolvi), nella Lite
  solveEntry?: React.ReactNode
  // Vista della Home: Lite (l'essenziale), Completa o Icone
  view?: HomeView
  // Home a icone, già pronta dalla pagina
  iconHome?: React.ReactNode
  // Prezzo del Pro già formattato, per «Passa a Pro»
  proPrice?: string
  // «Il tuo benessere di oggi», già pronto dal server
  wellness?: React.ReactNode
  // KU Karma presi oggi: accesso e servizi usati (getKarmaToday)
  karmaToday?: KarmaToday | null
}) {
  const t = await getTranslations('dashboard')
  const guidesT = await getTranslations('guides')
  const docsT = await getTranslations('documents')
  const hubT = await getTranslations('hub')
  const locale = await getLocale()
  // Piani non ancora aperti: «Abbonati dal 15 novembre» al posto di «Abbonati ora»
  const gate = await getPlansGate()
  const gateDay = gate.closed ? new Date(gate.openDate + 'T00:00:00Z') : null
  const gateDate = gateDay ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(gateDay) : null
  // In italiano «dall'8» e «dall'11»
  const gateVowel = !!gateDay && locale === 'it' && [8, 11].includes(gateDay.getUTCDate())
  const subscribed = profile?.subscription_status === 'active'
  // Testi della spiegazione «Cosa sono i KU Karma?»
  const karmaInfoTexts = {
    button: t('karmaInfoButton'),
    title: t('karmaInfoTitle'),
    intro: t('karmaInfoIntro'),
    earnTitle: t('karmaInfoEarnTitle'),
    earn: [t('karmaInfoEarn1'), t('karmaInfoEarn2'), t('karmaInfoEarn3')],
    useTitle: t('karmaInfoUseTitle'),
    use: t('karmaInfoUse'),
    pointsNote: t('karmaInfoPointsNote'),
    wallet: hubT('stripWallet'),
    close: t('karmaInfoClose'),
  }
  const planName = subscribed ? (profile?.subscription_plan === 'pro' ? 'Pro' : 'Plus') : proTrialDaysLeft !== null ? 'Pro' : null
  // Plus, Pro o prova Pro in corso
  const withPlan = subscribed || proTrialDaysLeft !== null
  const isProPlan = (subscribed && profile?.subscription_plan === 'pro') || proTrialDaysLeft !== null
  // Pro pagato: niente da comprare né da attivare (voucher e regali dei piani
  // risultano «già abbonato», i Pass sono inclusi), la riga non serve
  const paidPro = subscribed && profile?.subscription_plan === 'pro'
  const ctaRow = paidPro ? null : (
    <div className={`grid gap-2 ${isProPlan ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {!withPlan ? (
        <Link
          href="/billing"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--ink)] px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-[var(--ink-soft)]"
        >
          <Crown className="h-4 w-4 shrink-0 text-[var(--gold-bright)]" /> {gateDate ? t(gateVowel ? 'subscribeFromVowel' : 'subscribeFrom', { date: gateDate }) : t('subscribeNow', { price: basePrice })}
        </Link>
      ) : (
        !isProPlan && (
          <Link
            href="/pro"
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-3 py-2.5 text-center text-sm font-bold text-[var(--ink)] hover:brightness-105"
          >
            <Crown className="h-4 w-4 shrink-0" /> {proPrice ? t('upgradeToProPrice', { price: proPrice }) : t('upgradeToPro')}
          </Link>
        )
      )}
      <VoucherActivationButton className="flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--gold)]/50 bg-white px-3 py-2.5 text-center text-sm font-bold text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)]" />
    </div>
  )

  // Vista a icone: solo le icone (abbonarsi e codice sono nel Wallet e nel profilo)
  if (view === 'icons')
    return (
      <>
        <HomeViewSwitch key={view} current={view} />
        {afterStatus}
        {iconHome}
      </>
    )

  return (
    <>
      {/* Lite · Completa · Icone */}
      <HomeViewSwitch key={view} current={view} />

      {/* Nuovi iscritti: «Per cosa sei qui?» e i primi passi subito in cima,
          prima di abbonamento e riga di stato (sul telefono si vede appena entrati) */}
      {view === 'lite' && welcome}

      {/* In cima: abbonarsi (o passare a Pro) e «Hai un codice?» */}
      {ctaRow}

      {/* Riga di stato compatta: KU Karma, abbonamento e codice invito */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Scheda non cliccabile: «Cosa sono?» spiega i KU Karma, solo «Vai al Wallet» porta al Wallet */}
        <div data-tour="points" className={TILE}>
          <span className="flex items-center justify-between gap-1">
            <span className={`${TILE_LABEL} min-w-0`}>
              <Sparkles className="hidden h-3.5 w-3.5 shrink-0 text-[var(--gold)] sm:block" /> <span className="truncate">{t('kuPointsLabel')}</span>
            </span>
            <KarmaInfoButton variant="text" texts={karmaInfoTexts} />
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-extrabold leading-none text-[var(--ink)] sm:text-3xl">{profile?.daily_points || 0}</span>
            <KarmaInfoButton variant="icon" texts={karmaInfoTexts} />
          </span>
          {!!karmaToday?.total && <span className="mt-1 text-[11px] font-bold text-emerald-700">{t('karmaTodayBadge', { n: karmaToday.total })}</span>}
          <Link href="/wallet" className="mt-auto inline-flex items-center gap-0.5 self-start pt-1.5 text-[11px] font-semibold text-[var(--gold)] underline-offset-2 hover:text-[var(--ink)] hover:underline">
            {hubT('stripWallet')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <Link href={subscribed ? '/billing' : proTrialDaysLeft !== null ? '/pro' : '/billing'} className={TILE}>
          <span className={TILE_LABEL}>
            <BadgeCheck className="hidden h-3.5 w-3.5 shrink-0 text-[var(--gold)] sm:block" />{' '}
            <span className="truncate">
              {hubT('stripPlan')}
              {/* Tipo di piano accanto al titolo (Plus o Pro; in prova è il Pro) */}
              {planName && <span className="text-[var(--gold)]"> {planName}</span>}
            </span>
          </span>
          {subscribed ? (
            <>
              <span className="mt-1 flex items-center gap-1 text-base font-extrabold text-emerald-700 sm:text-lg">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> {t('subscriptionActive')}
              </span>
              {profile?.subscription_expires_at && (
                <span className="mt-auto pt-1.5 text-[11px] text-[var(--muted)]">
                  {hubT('stripUntil', { date: new Date(profile.subscription_expires_at).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' }) })}
                </span>
              )}
            </>
          ) : proTrialDaysLeft !== null ? (
            <>
              <span className="mt-1 flex items-center gap-1 text-base font-extrabold text-[var(--ink)] sm:text-lg">
                <Hourglass className="h-4 w-4 shrink-0 text-[var(--gold)]" /> Pro
              </span>
              <span className="mt-auto pt-1.5 text-[11px] text-[var(--muted)]">{hubT('stripTrialDays', { days: proTrialDaysLeft })}</span>
            </>
          ) : (
            <>
              <span className="mt-1 text-base font-extrabold text-[var(--ink)] sm:text-lg">{hubT('stripFree')}</span>
              <span className="mt-auto pt-1.5 text-[11px] font-semibold text-[var(--gold)]">{t('comparePlans')} →</span>
            </>
          )}
        </Link>

        <div data-tour="invite" className={TILE}>
          <span className={TILE_LABEL}>
            <Gift className="hidden h-3.5 w-3.5 shrink-0 text-[var(--gold)] sm:block" /> <span className="truncate">{hubT('stripInvite')}</span>
          </span>
          <span className="mt-1 truncate font-mono text-xs font-extrabold tracking-tight text-[var(--ink)] sm:text-lg">{profile?.referral_code}</span>
          <span className="mt-auto flex items-center gap-1.5 pt-1.5">
            <CopyButton text={shareUrl} variant="light" />
            <NativeShareButton url={shareUrl} title="KUMANI" variant="light" copyFallback={false} iconOnly />
          </span>
        </div>
      </div>

      {afterStatus}

      {/* «Scrivi cosa ti serve»: il bisogno con parole proprie → i servizi giusti */}
      <NeedSearch items={services.map((s) => ({ toolName: s.toolName, title: s.title, name: s.name, description: s.description, href: s.href, iconName: s.iconName, guide: s.guide }))} />

      {view === 'lite' ? (
        welcome ? (
          <>
            {/* Nuovi iscritti Gratis: domanda e tre passi sono già in cima, qui i servizi */}
            <HomeServices items={services} favorites={favoriteToolNames} community={community} />
            {wellness}
            {welcomeFooter}
          </>
        ) : (
          <>
            {/* Lite: solo l'essenziale, prima i servizi scelti */}
            <HomeServices items={services} favorites={favoriteToolNames} community={community} />
            <QuickCheckBox title={t('quickCheckTitle')} className="" />
            {solveEntry}
          </>
        )
      ) : withPlan ? (
        <>
          {/* Con un piano: prima la giornata («Oggi», porta al calendario) */}
          {agenda}
          <QuickCheckBox title={t('quickCheckTitle')} className="" />
          <HomeServices items={services} favorites={favoriteToolNames} />
          {/* «In cosa possiamo darti una mano?»: anche con un piano, dopo i propri servizi */}
          {needs}
          {invites}
          {proBlock}
          {wellness}
          {extras}
        </>
      ) : (
        <>
          {/* Gratis: prima il controllo anti-truffa, poi i servizi */}
          <QuickCheckBox title={t('quickCheckTitle')} className="" />
          <HomeServices items={services} favorites={favoriteToolNames} />
          {invites}
          {agenda ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
              {agenda}
              {needs}
            </div>
          ) : (
            needs
          )}
          {wellness}
          {proBlock}
          {extras}
        </>
      )}

      {view === 'full' && (
        <>
          {/* Novità di Affinity Amicizie (solo per chi partecipa) */}
          <AffinityBadge />

          {/* Guide e documenti */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/guida" className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/35 bg-[var(--gold-pale)] px-5 py-3.5 shadow-sm transition-colors hover:border-[var(--gold)]">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-white">
                  <BookOpen className="h-4.5 w-4.5" />
                </span>
                <span className="font-semibold text-[var(--ink)]">{guidesT('dashboardTitle')}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-[var(--ink)] transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/documenti" className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/35 bg-[var(--gold-pale)] px-5 py-3.5 shadow-sm transition-colors hover:border-[var(--gold)]">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-white">
                  <FolderOpen className="h-4.5 w-4.5" />
                </span>
                <span className="font-semibold text-[var(--ink)]">{docsT('title')}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-[var(--ink)] transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </>
      )}
    </>
  )
}
