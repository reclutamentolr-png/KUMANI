import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import HomeFormView from '@/components/casa/HomeFormView'

export const dynamic = 'force-dynamic'

export default async function NewHomePage() {
  const t = await getTranslations('casa')
  return (
    <div className="space-y-5">
      <Link href="/marketplace/casa" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" /> {t('backToCasa')}
      </Link>
      <h1 className="text-2xl font-bold text-[var(--ink)]">{t('newHomeTitle')}</h1>
      <HomeFormView />
    </div>
  )
}
