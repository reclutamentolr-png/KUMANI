import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ArrowLeft, CheckCircle2, Info, Send, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import CheckoutForm from '@/components/billing/CheckoutForm'
import SurpriseEditor from '@/components/surprise/SurpriseEditor'
import SurpriseShare from '@/components/surprise/SurpriseShare'
import { createClient } from '@/lib/supabase/server'
import { getCheckoutTexts } from '@/lib/checkoutTexts'
import { SITE_URL } from '@/lib/siteUrl'
import { confirmSurpriseSession, getSurprisePrices } from '@/lib/surpriseServer'
import { surpriseDays, surprisePath, voucherUnlockAt, type SurpriseRow, type SurpriseStepRow } from '@/lib/surprise'

// Editor di una sorpresa: contenuto, anteprima, pagamento (bozza) oppure
// invio del link (attiva).
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

const ERRORS = ['notFound', 'alreadyActive', 'incomplete', 'business', 'vat', 'consent', 'terms', 'payment'] as const

export default async function SurpriseEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ paid?: string; session_id?: string; canceled?: string; error?: string }>
}) {
  const { locale, id } = await params
  const sp = await searchParams
  setRequestLocale(locale)
  const prefix = locale === 'it' ? '' : `/${locale}`
  const t = await getTranslations('surprise')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`${prefix}/login?next=/sorprese/${id}`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  // Ritorno dal pagamento: attivazione anche se il webhook non è ancora arrivato
  if (sp.paid && sp.session_id) await confirmSurpriseSession(sp.session_id, user.id)

  const { data: gift } = await supabase.from('surprise_gifts').select('*').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!gift) notFound()
  const { data: steps } = await supabase.from('surprise_steps').select('id, day, position, title, message, hint, media_path, media_type').eq('gift_id', id)
  const paths = [gift.cover_path, ...(steps ?? []).map((s) => s.media_path)].filter(Boolean) as string[]
  const { data: signed } = paths.length ? await supabase.storage.from('surprise-media').createSignedUrls(paths, 3600) : { data: [] }
  const mediaUrls = Object.fromEntries((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]))
  const prices = await getSurprisePrices()
  const row = gift as SurpriseRow
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const error = ERRORS.find((e) => e === sp.error)
  const ready = !!row.title.trim() && !!row.recipient_name.trim()
  const checkoutTexts = { ...(await getCheckoutTexts(locale)), consentLabel: t('consentLabel'), consentHint: t('consentHint') }
  const url = row.public_token ? `${SITE_URL}${prefix}${surprisePath(row.public_token)}` : null

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link href="/sorprese" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          <ArrowLeft className="h-4 w-4" /> {t('back')}
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-[var(--ink)] sm:text-3xl">
          <Sparkles className="h-7 w-7 text-[var(--gold)]" /> {row.title || t('untitled')}
        </h1>

        {sp.paid && row.status === 'active' && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
            <CheckCircle2 className="h-5 w-5" /> {t('paidOk')}
          </p>
        )}
        {sp.canceled && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{t('canceled')}</p>}

        {row.status === 'active' && url && (
          <section className="mt-5 rounded-2xl border-2 border-[var(--gold)]/50 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
              <Send className="h-5 w-5 text-[var(--gold)]" /> {t('shareTitle')}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {row.refunded_at
                ? t('status_refunded')
                : row.opened_at
                  ? t('openedAt', { name: row.recipient_name, date: when(row.opened_at) })
                  : t('notOpened')}
              {row.start_at && row.kind !== 'voucher' ? ` · ${t('startsAt', { date: when(row.start_at) })}` : ''}
              {row.start_at && row.kind !== 'voucher' ? ` · ${t('endsAt', { date: when(voucherUnlockAt(row.start_at, row.kind).toISOString()), days: surpriseDays(row.kind) })}` : ''}
            </p>
            {!row.refunded_at && (
              <div className="mt-4">
                <SurpriseShare url={url} recipientName={row.recipient_name} />
              </div>
            )}
          </section>
        )}

        <div className="mt-6">
          <SurpriseEditor userId={user.id} gift={row} steps={(steps ?? []) as SurpriseStepRow[]} mediaUrls={mediaUrls} prices={prices} />
        </div>

        {row.status === 'draft' && (
          <section id="pay" className="mt-6 scroll-mt-6 rounded-2xl border-2 border-[var(--gold)]/50 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--ink)]">{t('payTitle')}</h2>
            <p className="mt-1 text-sm text-gray-600">{t('payText')}</p>
            {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{t(`error_${error}`)}</p>}
            {!ready ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> {t('payNeeds')}
              </p>
            ) : (
              <div className="mt-4">
                <p className="mb-3 text-sm text-gray-700">
                  {t('payFor', { kind: t(`kind_${row.kind}`) })} <strong className="text-lg text-[var(--ink)]">{money(prices[row.kind])}</strong>
                </p>
                <CheckoutForm action={`/api/checkout/surprise?id=${row.id}`} texts={checkoutTexts}>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] shadow"
                  >
                    <Sparkles className="h-5 w-5" /> {t('payButton', { price: money(prices[row.kind]) })}
                  </button>
                </CheckoutForm>
                <p className="mt-2 text-xs text-gray-500">{t('saveBeforePay')}</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
