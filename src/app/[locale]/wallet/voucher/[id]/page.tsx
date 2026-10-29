import { redirect } from 'next/navigation'

// Qui c'era la ricevuta di cessione di un voucher: i voucher non si vendono
// più (si usano o si regalano), quindi il vecchio link porta al Wallet. La
// stampa del voucher resta in /wallet/voucher/[id]/stampa.
export default async function VoucherReceiptPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/wallet`)
}
