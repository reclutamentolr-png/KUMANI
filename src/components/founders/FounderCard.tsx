import { getTranslations } from 'next-intl/server'
import { Rocket } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { pushDb } from '@/lib/push'

// Home: «Sei tra i primi 50 (n°X)» con lo sconto del 100% applicato al
// Piano Base per 12 mesi e il collegamento alle condizioni della promozione.
export default async function FounderCard({ userId }: { userId: string }) {
  const db = pushDb()
  const { data: f } = await db.from('founder_members').select('number').eq('user_id', userId).maybeSingle()
  if (!f) return null
  const t = await getTranslations('founders')
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-[var(--gold)] bg-gradient-to-br from-[#2a2418] to-[var(--ink)] p-4 text-white shadow-lg">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
        <Rocket className="h-6 w-6" />
      </span>
      <div>
        <p className="font-extrabold text-[var(--gold-bright)]">{t('dashTitle', { n: f.number ?? 0 })}</p>
        <p className="mt-0.5 text-sm text-white/80">{t('dashText')}</p>
        <Link href="/terms#promo-lancio" className="mt-1 inline-block text-xs font-semibold text-[var(--gold-bright)] underline underline-offset-2">
          {t('dashTerms')}
        </Link>
      </div>
    </div>
  )
}
