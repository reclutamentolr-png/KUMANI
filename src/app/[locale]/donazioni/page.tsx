import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, HandCoins, HeartHandshake, Landmark, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getPublicDonationSummary } from '@/lib/donationsPublic'
import { euroFormat } from '@/lib/donationTypes'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('donations')
  return { title: t('pageTitle'), description: t('pageIntro') }
}

// Pagina pubblica delle donazioni: quanto è stato raccolto e versato, a chi,
// come funziona e l'elenco dei versamenti. Trasparenza per tutti.
export default async function DonationsPage() {
  const t = await getTranslations('donations')
  const locale = await getLocale()
  const summary = await getPublicDonationSummary()
  const eur = (cents: number) => euroFormat(locale, cents)
  const active = summary?.active ?? null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] hover:text-white">
            <ArrowLeft className="h-4 w-4" /> KUMANI
          </Link>
          <span className="flex items-center gap-2 font-semibold text-white">
            <HeartHandshake className="h-5 w-5 text-[var(--gold-bright)]" /> {t('sectionTitle')}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">{t('pageTitle')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-[var(--muted)]">{t('pageIntro')}</p>
        </div>

        {!summary || !active ? (
          <p className="rounded-2xl border border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/50 p-8 text-center text-[var(--ink)]">{t('comingSoon')}</p>
        ) : (
          <>
            {/* Contatore */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border-2 border-[var(--gold)] bg-gradient-to-br from-[#2a2418] to-[var(--ink)] p-6 text-center text-white shadow-lg sm:col-span-1">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('accruedLabel')}</p>
                <p className="mt-1 text-4xl font-extrabold">{eur(summary.accrued_cents)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--gold)]/30 bg-white p-6 text-center shadow-sm">
                <Landmark className="mx-auto h-6 w-6 text-[var(--gold)]" />
                <p className="mt-1 text-3xl font-bold text-[var(--ink)]">{eur(summary.paid_cents)}</p>
                <p className="text-xs text-[var(--muted)]">{t('paidLabel')}</p>
              </div>
              <div className="rounded-2xl border border-[var(--gold)]/30 bg-white p-6 text-center shadow-sm">
                <Users className="mx-auto h-6 w-6 text-[var(--gold)]" />
                <p className="mt-1 text-3xl font-bold text-[var(--ink)]">{summary.donors}</p>
                <p className="text-xs text-[var(--muted)]">{t('donorsLabel')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center text-sm">
              <p className="rounded-xl bg-white p-3 shadow-sm">
                <span className="block font-bold text-[var(--ink)]">{eur(summary.subscription_cents)}</span>
                <span className="text-[var(--muted)]">{t('fromSubscriptions')}</span>
              </p>
              <p className="rounded-xl bg-white p-3 shadow-sm">
                <span className="block font-bold text-[var(--ink)]">{eur(summary.points_cents)}</span>
                <span className="text-[var(--muted)]">{t('fromPoints')}</span>
              </p>
            </div>

            {/* Associazione */}
            <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('associationLabel')}</p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                {active.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={active.logo_url} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-gray-200 object-contain p-1" />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)]">
                    <HeartHandshake className="h-9 w-9 text-[var(--gold)]" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-bold text-[var(--ink)]">{active.name}</h2>
                  {active.tax_code && <p className="text-xs text-[var(--muted)]">{t('taxCode', { code: active.tax_code })}</p>}
                  {active.mission && <p className="mt-2 font-semibold text-[var(--gold)]">{active.mission}</p>}
                  {active.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{active.description}</p>}
                  {active.website && (
                    <a href={active.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                      {t('visitWebsite')} <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </section>

            {/* Come funziona */}
            <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[var(--ink)]">{t('howTitle')}</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {[
                  t('how1', { base: eur(summary.base_cents) }),
                  t('how2', { pro: eur(summary.pro_cents) }),
                  t('how3'),
                  t('how4'),
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {line}
                  </li>
                ))}
              </ul>
            </section>

            {/* Versamenti */}
            <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
                <HandCoins className="h-5 w-5 text-[var(--gold)]" /> {t('payoutsTitle')}
              </h2>
              {summary.payouts.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">{t('payoutsNone')}</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {summary.payouts.map((p, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <span>
                        <span className="font-semibold text-[var(--ink)]">{new Date(p.paid_on).toLocaleDateString(locale)}</span>
                        <span className="text-[var(--muted)]"> · {p.association}</span>
                        {p.reference && <span className="block text-xs text-[var(--muted)]">{t('payoutRef', { ref: p.reference })}</span>}
                      </span>
                      <span className="flex items-center gap-3">
                        {p.receipt_url && (
                          <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold)]">
                            <FileText className="h-3.5 w-3.5" /> {t('receipt')}
                          </a>
                        )}
                        <span className="font-bold text-[var(--ink)]">{eur(p.amount_cents)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {summary.associations.length > 1 && (
              <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-[var(--ink)]">{t('historyTitle')}</h2>
                <ul className="mt-3 divide-y divide-gray-100 text-sm">
                  {summary.associations.map((a) => (
                    <li key={a.name} className="flex flex-wrap justify-between gap-2 py-2">
                      <span className="font-semibold text-[var(--ink)]">{a.name}</span>
                      <span className="text-[var(--muted)]">
                        {eur(a.accrued_cents)} · {t('paidShort', { amount: eur(a.paid_cents) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="text-center">
              <Link href="/wallet" className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-6 py-3 font-bold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]">
                <HeartHandshake className="h-5 w-5" /> {t('donateCta')}
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
