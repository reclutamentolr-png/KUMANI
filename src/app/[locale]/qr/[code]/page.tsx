import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import Logo from '@/components/Logo'
import QrMultiView from '@/components/qrPro/QrMultiView'
import type { MultiDestination } from '@/lib/qrPro'

// Pagina «Più contatti» di un QR Code PRO: ci arriva chi inquadra il QR
// (/q/<codice> conta la scansione e porta qui). Solo codici attivi; fuori dai
// motori di ricerca.
export const dynamic = 'force-dynamic'

async function load(code: string): Promise<MultiDestination | null> {
  const supabase = await createClient()
  const { data } = (await supabase.rpc('get_qr_pro_destination', { p_code: code }).single()) as {
    data: { content_type: string; destination: MultiDestination } | null
  }
  return data?.content_type === 'multi' ? data.destination : null
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const destination = await load((await params).code)
  return { title: destination?.title || 'KUMANI', robots: { index: false, follow: false } }
}

export default async function QrMultiPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const destination = await load(code)
  if (!destination) {
    const locale = await getLocale()
    redirect(locale === 'it' ? '/qr-non-attivo' : `/${locale}/qr-non-attivo`)
  }
  return (
    <main className="min-h-screen bg-[var(--background)] bg-[radial-gradient(circle_at_50%_0%,rgba(199,154,59,0.16),transparent_45%)] px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size={56} dark />
        </div>
        <div className="rounded-3xl border border-[var(--gold)]/30 bg-[var(--paper)] p-5 shadow-[0_20px_55px_rgba(23,23,23,0.12)] sm:p-7">
          <QrMultiView destination={destination} code={code} />
        </div>
      </div>
    </main>
  )
}
