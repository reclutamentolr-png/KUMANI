import { SITE_URL } from '@/lib/siteUrl'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import QRCode from 'qrcode'
import Logo from '@/components/Logo'
import PrintButton from '@/components/admin/PrintButton'
import { getVoucherBatchCodes } from '@/app/actions/admin'

// Cartoncini stampabili di un lotto di coupon per negozianti: un
// cartoncino per ogni codice ancora disponibile, con QR che apre la
// registrazione con il codice già inserito (/register?voucher=CODICE).
// Accesso solo admin (getVoucherBatchCodes verifica i permessi).
export default async function VoucherBatchPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const { batch, codes } = await getVoucherBatchCodes(id)
  if (!batch) notFound()
  const t = await getTranslations('voucherCard')

  const site = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/+$/, '')
  const available = codes.filter((c) => c.status === 'active')
  const cards = await Promise.all(
    available.map(async (c) => ({
      code: c.code,
      qr: await QRCode.toDataURL(`${site}/register?voucher=${encodeURIComponent(c.code)}`, { width: 240, margin: 1 }),
    }))
  )

  return (
    <div className="min-h-screen bg-white p-6 print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{batch.business_name}</h1>
          <p className="text-sm text-gray-500">{t('adminSummary', { available: available.length, total: codes.length })}</p>
        </div>
        <PrintButton label={t('print')} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
        {cards.map((card) => (
          <div
            key={card.code}
            className="flex break-inside-avoid items-center gap-4 rounded-2xl border-2 border-dashed border-gray-300 p-4 print:rounded-none"
          >
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                <Logo size={28} className="h-7 w-7" />
                <span className="text-sm font-bold tracking-[0.25em] text-gray-900">KUMANI</span>
                {batch.plan === 'pro' && (
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-amber-300">PRO</span>
                )}
              </div>
              <p className="text-lg font-bold leading-tight text-gray-900">{t(batch.plan === 'pro' ? 'titlePro' : 'title')}</p>
              <p className="mt-0.5 text-xs text-gray-600">{t('offeredBy', { business: batch.business_name })}</p>
              <p className="mt-3 text-[10px] uppercase tracking-wider text-gray-500">{t('codeLabel')}</p>
              <p className="font-mono text-base font-bold tracking-wider text-gray-900">{card.code}</p>
              <p className="mt-2 text-[10px] leading-snug text-gray-500">{t('howTo', { site: site.replace(/^https?:\/\//, '') })}</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.qr} alt="QR" className="h-28 w-28 flex-shrink-0" />
          </div>
        ))}
      </div>
      {cards.length === 0 && <p className="text-sm text-gray-500">{t('noneAvailable')}</p>}
    </div>
  )
}
