import { getLocale, getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowRight, CheckCircle2, Crown, Hourglass, Sparkles, BadgeCheck, Gift, BookOpen, FolderOpen } from 'lucide-react'
import CopyButton from '@/components/CopyButton'
import VoucherActivationButton from '@/components/VoucherActivationButton'
import AffinityBadge from './AffinityBadge'
import HomeServices from './HomeServices'
import type { MyProfile } from '@/lib/myProfile'
import type { ServiceItem } from '@/lib/servicesCatalog'
import NativeShareButton from '@/components/NativeShareButton'

// Home: corta. In cima lo stato (KU Karma, abbonamento, codice invito), poi
// la fascia «Oggi», «In cosa possiamo darti una mano?», i servizi preferiti,
// gli usati di recente e un suggerimento, e le guide. Tutti i servizi sono nella pagina Servizi; rete, Kumano del Giorno
// e donazioni nella pagina Community (menu fisso in basso).
const TILE =
  'flex min-w-0 flex-col rounded-2xl border border-[var(--gold)]/30 bg-white p-3 shadow-[0_6px_18px_rgba(23,23,23,0.06)] transition-colors hover:border-[var(--gold)] sm:p-4'
const TILE_LABEL = 'flex items-center gap-1 text-[10px] font-bold uppercase tracking-normal sm:tracking-wide text-[var(--muted)] sm:text-xs'

export default async function DashboardTipo2({
  profile,
  shareUrl,
  services,
  favoriteToolNames,
  basePrice,
  proTrialDaysLeft = null,
  agenda = null,
  needs = null,
  wellness = null,
}: {
  profile: MyProfile | null
  shareUrl: string
  // Tutti i servizi accesi, con lo stato per l'utente (getServicesCatalog)
  services: ServiceItem[]
  favoriteToolNames: string[]
  // Prezzo del piano Base già formattato (es. "49 €")
  basePrice: string
  // Prova Pro in corso: il riquadro dell'abbonamento propone Pro come
  // scelta principale e il Base come alternativa.
  proTrialDaysLeft?: number | null
  // Fascia «Oggi» (agenda unica), già pronta dal server
  agenda?: React.ReactNode
  // «In cosa possiamo darti una mano?» in versione compatta
  needs?: React.ReactNode
  // «Il tuo benessere di oggi», già pronto dal server
  wellness?: React.ReactNode
}) {
  const t = await getTranslations('dashboard')
  const guidesT = await getTranslations('guides')
  const docsT = await getTranslations('documents')
  const hubT = await getTranslations('hub')
  const locale = await getLocale()
  const subscribed = profile?.subscription_status === 'active'

  return (
    <>
      {/* Riga di stato compatta: KU Karma, abbonamento e codice invito */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Link href="/wallet" data-tour="points" className={TILE}>
          <span className={TILE_LABEL}>
            <Sparkles className="hidden h-3.5 w-3.5 shrink-0 text-[var(--gold)] sm:block" /> <span className="truncate">{t('kuPointsLabel')}</span>
          </span>
          <span className="mt-1 text-2xl font-extrabold leading-none text-[var(--ink)] sm:text-3xl">{profile?.daily_points || 0}</span>
          <span className="mt-auto pt-1.5 text-[11px] font-semibold text-[var(--gold)]">{hubT('stripWallet')}</span>
        </Link>

        <Link href={subscribed ? '/billing' : proTrialDaysLeft !== null ? '/pro' : '/billing'} className={TILE}>
          <span className={TILE_LABEL}>
            <BadgeCheck className="hidden h-3.5 w-3.5 shrink-0 text-[var(--gold)] sm:block" /> <span className="truncate">{hubT('stripPlan')}</span>
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
              <span className="mt-auto pt-1.5 text-[11px] font-semibold text-[var(--gold)]">{hubT('stripActivate')} →</span>
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

      {/* Senza abbonamento né prova: abbonarsi o usare un voucher */}
      {!subscribed && proTrialDaysLeft === null && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            href="/billing"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--ink-soft)]"
          >
            <Crown className="h-4 w-4 text-[var(--gold-bright)]" /> {t('subscribeNow', { price: basePrice })}
          </Link>
          <VoucherActivationButton />
        </div>
      )}

      {/* Subito dopo lo stato: oggi e poi «In cosa possiamo darti una mano?» */}
      {agenda}

      {needs}

      <HomeServices items={services} favorites={favoriteToolNames} />

      {wellness}

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
  )
}
