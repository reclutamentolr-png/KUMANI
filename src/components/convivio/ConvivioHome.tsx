'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Plus, ShieldCheck, Store } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import VerificationSetup from '@/components/verification/VerificationSetup'
import { CONVIVIO_CATEGORIES, type ConvivioCard, type ConvivioLeaderStatus } from '@/lib/convivio'
import ConvivioCardItem from './ConvivioCardItem'
import ConvivioCreateForm from './ConvivioCreateForm'

// Convivio: cordate aperte e "le mie", filtro per categoria, "Proponi un
// Convivio" (con la verifica del capocordata quando serve).
export default function ConvivioHome({
  open,
  mine,
  leader,
  isPro,
}: {
  open: ConvivioCard[]
  mine: ConvivioCard[]
  leader: ConvivioLeaderStatus | null
  isPro: boolean
}) {
  const t = useTranslations('convivio')
  const locale = useLocale()
  const router = useRouter()
  const [tab, setTab] = useState<'open' | 'mine'>('open')
  const [category, setCategory] = useState<string>('all')
  const [sheet, setSheet] = useState<'setup' | 'create' | null>(null)
  const [now, setNow] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const list = (tab === 'open' ? open : mine).filter((c) => category === 'all' || c.category === category)

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl border border-[var(--gold)]/25 bg-white p-1">
          {(['open', 'mine'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
            >
              {t(key === 'open' ? 'tabOpen' : 'tabMine')} {key === 'mine' && mine.length > 0 ? `(${mine.length})` : ''}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
        {isPro && (
          <Link
            href="/marketplace/convivio/fornitore"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--gold)] px-4 py-2 font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
          >
            <Store className="h-5 w-5" /> {t('supplierArea')}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setSheet(leader?.verified ? 'create' : 'setup')}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 font-bold text-[var(--ink)] shadow-sm hover:brightness-105"
        >
          <Plus className="h-5 w-5" /> {t('propose')}
        </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {['all', ...CONVIVIO_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              category === c ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-[var(--gold)]/25 bg-white text-[var(--muted)] hover:border-[var(--gold)]/60'
            }`}
          >
            {c === 'all' ? t('allCategories') : t(`category_${c}`)}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white/70 p-10 text-center">
          <p className="text-[var(--muted)]">{tab === 'open' ? t('emptyOpen') : t('emptyMine')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((card) => (
            <ConvivioCardItem key={card.id} card={card} now={now} />
          ))}
        </div>
      )}

      <p className="mt-8 flex items-start gap-2 rounded-xl bg-white/70 px-4 py-3 text-xs leading-5 text-[var(--muted)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('paymentsNotice')}
      </p>

      {sheet === 'setup' && leader && (
        <VerificationSetup kind="kordata" status={leader} onClose={() => setSheet(null)} onDone={() => (router.refresh(), setSheet('create'))} />
      )}
      {sheet === 'create' && (
        <ConvivioCreateForm
          mode="leader"
          onClose={() => setSheet(null)}
          onCreated={(id) => router.push(`/${locale}/marketplace/convivio/${id}`)}
        />
      )}
    </div>
  )
}
