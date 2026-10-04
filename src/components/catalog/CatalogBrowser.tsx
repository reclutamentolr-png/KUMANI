'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, BookOpen, Check, Search, Smartphone, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { GROUP_STYLE, type ServiceGroup } from '@/lib/serviceGroups'
import type { Catalog, CatalogItem } from '@/lib/catalog-server'

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const COMMUNITY_STYLE = { dot: 'bg-sky-700', tile: 'bg-sky-50 text-sky-800' }
const styleOf = (group: string) => (group in GROUP_STYLE ? GROUP_STYLE[group as ServiceGroup] : COMMUNITY_STYLE)

// Catalogo come un manuale: indice per categorie, ricerca e per ogni
// servizio a cosa serve, cosa puoi fare e come si usa.
export default function CatalogBrowser({ catalog }: { catalog: Catalog }) {
  const t = useTranslations('catalog')
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean)
    if (!words.length) return catalog.groups
    return catalog.groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const text = normalize([item.title, item.purpose, group.label, ...item.points.map((p) => `${p.title} ${p.text}`)].join(' '))
          return words.every((word) => text.includes(word))
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [catalog.groups, query])

  return (
    <div className="space-y-8">
      <div className="space-y-4 rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
        <label className="relative block">
          <span className="sr-only">{t('searchPlaceholder')}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-xl border border-[var(--gold)]/35 bg-white py-3 pl-12 pr-11 text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/25"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('clearSearch')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--muted)] hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <nav aria-label={t('indexTitle')}>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted)]">{t('indexTitle')}</p>
          <div className="flex flex-wrap gap-2">
            {catalog.groups.map((group) => (
              <a
                key={group.key}
                href={`#cat-${group.key}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/35 bg-white px-3.5 py-1.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--gold)]"
              >
                <span className={`h-2 w-2 rounded-full ${styleOf(group.key).dot}`} />
                {group.label} <span className="text-[var(--muted)]">{group.items.length}</span>
              </a>
            ))}
          </div>
        </nav>
      </div>

      {groups.length === 0 && <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-6 text-center text-sm text-[var(--muted)]">{t('noResults')}</p>}

      {groups.map((group) => (
        <section key={group.key} id={`cat-${group.key}`} className="scroll-mt-24">
          <h2 className="mb-4 flex items-center gap-2.5 border-b border-[var(--gold)]/30 pb-2 text-2xl font-extrabold text-[var(--ink)]">
            <span className={`h-3 w-3 rounded-full ${styleOf(group.key).dot}`} />
            {group.label}
          </h2>
          <div className="space-y-4">
            {group.items.map((item) => (
              <CatalogEntry key={item.toolName} item={item} tile={styleOf(group.key).tile} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function CatalogEntry({ item, tile }: { item: CatalogItem; tile: string }) {
  const t = useTranslations('catalog')
  const Icon = marketplaceIconMap[item.iconName] || Smartphone
  const plan = item.plan === 'free' ? t('planFree') : item.plan === 'pro' ? t('planPro') : t('planBase')

  return (
    <article id={`svc-${item.toolName}`} className="scroll-mt-24 rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_8px_24px_rgba(23,23,23,0.05)] sm:p-6">
      <header className="flex items-start gap-3.5">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tile}`}>
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-[var(--ink)]">{item.title}</h3>
          <p className="mt-1 flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${item.plan === 'free' ? 'bg-emerald-50 text-emerald-700' : item.plan === 'pro' ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
              {plan}
            </span>
            {item.passPrice && <span className="rounded-full border border-dashed border-[var(--gold)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink)]">{t('passFrom', { price: item.passPrice })}</span>}
          </p>
        </div>
      </header>

      <p className="mt-4 text-[15px] leading-7 text-[var(--ink)]">
        <span className="font-bold">{t('purposeLabel')} </span>
        {item.purpose}
      </p>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {item.points.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{t('pointsLabel')}</h4>
            <ul className="mt-2 space-y-2">
              {item.points.map((point) => (
                <li key={point.title} className="flex gap-2 text-sm leading-6 text-[var(--ink)]">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <span className="font-semibold">{point.title}</span>
                    {point.text && <span className="text-[var(--ink)]/75"> — {point.text}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {item.steps.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{t('stepsLabel')}</h4>
            <ol className="mt-2 space-y-2">
              {item.steps.map((step, i) => (
                <li key={step.title} className="flex gap-2.5 text-sm leading-6 text-[var(--ink)]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-[var(--gold-bright)]">{i + 1}</span>
                  <span>
                    <span className="font-semibold">{step.title}</span>
                    {step.text && <span className="block text-[var(--ink)]/75">{step.text}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <footer className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        <Link href={item.openHref} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--ink-soft)]">
          {t('openService')} <ArrowRight className="h-4 w-4" />
        </Link>
        {item.guideHref && (
          <Link href={item.guideHref} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--gold)]/45 px-4 py-2 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
            <BookOpen className="h-4 w-4 text-[var(--gold)]" /> {t('fullGuide')}
          </Link>
        )}
      </footer>
    </article>
  )
}
