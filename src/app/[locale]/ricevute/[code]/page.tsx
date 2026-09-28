import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { ReceiptTemplate } from '@/lib/digitalReceipt'
import DigitalReceiptPublicView from '@/components/DigitalReceiptPublicView'
import PublicPageOffline from '@/components/PublicPageOffline'

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
}

export default async function DigitalReceiptPublicPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

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

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <DigitalReceiptPublicView receipt={{ ...data, photo_url: photoUrl }} />
    </div>
  )
}
