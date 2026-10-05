'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, BookOpen, Compass, LoaderCircle, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { GROUP_STYLE, serviceGroupOf } from '@/lib/serviceGroups'
import type { ServiceItem } from '@/lib/servicesCatalog'
import { getRelatedServices, type RelatedServices as Related } from '@/app/actions/relatedServices'
import { locales } from '../../i18n'

// In fondo alla pagina principale di ogni servizio: una riga sobria per
// scoprire gli altri servizi dello stesso gruppo (Benessere, Lavoro…). La
// finestra carica i servizi solo quando la si apre: nessun costo per chi
// non la usa. Non compare nelle pagine interne (creazione, modifica…).
export default function RelatedServices() {
  const pathname = usePathname()
  const t = useTranslations('relatedServices')
  const th = useTranslations('hub')
  const tm = useTranslations('marketplace')
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Related | null>(null)
  const [loading, setLoading] = useState(false)

  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && locales.includes(segments[0])) segments.shift()
  const tool = segments[0] === 'marketplace' && segments.length === 2 ? getMarketplaceTools(tm).find((item) => item.toolName === segments[1]) : undefined
  if (!tool) return null
  const group = serviceGroupOf(tool.toolName)

  const show = async () => {
    setOpen(true)
    if (data?.items && data.group === group && !loading) return
    setLoading(true)
    setData(await getRelatedServices(tool.toolName))
    setLoading(false)
  }

  const row = (item: ServiceItem) => {
    const Icon = marketplaceIconMap[item.iconName] || Compass
    // Servizio non ancora suo: prima la pagina che spiega come funziona, da lì
    // sceglie se prendere il Pass del solo servizio o abbonarsi
    const href = item.open ? item.href : `/strumenti/${item.toolName}`
    return (
      <li key={item.toolName}>
        <Link href={href} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 transition hover:border-[var(--gold)]/60 hover:bg-[var(--gold-pale)]/30">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${GROUP_STYLE[item.group].tile}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-[var(--ink)]">{item.title}</span>
            <span className="line-clamp-2 block text-xs leading-5 text-[var(--muted)]">{item.description}</span>
          </span>
          <span
            className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${item.open ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}
          >
            {item.open ? (
              <>
                {t('open')} <ArrowRight className="h-3 w-3" />
              </>
            ) : (
              <>
                <BookOpen className="h-3 w-3" /> {t('learnMore')}
              </>
            )}
          </span>
        </Link>
      </li>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 print:hidden sm:px-6 sm:pb-10">
        <button
          type="button"
          onClick={show}
          className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/30 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-[var(--gold)]/70"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${GROUP_STYLE[group].tile}`}>
              <Compass className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 text-sm text-[var(--ink)]">
              {t('banner', { tool: tool.title })} <span className="font-bold">{th(`group_${group}`)}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-[var(--gold)] group-hover:text-[var(--ink)]">
            {t('discover')} <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={th(`group_${group}`)}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">{t('eyebrow')}</p>
                <h2 className="text-xl font-extrabold text-[var(--ink)]">{th(`group_${group}`)}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {loading || !data ? (
              <div className="flex justify-center py-10">
                {loading ? <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" /> : <p className="text-sm text-[var(--muted)]">{t('error')}</p>}
              </div>
            ) : (
              <>
                {data.items.length > 0 ? <ul className="space-y-2">{data.items.map(row)}</ul> : <p className="text-sm text-[var(--muted)]">{t('noneInGroup')}</p>}
                {data.extra.length > 0 && (
                  <>
                    <p className="mb-2 mt-5 text-sm font-bold text-[var(--ink)]">{t('alsoFree')}</p>
                    <ul className="space-y-2">{data.extra.map(row)}</ul>
                  </>
                )}
                <Link
                  href="/servizi"
                  onClick={() => setOpen(false)}
                  className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-[var(--gold-bright)]"
                >
                  {t('allServices')} <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
