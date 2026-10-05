import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowUpRight, CalendarClock, CheckCircle2, Gift, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import GiftRedeemButton from '@/components/gifts/GiftRedeemButton'
import { createClient } from '@/lib/supabase/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { giftItemName } from '@/lib/giftsServer'
import { GIFT_CODE_RE, giftInfoPath, giftPath, normalizeGiftCode, type GiftCodeInfo } from '@/lib/gifts'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Pagina del regalo (link mandato da chi ha comprato): cosa contiene, chi lo
// regala e come attivarlo. Chi non ha un account si iscrive dal link (con
// il codice invito di chi regala) e il regalo si attiva a iscrizione
// completata; chi ha già un account accede e lo attiva qui.
export default async function GiftPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params
  const code = normalizeGiftCode(decodeURIComponent(raw))
  const t = await getTranslations('gifts')
  const tm = await getTranslations('marketplace')
  const locale = await getLocale()
  const supabase = await createClient()
  const [{ data }, { data: auth }] = await Promise.all([
    GIFT_CODE_RE.test(code) ? supabase.rpc('gift_code_info', { p_code: code }) : Promise.resolve({ data: { status: 'not_found' } }),
    supabase.auth.getUser(),
  ])
  const info = (data ?? { status: 'not_found' }) as GiftCodeInfo
  const found = info.status !== 'not_found' && info.kind
  const item = found ? await giftItemName(locale, info.kind, info.tool, info.plan) : ''
  const tool = info.kind === 'pass' ? getMarketplaceTools((key) => tm(key)).find((entry) => entry.toolName === info.tool) : undefined
  const openHref = info.kind === 'pass' && tool ? tool.href : '/dashboard'
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '')
  const registerHref = `/register?gift=${encodeURIComponent(code)}${info.giver_referral ? `&sponsor=${encodeURIComponent(info.giver_referral)}` : ''}`

  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-10 text-white">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Logo size={40} className="h-10 w-10" />
          <span className="text-sm font-bold tracking-[0.3em] text-[var(--gold-bright)]">KUMANI</span>
        </Link>

        <div className="relative overflow-hidden rounded-3xl border border-[var(--gold)]/30 bg-white/[0.04] p-6 sm:p-8">
          <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--gold)]/15 blur-3xl" />
          <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] shadow-lg">
            <Gift className="h-8 w-8" strokeWidth={1.8} />
          </span>

          {!found ? (
            <>
              <h1 className="mt-5 text-center text-2xl font-bold">{t('notFoundTitle')}</h1>
              <p className="mt-2 text-center text-sm text-white/70">{t('notFoundText')}</p>
            </>
          ) : (
            <>
              <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
                {info.giver_name ? t('fromName', { name: info.giver_name }) : t('fromSomeone')}
              </p>
              <h1 className="mt-2 text-center text-2xl font-bold sm:text-3xl">{item}</h1>
              {info.message && <p className="mx-auto mt-4 max-w-sm text-center text-base italic leading-7 text-white/85">“{info.message}”</p>}

              <ul className="mt-6 space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" />
                  {info.kind === 'pass' ? (tool?.description ?? '') : t(info.plan === 'pro' ? 'planProText' : 'planBaseText')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" />
                  {t('noRenewal')}
                </li>
                {info.status === 'valid' && (
                  <li className="flex items-start gap-2">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" />
                    {t('redeemBy', { date: date(info.valid_until) })}
                  </li>
                )}
              </ul>
              <Link
                href={giftInfoPath(info.kind, info.tool)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold-bright)] underline underline-offset-4 hover:text-white"
              >
                {info.kind === 'pass' && tool ? t('learnMoreService', { service: tool.title }) : t('learnMorePlan')}
                <ArrowUpRight className="h-4 w-4" />
              </Link>

              {info.status === 'valid' ? (
                info.mine ? (
                  <div className="mt-6 rounded-xl bg-white/10 px-4 py-3 text-center text-sm">
                    {t('mineNote')}{' '}
                    <Link href="/regali" className="font-semibold text-[var(--gold-bright)] underline">
                      {t('mineLink')}
                    </Link>
                  </div>
                ) : auth.user ? (
                  <GiftRedeemButton code={code} openHref={openHref} />
                ) : (
                  <>
                    <Link
                      href={registerHref}
                      className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
                    >
                      {t('registerToRedeem')}
                    </Link>
                    <Link href={`/login?next=${encodeURIComponent(giftPath(code))}`} className="mt-3 block text-center text-sm text-white/70 hover:text-white">
                      {t('loginToRedeem')}
                    </Link>
                  </>
                )
              ) : info.status === 'redeemed' && info.redeemed_by_me ? (
                <div className="mt-6 space-y-3">
                  <p className="rounded-xl bg-emerald-500/15 px-4 py-3 text-center text-sm font-semibold text-emerald-200">{t('alreadyMine')}</p>
                  <Link href={openHref} className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]">
                    {t('openGift')}
                  </Link>
                </div>
              ) : (
                <p className="mt-6 rounded-xl bg-white/10 px-4 py-3 text-center text-sm">{t(`state_${info.status}`)}</p>
              )}
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs leading-5 text-white/40">{t('publicFootnote')}</p>
      </div>
    </div>
  )
}
