'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, Lock, Smartphone, Star, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import PlanTag from '@/components/PlanTag'
import { addFavorite, removeFavorite } from '@/app/actions/favorites'
import { FolderTile, folderEntries } from '@/components/dashboard/HomeFolders'
import { FROM_ICONS_KEY, FROM_SERVICES, shortServiceName } from '@/lib/homeView'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { GROUP_STYLE, type ServiceGroup } from '@/lib/serviceGroups'
import { HUB_GROUP, HUB_TABS, SERVICE_HUBS, TOOL_HUB, type ServiceHub } from '@/lib/serviceHubs'
import type { ServiceItem } from '@/lib/servicesCatalog'
import { COMMUNITY_DOT } from '@/lib/communityItems'
import type { RequiredPlan } from '@/lib/plans'
import { defaultLocale } from '../../../i18n'

// Pagina Servizi, vista a icone: le categorie una sotto l'altra con le loro
// icone (4 per riga sul telefono); i servizi uniti sono cartelle che si aprono
// sopra la pagina. Stellina dorata: già nella Home. Pressione lunga (o tasto
// destro dal computer): «Metti nella Home» / «Togli dalla Home». Lucchetto:
// toccando si apre il riquadro con cosa fa il servizio e come si sblocca.
const LONG_PRESS_MS = 500
// Nelle cartelle le schede vanno in ordine di pacchetto: Free, Base, Pro
const PLAN_RANK: Record<RequiredPlan, number> = { free: 0, base: 1, pro: 2 }
// Icona nella cartella aperta: stessa misura per tutte, anche sul computer
const FOLDER_TILE = 'h-14 w-14 rounded-[18px] sm:h-16 sm:w-16'

const markFromServices = () => {
  try {
    sessionStorage.setItem(FROM_ICONS_KEY, FROM_SERVICES)
  } catch {
    // facoltativo
  }
}

// Tocco, pressione lunga e tasto destro su un'icona
function usePress(onLong: () => void) {
  const timer = useRef<number | null>(null)
  const fired = useRef(false)
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }
  // Dopo una pressione lunga il tocco che segue non apre il servizio
  const consumeLong = () => {
    if (!fired.current) return false
    fired.current = false
    return true
  }
  return {
    consumeLong,
    handlers: {
      onPointerDown: () => {
        fired.current = false
        clear()
        timer.current = window.setTimeout(() => {
          fired.current = true
          onLong()
        }, LONG_PRESS_MS)
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault()
        clear()
        fired.current = true
        onLong()
      },
    },
  }
}

function ServiceIcon({
  item,
  label,
  plan,
  favorite,
  onLocked,
  onActions,
}: {
  item: ServiceItem
  label?: string
  // Nella cartella: il pacchetto scritto sotto il nome
  plan?: RequiredPlan | null
  favorite: boolean
  onLocked: (item: ServiceItem) => void
  onActions: (item: ServiceItem) => void
}) {
  const t = useTranslations('hub')
  const Icon = marketplaceIconMap[item.iconName] ?? Smartphone
  const { consumeLong, handlers } = usePress(() => onActions(item))
  const body = (
    <>
      <span
        className={`relative flex items-center justify-center shadow-[0_6px_14px_rgba(0,0,0,0.12)] transition-transform group-active:scale-95 ${plan !== undefined ? FOLDER_TILE : 'h-14 w-14 rounded-[18px] sm:h-16 sm:w-16 lg:h-[88px] lg:w-[88px] lg:rounded-[24px]'} ${item.tone ?? GROUP_STYLE[item.group].tile} ${item.open ? '' : 'opacity-60'}`}
      >
        <Icon className={plan !== undefined ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-6 w-6 sm:h-7 sm:w-7 lg:h-9 lg:w-9'} aria-hidden />
        {favorite && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--gold)] text-[var(--ink)]">
            <Star className="h-2.5 w-2.5" fill="currentColor" aria-label={t('inHome')} />
          </span>
        )}
        {!item.open && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--ink)] text-[var(--gold-bright)]">
            <Lock className="h-2.5 w-2.5" aria-label={t('lockedService')} />
          </span>
        )}
      </span>
      <span className="line-clamp-2 w-full hyphens-auto text-center text-[11px] font-semibold leading-tight text-[var(--ink)] [overflow-wrap:anywhere] sm:text-xs lg:text-sm">
        {label ?? shortServiceName(item.title)}
      </span>
      {plan && <PlanTag plan={plan} className="-mt-1" />}
    </>
  )
  const cls = 'group relative flex min-w-0 select-none flex-col items-center gap-1.5 rounded-2xl p-1 lg:gap-2 [-webkit-touch-callout:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]'
  const guard = (e: React.MouseEvent) => {
    if (!consumeLong()) return false
    e.preventDefault()
    return true
  }
  if (!item.open)
    return (
      <button type="button" aria-label={item.title} title={item.title} className={cls} {...handlers} onClick={(e) => !guard(e) && onLocked(item)}>
        {body}
      </button>
    )
  return (
    <Link href={item.href} aria-label={item.title} title={item.title} className={cls} {...handlers} onClick={(e) => !guard(e) && markFromServices()}>
      {body}
    </Link>
  )
}

export default function ServicesIcons({
  groups,
  hubsView,
  allItems,
  favorites,
  onFavoritesChange,
  community = [],
}: {
  // Servizi già filtrati (ricerca e filtro), divisi per categoria
  groups: { group: ServiceGroup; items: ServiceItem[] }[]
  // Senza ricerca: i servizi uniti come cartelle
  hubsView: boolean
  // Tutti i servizi (per le cartelle aperte)
  allItems: ServiceItem[]
  favorites: string[]
  onFavoritesChange: (favorites: string[]) => void
  // Sezioni della Community (già filtrate), come ultima categoria
  community?: ServiceItem[]
}) {
  const tt = useTranslations('toolTiers')
  const t = useTranslations('hub')
  const th = useTranslations('serviceHubs')
  const router = useRouter()
  const locale = useLocale()
  const [folder, setFolder] = useState<ServiceHub | null>(null)
  const [locked, setLocked] = useState<ServiceItem | null>(null)
  const [actions, setActions] = useState<ServiceItem | null>(null)
  const byTool = new Map(allItems.map((item) => [item.toolName, item]))

  useEffect(() => {
    if (!folder && !locked && !actions) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (actions) setActions(null)
      else if (locked) setLocked(null)
      else setFolder(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [folder, locked, actions])

  const toggleFavorite = async (toolName: string) => {
    const on = favorites.includes(toolName)
    const next = on ? favorites.filter((n) => n !== toolName) : [toolName, ...favorites]
    onFavoritesChange(next)
    setActions(null)
    const result = on ? await removeFavorite(toolName) : await addFavorite(toolName)
    if (!result.success) onFavoritesChange(favorites)
  }

  const iconProps = { onLocked: setLocked, onActions: setActions }
  const grid = 'grid grid-cols-4 gap-x-1 gap-y-4 sm:grid-cols-6 lg:grid-cols-7 lg:gap-y-6'
  const prefix = locale === defaultLocale ? '' : `/${locale}`

  return (
    <div className="space-y-6">
      {groups.map(({ group, items }) => {
        const groupHubs = hubsView ? SERVICE_HUBS.filter((hub) => HUB_GROUP[hub] === group && items.some((item) => TOOL_HUB[item.toolName] === hub)) : []
        const loose = hubsView ? items.filter((item) => !TOOL_HUB[item.toolName]) : items
        return (
          <section key={group} aria-labelledby={`icons-${group}`}>
            <h2 id={`icons-${group}`} className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)] lg:mb-4 lg:text-sm">
              <span className={`h-2 w-2 rounded-full ${GROUP_STYLE[group].dot}`} aria-hidden />
              {t(`group_${group}`)}
            </h2>
            <div className={grid}>
              {groupHubs.map((hub) => (
                <FolderTile key={hub} hub={hub} items={allItems} onOpen={() => setFolder(hub)} />
              ))}
              {loose.map((item) => (
                <ServiceIcon key={item.toolName} item={item} favorite={favorites.includes(item.toolName)} {...iconProps} />
              ))}
            </div>
          </section>
        )
      })}

      {/* Community: Bacheca, Kumano del Giorno, Kordata, Eventi, Banca del Tempo, Proposte */}
      {community.length > 0 && (
        <section aria-labelledby="icons-community">
          <h2 id="icons-community" className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)] lg:mb-4 lg:text-sm">
            <span className={`h-2 w-2 rounded-full ${COMMUNITY_DOT}`} aria-hidden />
            {tt('communityTitle')}
          </h2>
          <div className={grid}>
            {community.map((item) => (
              <ServiceIcon key={item.toolName} item={item} favorite={favorites.includes(item.toolName)} {...iconProps} />
            ))}
          </div>
        </section>
      )}

      {/* Cartella aperta: i servizi del servizio unito */}
      {folder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="services-folder" onClick={() => setFolder(null)}>
          <div className="w-full max-w-sm rounded-[28px] bg-[var(--paper)] p-5 text-[var(--ink)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 id="services-folder" className="text-lg font-extrabold">
                {th(`${folder}.title`).replace(/^KUMANI\s+/, '')}
              </h2>
              <button type="button" onClick={() => setFolder(null)} aria-label={t('close')} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-xs text-[var(--muted)]">{t('folderHint')}</p>
            <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
              {HUB_TABS[folder]
                .map((tab) => ({ tab, plan: tab.plan ?? byTool.get(tab.tool ?? tab.planTool ?? '')?.plan ?? null }))
                .sort((a, b) => (a.plan ? PLAN_RANK[a.plan] : 0) - (b.plan ? PLAN_RANK[b.plan] : 0))
                .map(({ tab, plan }) => {
                const item = tab.tool ? byTool.get(tab.tool) : undefined
                const label = th(`${folder}.tab_${tab.key}`)
                if (item) return <ServiceIcon key={tab.key} item={item} label={label} plan={plan} favorite={favorites.includes(item.toolName)} {...iconProps} />
                if (tab.tool) return null
                // Scheda che non è uno strumento a sé (es. «Tutto in uno»)
                const entry = folderEntries(folder, allItems, th).find((e) => e.key === tab.key)
                if (!entry) return null
                return (
                  <Link key={tab.key} href={tab.href} onClick={markFromServices} className="group flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 lg:gap-2">
                    <span className={`flex items-center justify-center shadow-[0_6px_14px_rgba(0,0,0,0.12)] ${FOLDER_TILE} ${GROUP_STYLE[HUB_GROUP[folder] as ServiceGroup].tile}`}>
                      <entry.Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
                    </span>
                    <span className="line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight sm:text-xs lg:text-sm">{label}</span>
                    {plan && <PlanTag plan={plan} className="-mt-1" />}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Servizio con il lucchetto: cosa fa e come si sblocca */}
      {locked && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="locked-title" onClick={() => setLocked(null)}>
          <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] text-[var(--ink)] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              {(() => {
                const Icon = marketplaceIconMap[locked.iconName] ?? Smartphone
                return (
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${locked.tone ?? GROUP_STYLE[locked.group].tile}`}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                )
              })()}
              <div className="min-w-0 flex-1">
                <h2 id="locked-title" className="font-bold">
                  {locked.title}
                </h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{locked.description}</p>
              </div>
              <button type="button" onClick={() => setLocked(null)} aria-label={t('close')} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <span className="inline-flex rounded-full bg-[var(--gold-pale)] px-3 py-1 text-xs font-bold">{locked.plan === 'pro' ? t('includedPro') : t('includedBase')}</span>
            <Link
              href={locked.plan === 'pro' ? `/pro?tool=${locked.toolName}` : '/billing'}
              className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white hover:bg-[var(--ink-soft)]"
            >
              {locked.plan === 'pro' ? t('activatePro') : t('activateBase')}
            </Link>
            {locked.passPrice && (
              <Link
                href={`/pass/${locked.toolName}`}
                className="flex min-h-11 items-center justify-center rounded-xl border border-[var(--gold)]/50 px-4 text-sm font-bold hover:bg-[var(--gold-pale)]"
              >
                {t('passOnly', { price: locked.passPrice })}
              </Link>
            )}
            {!locked.community && (
            <a href={`${prefix}/strumenti/${locked.toolName}`} className="flex items-center justify-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
              {t('learnMore')} <ArrowRight className="h-4 w-4" />
            </a>
            )}
          </div>
        </div>
      )}

      {/* Pressione lunga: aprire, mettere o togliere dalla Home */}
      {actions && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={actions.title} onClick={() => setActions(null)}>
          <div className="w-full max-w-sm space-y-2 rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] text-[var(--ink)] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-center text-sm font-bold">{actions.title}</p>
            <button
              type="button"
              onClick={() => toggleFavorite(actions.toolName)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]"
            >
              <Star className="h-4 w-4" fill={favorites.includes(actions.toolName) ? 'none' : 'currentColor'} aria-hidden />
              {favorites.includes(actions.toolName) ? t('removeFromHome') : t('addToHome')}
            </button>
            <button
              type="button"
              onClick={() => {
                const item = actions
                setActions(null)
                if (item.open) {
                  markFromServices()
                  router.push(`${prefix}${item.href}`)
                } else setLocked(item)
              }}
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--gold)]/50 px-4 text-sm font-bold hover:bg-[var(--gold-pale)]"
            >
              {t('open')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
