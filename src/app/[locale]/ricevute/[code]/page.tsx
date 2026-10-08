import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { ReceiptTemplate } from '@/lib/digitalReceipt'
import DigitalReceiptPublicView from '@/components/DigitalReceiptPublicView'
import PublicPageOffline from '@/components/PublicPageOffline'
import ReceiptSpendlyBox from '@/components/ecosystem/ReceiptSpendlyBox'
import type { ReceiptSpendlyStatus } from '@/app/actions/ecosystem'
import ReceiptSaveBox from '@/components/receipts/ReceiptSaveBox'
import DigitalReceiptPdfButton from '@/components/DigitalReceiptPdfButton'
import { SITE_URL } from '@/lib/siteUrl'
import { defaultLocale } from '../../../../../i18n'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

interface PublicReceiptRow {
  code: string
  template: ReceiptTemplate
  object_name: string
  serial_number: string | null
  recipient_name: string
  delivery_date: string
  reason: string | null
  notes: string | null
  quantity: number | null
  declared_value: number | null
  expected_return_date: string | null
  photo_path: string | null
  confirmed_at: string | null
  returned_at: string | null
  vat_mode: string | null
  issuer_company: string | null
  issuer_vat: string | null
  issuer_address: string | null
  issuer_city: string | null
  issuer_postal_code: string | null
  issuer_province: string | null
  issuer_phone: string | null
  issuer_email: string | null
  issuer_logo_path: string | null
  created_at: string
  saved_by_me: boolean | null
  can_save: boolean | null
}

export default async function DigitalReceiptPublicPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>
}) {
  const { locale, code } = await params

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('get_digital_receipt_by_code', { p_code: code })
    .single<PublicReceiptRow>()

  if (error || !data) {
    // Esiste ma è scaduta (oltre 12 mesi dalla fine del piano del titolare)
    const { data: status } = await supabase.rpc('public_page_status', { p_kind: 'receipt', p_code: code })
    if (status === 'offline') return <PublicPageOffline kind="receipt" />
    notFound()
  }

  const photoUrl = data.photo_path
    ? supabase.storage.from('receipt-photos-v2').getPublicUrl(data.photo_path).data.publicUrl
    : null

  // Ricevuta con un importo pagato: chi ha l'accesso la segna in Spendly
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const hasPayment = (data.declared_value ?? 0) > 0 && (data.template === 'private_sale' || data.template === 'declared_payment')
  let spendly: ReceiptSpendlyStatus = 'no_value'
  if (hasPayment) {
    spendly = user ? (((await supabase.rpc('receipt_spendly_status', { p_code: code })).data as ReceiptSpendlyStatus | null) ?? 'no_value') : 'login'
  }

  // Chi non ha un account si registra con l'invito di chi ha emesso la ricevuta
  let signupHref = '/register'
  if (!user) {
    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: owner } = await service.from('digital_receipts').select('user_id').eq('code', code).maybeSingle()
    if (owner?.user_id) {
      const { data: issuerProfile } = await service
        .from('profiles')
        .select('referral_code, is_admin, guest_until')
        .eq('id', owner.user_id)
        .maybeSingle<{ referral_code: string | null; is_admin: boolean; guest_until: string | null }>()
      if (issuerProfile?.referral_code && !issuerProfile.is_admin && !issuerProfile.guest_until) {
        signupHref = `/register?sponsor=${encodeURIComponent(issuerProfile.referral_code)}`
      }
    }
  }

  const issuerLogoUrl = data.issuer_logo_path ? supabase.storage.from('quote-logos-v2').getPublicUrl(data.issuer_logo_path).data.publicUrl : null
  const loginHref = `/login?next=/ricevute/${code}`
  // Chi l'ha salvata nel proprio account (anche Free) scarica il PDF
  const savedByMe = data.saved_by_me === true
  const receiptUrl = locale === defaultLocale ? `${SITE_URL}/ricevute/${data.code}` : `${SITE_URL}/${locale}/ricevute/${data.code}`
  const hasIssuer = !!(data.issuer_company || data.issuer_logo_path)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <DigitalReceiptPublicView receipt={{ ...data, photo_url: photoUrl, issuer_logo_url: issuerLogoUrl }} />
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pb-12 sm:px-6">
        <ReceiptSaveBox code={code} savedByMe={savedByMe} canSave={data.can_save === true} loggedIn={!!user} signupHref={signupHref} loginHref={loginHref} />
        {savedByMe && (
          <DigitalReceiptPdfButton
            receipt={{ ...data, show_issuer: hasIssuer }}
            receiptUrl={receiptUrl}
            photoUrl={photoUrl}
            issuedByName=""
            issuer={
              hasIssuer
                ? {
                    company_name: data.issuer_company,
                    vat_number: data.issuer_vat,
                    address: data.issuer_address,
                    city: data.issuer_city,
                    postal_code: data.issuer_postal_code,
                    province: data.issuer_province,
                    phone: data.issuer_phone,
                    email: data.issuer_email,
                  }
                : null
            }
            issuerLogoUrl={issuerLogoUrl}
          />
        )}
        {/* Senza account la registrazione passa dal riquadro «Salvala gratis» */}
        {spendly !== 'no_value' && spendly !== 'login' && (
          <ReceiptSpendlyBox code={code} initialStatus={spendly} loginHref={loginHref} signupHref={signupHref} />
        )}
      </div>
    </div>
  )
}
