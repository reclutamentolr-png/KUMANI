import { SITE_URL } from '@/lib/siteUrl'
import { notFound } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import VoucherPrintStudio from '@/components/voucherPrint/VoucherPrintStudio'
import VoucherCardShare from '@/components/voucherCard/VoucherCardShare'
import { getVoucherBatchCodes } from '@/app/actions/admin'

// Stampa di un lotto di voucher: scelta di grafica (3 versioni), frase e
// formato con anteprima, poi PDF per la tipografia o da stampare a casa.
// Solo i codici ancora disponibili; il QR apre la registrazione con il
// codice già inserito (/register?voucher=CODICE). Accesso solo admin
// (getVoucherBatchCodes verifica i permessi).
export default async function VoucherBatchPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const { batch, codes } = await getVoucherBatchCodes(id)
  if (!batch) notFound()

  const site = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/+$/, '')
  const available = codes.filter((c) => c.status === 'active').map((c) => c.code)
  const fileBase = `KUMANI_voucher_${batch.business_name.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}`

  return (
    <div className="min-h-screen bg-[var(--paper)] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
          ← Admin
        </Link>
        <div className="mb-6 mt-2">
          <h1 className="text-2xl font-bold text-[var(--ink)]">Stampa voucher · {batch.business_name}</h1>
          <p className="text-sm text-[var(--muted)]">
            Piano {batch.plan === 'pro' ? 'Pro' : 'Base'} · {available.length} voucher disponibili da stampare su {codes.length}
          </p>
        </div>
        <VoucherPrintStudio codes={available} plan={batch.plan === 'pro' ? 'pro' : 'base'} siteUrl={site} fileBase={fileBase} offeredByDefault={batch.business_name} admin />

        {/* Biglietto digitale da mandare su WhatsApp, voucher per voucher */}
        {available.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[var(--gold)]/30 bg-white p-5">
            <h2 className="text-lg font-bold text-[var(--ink)]">Biglietti da mandare</h2>
            <p className="text-sm text-[var(--muted)]">Per ogni voucher: grafica, frase, «per» e «da», poi il link per WhatsApp o l’immagine.</p>
            <ul className="mt-3 divide-y divide-gray-100">
              {available.map((code) => (
                <li key={code} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <code className="font-mono text-[var(--ink)]">{code}</code>
                  <VoucherCardShare code={code} plan={batch.plan === 'pro' ? 'pro' : 'base'} siteUrl={site} defaultFrom={batch.business_name} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
