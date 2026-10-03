'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { Search, PlusCircle, FileUser } from 'lucide-react'
import CvCard from '@/components/CvCard'
import { useFromDashboardSuffix } from '@/lib/useFromDashboard'

type Cv = {
  id: string
  title: string
  full_name: string
  role_title: string | null
  template: string
  updated_at: string
}

export default function CvsDashboard({ cvs }: { cvs: Cv[] }) {
  const t = useTranslations('kumaniCv')
  const [search, setSearch] = useState('')
  const fromDashboardSuffix = useFromDashboardSuffix()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cvs
      .filter((cv) => (q ? cv.title.toLowerCase().includes(q) || cv.full_name.toLowerCase().includes(q) : true))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [cvs, search])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--gold)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>

        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((cv) => (
              <CvCard key={cv.id} cv={cv} fromDashboardSuffix={fromDashboardSuffix} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-xl border border-dashed border-[var(--gold)]/40 text-[var(--muted)]">
            <FileUser className="w-12 h-12 mx-auto mb-4 text-[var(--gold)]" />
            <p>{cvs.length === 0 ? t('noCvsYet') : t('noResults')}</p>
          </div>
        )}
      </div>

      <Link
        href={`/marketplace/kumani-cv/new${fromDashboardSuffix}`}
        data-fab className="fixed bottom-6 right-6 z-10 flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-full font-bold shadow-lg hover:brightness-105 hover:shadow-xl hover:-translate-y-0.5 transition-all"
      >
        <PlusCircle className="w-5 h-5" />
        {t('newCv')}
      </Link>
    </div>
  )
}
