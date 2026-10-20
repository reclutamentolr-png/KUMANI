import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import VoucherCardView from '@/components/voucherCard/VoucherCardView'
import { createClient } from '@/lib/supabase/server'
import { CARD_CODE_RE, readCardOptions } from '@/lib/voucherCard'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Biglietto di un voucher Base o Pro (link mandato da chi lo regala): la
// grafica scelta, la frase, «per» e «da» (nel link) e l'attivazione. Lo stato
// del voucher si legge sul server: al browser arrivano solo piano e stato.
export default async function VoucherCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; code: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ locale, code: raw }, sp] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const code = decodeURIComponent(raw).trim().toUpperCase()
  if (!CARD_CODE_RE.test(code)) notFound()

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: voucher } = await db
    .from('subscription_vouchers')
    .select('status, plan, voucher_batches(plan)')
    .eq('code', code)
    .maybeSingle<{ status: string; plan: string | null; voucher_batches: { plan: string | null } | null }>()
  if (!voucher || !['active', 'redeemed'].includes(voucher.status)) notFound()
  const plan = (voucher.plan ?? voucher.voucher_batches?.plan) === 'pro' ? 'pro' : 'base'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const o = readCardOptions(sp)
  const tp = await getTranslations('voucherPrint')
  const phrase = o.phrase === 'custom' ? o.custom || tp('phrases.p2') : tp(`phrases.${o.phrase}`)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_20%,#1f1b13_0%,#0b0b0b_65%)] px-4 pb-16 pt-6">
      <header className="mx-auto mb-6 flex max-w-md justify-center">
        <Link href="/" aria-label="KUMANI">
          <Logo size={56} />
        </Link>
      </header>
      <VoucherCardView
        code={code}
        plan={plan}
        status={voucher.status === 'active' ? 'active' : 'used'}
        design={o.design}
        phrase={phrase}
        to={o.to}
        from={o.from}
        loggedIn={!!user}
        texts={{
          voucher: tp('card.voucher'),
          gift: tp('card.gift'),
          oneYear: tp('card.oneYear'),
          planLine: tp(plan === 'pro' ? 'card.planPro' : 'card.planBase'),
          codeLabel: tp('card.codeLabel'),
          codeShort: tp('card.codeShort'),
          howToLong: '',
          howToShort: '',
          scan: '',
        }}
      />
    </div>
  )
}
