'use client'

import { useTranslations } from 'next-intl'
import { ArrowRight, Lock, Smartphone, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'

// Sezioni della Community (Bacheca, Kumano del Giorno, Kordata, Eventi,
// Banca del Tempo): non sono servizi del Marketplace, niente stella.
export type CommunityItem = { toolName: string; href: string; iconName: string; title: string; description: string; locked: boolean }

export function CommunityBlock({ items }: { items: CommunityItem[] }) {
  const t = useTranslations('toolTiers')
  return (
    <section className="overflow-hidden rounded-2xl border border-sky-200 bg-[#f5f9fd] shadow-[0_12px_30px_rgba(23,23,23,0.08)]">
      <div className="flex items-start gap-3 border-b border-sky-200 bg-sky-50 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-700 text-white">
          <Users className="h-4.5 w-4.5" />
        </span>
        <div>
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-extrabold text-[var(--ink)]">
            {t('communityTitle')}
            <span className="rounded-full bg-sky-700 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-white">{t('communityBadge')}</span>
          </h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{t('communitySub')}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => {
          const Icon = marketplaceIconMap[item.iconName] || Smartphone
          return (
            <Link
              key={item.toolName}
              href={item.locked ? { pathname: '/billing' } : `${item.href}?from=dashboard`}
              className="group relative grid grid-cols-[2.25rem_1fr] gap-x-3 rounded-xl sm:flex sm:min-h-[150px] sm:flex-col border border-sky-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md"
            >
              <div className="relative row-span-3 flex h-9 w-9 items-center sm:mb-2 justify-center rounded-lg bg-sky-700 text-white">
                <Icon className="h-4.5 w-4.5" strokeWidth={1.7} />
                {item.locked && (
                  <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[var(--gold)] text-white">
                    <Lock className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-[var(--ink)] group-hover:text-sky-700">{item.title}</p>
              <p className="mt-0.5 line-clamp-2 flex-1 text-xs sm:line-clamp-3 leading-5 text-[var(--muted)]">{item.description}</p>
              <div className="mt-2">
                {item.locked ? (
                  <span className="rounded-full bg-[var(--gold-pale)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink)]">{t('includedBase')}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                    {t('open')} <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
