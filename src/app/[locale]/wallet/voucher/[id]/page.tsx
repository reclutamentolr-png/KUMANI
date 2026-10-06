import { redirect, notFound } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import VoucherReceipt from '@/components/VoucherReceipt'

export const dynamic = 'force-dynamic'

type SellerProfile = {
  first_name: string | null
  last_name: string | null
  tax_code: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  province: string | null
}

// Ricevuta di cessione di un voucher creato dal Kumano (vendita o regalo):
// il Kumano inserisce acquirente e prezzo e la stampa o salva in PDF.
// Solo per i propri voucher.
export default async function VoucherReceiptPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: voucher } = await service
    .from('subscription_vouchers')
    .select('id, code, status, plan, purpose, sale_price_cents, buyer_name, sold_at, created_at, cost_cents')
    .eq('id', id)
    .or(`created_by.eq.${user.id},holder_id.eq.${user.id}`)
    .maybeSingle()
  if (!voucher || voucher.status === 'revoked') notFound()

  const { data: seller } = await supabase.rpc('get_my_profile').maybeSingle<SellerProfile>()
  const sellerAddress = [seller?.address, [seller?.postal_code, seller?.city, seller?.province ? `(${seller.province})` : null].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')

  return (
    <VoucherReceipt
      voucher={{
        id: voucher.id,
        code: voucher.code,
        plan: voucher.plan === 'pro' ? 'pro' : 'base',
        priceCents: voucher.sale_price_cents,
        buyerName: voucher.buyer_name,
        soldAt: voucher.sold_at ?? voucher.created_at,
        maxCents: voucher.cost_cents,
      }}
      seller={{
        name: `${seller?.first_name ?? ''} ${seller?.last_name ?? ''}`.trim(),
        taxCode: seller?.tax_code ?? null,
        address: sellerAddress || null,
      }}
    />
  )
}
