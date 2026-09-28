import { getTranslations } from 'next-intl/server'
import { EyeOff } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'

// Pagina pubblica che esiste ma non è visibile: link in bio o CV di chi non
// ha più il piano, ricevuta scaduta da oltre 12 mesi. I dati restano salvati
// e la pagina torna online quando il titolare rinnova.
export default async function PublicPageOffline({ kind }: { kind: 'profile' | 'receipt' }) {
  const t = await getTranslations('common')
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-[var(--gold)]/25 bg-white p-8 text-center shadow-sm">
        <Logo size={44} className="mx-auto h-11 w-11" />
        <EyeOff className="mx-auto mt-6 h-10 w-10 text-[var(--gold)]" />
        <h1 className="mt-4 text-xl font-bold text-[var(--ink)]">
          {kind === 'receipt' ? t('publicOfflineReceiptTitle') : t('publicOfflineProfileTitle')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {kind === 'receipt' ? t('publicOfflineReceiptText') : t('publicOfflineProfileText')}
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[var(--gold)] hover:underline">
          KUMANI
        </Link>
      </div>
    </div>
  )
}
