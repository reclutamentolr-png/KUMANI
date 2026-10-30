'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  BookOpen,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Gamepad2,
  LayoutGrid,
  Leaf,
  List,
  Lock,
  Megaphone,
  Music,
  Search,
  ShieldCheck,
  Smartphone,
  Store,
  User,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import FavoriteStarButton from '@/components/FavoriteStarButton'
import QuickCheckBox from '@/components/ecosystem/QuickCheckBox'
import HubCards from '@/components/hubs/HubCards'
import PlanTag from '@/components/PlanTag'
import { HUB_GROUP, SERVICE_HUBS, TOOL_HUB } from '@/lib/serviceHubs'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { GROUP_PARTS, GROUP_STYLE, SEGMENT_GROUPS, SEGMENT_ONLY_PLANS, SERVICE_GROUPS, type ServiceGroup, type ServiceSegment } from '@/lib/serviceGroups'
import type { ServiceItem } from '@/lib/servicesCatalog'
import ServicesIcons from './ServicesIcons'
import { CommunityBlock, type CommunityItem } from '@/components/dashboard/CommunityBlock'
import { communityAsService } from '@/lib/communityItems'
import { setServicesView } from '@/app/actions/homeView'
import { FROM_ICONS_KEY, FROM_SERVICES, type ServicesView } from '@/lib/homeView'

type Filter = 'all' | 'mine' | 'locked'

const PLAN_RANK: Record<ServiceItem['plan'], number> = { free: 0, base: 1, pro: 2 }

// Icona di ogni categoria (copertine, colonna a sinistra, barra in alto)
const GROUP_ICON: Record<ServiceGroup, LucideIcon> = {
  security: ShieldCheck,
  money: Wallet,
  work: BriefcaseBusiness,
  docs: FileText,
  wellness: Leaf,
  fun: Gamepad2,
  audio: Music,
  kids: Baby,
  manage: ClipboardList,
  business: Store,
  social: Megaphone,
}

// Parte e categoria scelte: ricordate nel browser per la prossima visita
const SEGMENT_KEY = 'kumani-servizi-parte'
const GROUP_KEY = 'kumani-servizi-categoria'

// Dove porta una scheda: dentro il servizio se si può usare, altrimenti dove
// si sblocca (Pass del singolo servizio, Pro o Plus)
export function serviceHref(item: ServiceItem) {
  if (item.open) return `${item.href}?from=dashboard`
  if (item.unlock === 'pass') return `/pass/${item.toolName}`
  if (item.unlock === 'pro') return `/pro?tool=${item.toolName}`
  return '/billing'
}

// Ricerca senza accenti e maiuscole ("verifica" trova "Verifica IBAN")
const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// Nella scheda singola il nome proprio del servizio («Trova Lavoro»), non
// quello della cartella («KUMANI Lavoro · Cerca lavoro»)
const ownTitle = (item: ServiceItem): ServiceItem => (item.name && TOOL_HUB[item.toolName] ? { ...item, title: item.name } : item)

// Cartelle (servizi uniti) e servizi sciolti di una categoria
function splitGroup(group: ServiceGroup, items: ServiceItem[], hubsView: boolean) {
  const hubs = hubsView ? SERVICE_HUBS.filter((hub) => HUB_GROUP[hub] === group && items.some((item) => TOOL_HUB[item.toolName] === hub)) : []
  const loose = hubs.length ? items.filter((item) => !TOOL_HUB[item.toolName]) : items
  return { hubs, loose }
}

// initialView: Elenco o Icone (scelta salvata nel profilo, vedi lib/homeView)
// community: sezioni della Community, in fondo (schede nell'Elenco, icone nella vista Icone)
// Elenco: le due parti («Per me», «Per la mia attività»), le categorie a
// copertine (telefono) o nella colonna a sinistra (computer), poi i servizi
// della categoria con la barra delle categorie in alto. Cercando si vedono i
// risultati di tutte le categorie, anche dell'altra parte.
export default function ServicesBrowser({
  items,
  favorites: initialFavorites,
  initialView = 'list',
  community = [],
}: {
  items: ServiceItem[]
  favorites: string[]
  initialView?: ServicesView
  community?: CommunityItem[]
}) {
  const t = useTranslations('hub')
  const [view, setView] = useState<ServicesView>(initialView)
  const [, startSaving] = useTransition()
  const chooseView = (next: ServicesView) => {
    if (next === view) return
    setView(next)
    startSaving(async () => {
      await setServicesView(next)
    })
  }
  // Un servizio aperto da questa pagina riporta qui («Torna ai servizi»)
  const markFromServices = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('a')) return
    try {
      sessionStorage.setItem(FROM_ICONS_KEY, FROM_SERVICES)
    } catch {
      // facoltativo
    }
  }
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [favorites, setFavorites] = useState(initialFavorites)
  const [segment, setSegment] = useState<ServiceSegment>('me')
  const [selected, setSelected] = useState<ServiceGroup | null>(null)

  useEffect(() => {
    try {
      const seg = localStorage.getItem(SEGMENT_KEY)
      const group = localStorage.getItem(GROUP_KEY) as ServiceGroup | null
      if (seg !== 'me' && seg !== 'biz') return
      queueMicrotask(() => {
        setSegment(seg)
        if (group && SEGMENT_GROUPS[seg].includes(group)) setSelected(group)
      })
    } catch {
      // facoltativo
    }
  }, [])
  const remember = (seg: ServiceSegment, group: ServiceGroup | null) => {
    try {
      localStorage.setItem(SEGMENT_KEY, seg)
      if (group) localStorage.setItem(GROUP_KEY, group)
      else localStorage.removeItem(GROUP_KEY)
    } catch {
      // facoltativo
    }
  }
  const chooseSegment = (seg: ServiceSegment) => {
    setSegment(seg)
    setSelected(null)
    remember(seg, null)
  }
  // Aprendo una categoria la pagina parte dalla fila delle categorie (sul
  // computer dalla fascia nera), non dalla cima con ricerca e filtri
  const listTopRef = useRef<HTMLDivElement>(null)
  const [scrollTick, setScrollTick] = useState(0)
  useEffect(() => {
    if (scrollTick) listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollTick])
  const chooseGroup = (group: ServiceGroup | null) => {
    setSelected(group)
    remember(segment, group)
    setScrollTick((n) => n + 1)
  }

  // La sicurezza conta come tre servizi (Controlla, Proteggi, Segnala): un
  // servizio è «mio» se almeno una scheda è aperta, «da sbloccare» se una è chiusa
  const others = items.filter((item) => !TOOL_HUB[item.toolName])
  const hubs = SERVICE_HUBS.map((hub) => items.filter((item) => TOOL_HUB[item.toolName] === hub)).filter((list) => list.length > 0)
  const counts = {
    all: others.length + hubs.length,
    mine: others.filter((item) => item.open).length + hubs.filter((list) => list.some((item) => item.open)).length,
    locked: others.filter((item) => !item.open).length + hubs.filter((list) => list.some((item) => !item.open)).length,
  }

  const groups = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean)
    const shown = items.filter((item) => {
      if (filter === 'mine' && !item.open) return false
      if (filter === 'locked' && item.open) return false
      const text = normalize(`${item.title} ${item.name ?? ''} ${item.description} ${t(`group_${item.group}`)}`)
      return words.every((word) => text.includes(word))
    })
    // Nei gruppi prima i gratuiti, poi quelli del Plus, poi del Pro; a parità
    // prima quelli che si possono già usare
    return SERVICE_GROUPS.map((group) => ({
      group,
      items: shown.filter((item) => item.group === group).sort((a, b) => PLAN_RANK[a.plan] - PLAN_RANK[b.plan] || Number(b.open) - Number(a.open)),
    })).filter(({ items }) => items.length > 0)
  }, [items, query, filter, t])

  const searching = query.trim().length > 0
  const hubsView = !searching
  // Senza ricerca si vede solo la parte scelta (in «Per me» le categorie per
  // chi ha un'attività solo con i servizi gratuiti e del Plus)
  const segmentGroups = searching
    ? groups
    : SEGMENT_GROUPS[segment]
        .map((g) => {
          const found = groups.find((x) => x.group === g)
          const plans = SEGMENT_ONLY_PLANS[segment]?.[g]
          return found && plans ? { ...found, items: found.items.filter((item) => plans.includes(item.plan)) } : found
        })
        .filter((x): x is (typeof groups)[number] => !!x && x.items.length > 0)
  const current = selected ? segmentGroups.find((g) => g.group === selected) : undefined
  // Nell'Elenco ogni servizio ha la sua scheda: si contano tutti
  const sizeOf = (_group: ServiceGroup, list: ServiceItem[]) => list.length
  const openOf = (_group: ServiceGroup, list: ServiceItem[]) => list.filter((item) => item.open).length
  const segmentSize = segmentGroups.reduce((n, g) => n + sizeOf(g.group, g.items), 0)

  // Community nella vista Icone: con la stessa ricerca e gli stessi filtri
  const communityIcons = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean)
    return community.map(communityAsService).filter((item) => {
      if (filter === 'mine' && !item.open) return false
      if (filter === 'locked' && item.open) return false
      const text = normalize(`${item.title} ${item.description}`)
      return words.every((word) => text.includes(word))
    })
  }, [community, query, filter])

  const onToggle = (toolName: string, isFavorite: boolean) =>
    setFavorites((list) => (isFavorite ? [toolName, ...list.filter((name) => name !== toolName)] : list.filter((name) => name !== toolName)))

  const cards = (list: ServiceItem[]) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((item) => (
        <ServiceCard key={item.toolName} item={item} isFavorite={favorites.includes(item.toolName)} onToggle={onToggle} brand />
      ))}
    </div>
  )

  // I servizi di una categoria, ognuno con la sua scheda e la sua
  // descrizione (le cartelle restano nella vista Icone e nella Home);
  // per il Lavoro divisi in due parti
  const groupBody = (group: ServiceGroup, list: ServiceItem[]) => {
    const split = splitGroup(group, list.map(ownTitle), false)
    const parts = GROUP_PARTS[group]
    if (parts) {
      const inPart = (toolName: string) => parts.some((part) => part.tools.includes(toolName))
      const rest = split.loose.filter((item) => !inPart(item.toolName))
      return (
        <div className="space-y-6">
          {parts.map((part) => {
            const partHubs = split.hubs.filter((hub) => list.some((item) => TOOL_HUB[item.toolName] === hub && part.tools.includes(item.toolName)))
            // Prima gratis, poi Plus, poi Pro; a parità nell'ordine della parte
            const partItems = split.loose
              .filter((item) => part.tools.includes(item.toolName))
              .sort((a, b) => PLAN_RANK[a.plan] - PLAN_RANK[b.plan] || part.tools.indexOf(a.toolName) - part.tools.indexOf(b.toolName))
            if (!partHubs.length && !partItems.length) return null
            return (
              <div key={part.key}>
                <h3 className="mb-2.5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[var(--ink)]">
                  <span className="h-4 w-1 rounded-full bg-[var(--gold)]" aria-hidden />
                  {t(`part_${group}_${part.key}`)}
                </h3>
                {partHubs.length > 0 && <HubCards hubs={partHubs} items={list} />}
                {partItems.length > 0 && <div className={partHubs.length ? 'mt-3' : ''}>{cards(partItems)}</div>}
              </div>
            )
          })}
          {/* Servizi del gruppo fuori dalle parti: in fondo */}
          {rest.length > 0 && cards(rest)}
        </div>
      )
    }
    return (
      <>
        {split.hubs.length > 0 && <HubCards hubs={split.hubs} items={list} />}
        {split.loose.length > 0 && <div className={split.hubs.length ? 'mt-3' : ''}>{cards(split.loose)}</div>}
      </>
    )
  }

  const noResults = (
    <p className="mt-8 rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white px-5 py-8 text-center text-sm text-[var(--muted)]">{t('noResults')}</p>
  )

  return (
    <div onClickCapture={markFromServices}>
      {/* Per me · Per la mia attività */}
      <div role="radiogroup" aria-label={t('segmentsLabel')} className="mb-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--gold)]/25 bg-white p-1.5 shadow-sm">
        {(
          [
            { key: 'me', Icon: User },
            { key: 'biz', Icon: Store },
          ] as const
        ).map(({ key, Icon }) => {
          const on = segment === key
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => chooseSegment(key)}
              className={`flex min-h-12 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${on ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink)] hover:bg-[var(--paper)]'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-[var(--gold)] text-[var(--ink)]' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-extrabold leading-tight">{t(`segment_${key}`)}</span>
                <span className={`block text-[11px] leading-tight ${on ? 'text-white/70' : 'text-[var(--muted)]'}`}>{t(`segmentHint_${key}`)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Elenco · Icone */}
      <div role="radiogroup" aria-label={t('viewLabel')} className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-[var(--gold)]/25 bg-white p-1">
        {(
          [
            { key: 'list', Icon: List, label: t('viewList') },
            { key: 'icons', Icon: LayoutGrid, label: t('viewIcons') },
          ] as const
        ).map(({ key, Icon, label }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={view === key}
            onClick={() => chooseView(key)}
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-bold transition-colors ${
              view === key ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {/* Ricerca: cerca in tutti i servizi, anche dell'altra parte */}
      <label className="relative block">
        <span className="sr-only">{t('searchPlaceholder')}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-2xl border border-[var(--gold)]/35 bg-white py-3.5 pl-12 pr-11 text-base text-[var(--ink)] shadow-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/25"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('clearSearch')}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--gold-pale)] hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </label>

      {/* Filtri */}
      <div role="tablist" aria-label={t('filtersLabel')} className="mt-3 flex gap-2 overflow-x-auto pb-1 [contain:inline-size]">
        {(['all', 'mine', 'locked'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              filter === key ? 'bg-[var(--ink)] text-white' : 'border border-[var(--gold)]/35 bg-white text-[var(--ink)] hover:border-[var(--gold)]'
            }`}
          >
            {t(`filter_${key}`)} <span className={filter === key ? 'text-[var(--gold-bright)]' : 'text-[var(--muted)]'}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {view === 'icons' ? (
        segmentGroups.length === 0 && communityIcons.length === 0 ? (
          noResults
        ) : (
          <div className="mt-6">
            <ServicesIcons
              groups={segmentGroups}
              hubsView={hubsView}
              allItems={items}
              favorites={favorites}
              onFavoritesChange={setFavorites}
              community={segment === 'me' || searching ? communityIcons : []}
            />
          </div>
        )
      ) : searching ? (
        // Ricerca: i risultati di tutte le categorie, divisi per categoria
        groups.length === 0 ? (
          noResults
        ) : (
          <div className="mt-6 space-y-8">
            {groups.map(({ group, items }) => (
              <section key={group} aria-labelledby={`group-${group}`}>
                <h2 id={`group-${group}`} className="mb-3 flex items-center gap-2 text-lg font-extrabold text-[var(--ink)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--gold)]" />
                  {t(`group_${group}`)}
                  <span className="text-sm font-semibold text-[var(--muted)]">{items.length}</span>
                </h2>
                {cards(items)}
              </section>
            ))}
          </div>
        )
      ) : (
        <div ref={listTopRef} className="mt-6 scroll-mt-2 lg:flex lg:gap-6">
          {/* Computer: le categorie della parte scelta in una colonna */}
          <aside className="hidden lg:block lg:w-64 lg:shrink-0">
            <nav aria-label={t('allCategories')} className="sticky top-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-2 shadow-sm">
              <SideRow active={!current} onClick={() => chooseGroup(null)} Icon={LayoutGrid} label={t('allCategories')} count={segmentSize} />
              <div className="my-1 h-px bg-[var(--gold)]/15" />
              {segmentGroups.map(({ group, items }) => (
                <SideRow
                  key={group}
                  active={current?.group === group}
                  onClick={() => chooseGroup(group)}
                  Icon={GROUP_ICON[group]}
                  label={t(`group_${group}`)}
                  count={sizeOf(group, items)}
                />
              ))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            {segmentGroups.length === 0 ? (
              noResults
            ) : !current ? (
              <>
                <h2 className="mb-1 text-xl font-extrabold text-[var(--ink)]">{t(`segmentTitle_${segment}`)}</h2>
                <p className="mb-4 text-sm text-[var(--muted)]">{t('chooseCategory')}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {segmentGroups.map(({ group, items }) => (
                    <CategoryCover key={group} group={group} items={items} size={sizeOf(group, items)} open={openOf(group, items)} onClick={() => chooseGroup(group)} />
                  ))}
                </div>
                {/* Chi ha un'attività: l'altra parte è a un tocco */}
                {segment === 'me' && (
                  <button
                    type="button"
                    onClick={() => chooseSegment('biz')}
                    className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] p-4 text-left transition-colors hover:border-[var(--gold)]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                      <Store className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold text-[var(--ink)]">{t('bizHintTitle')}</span>
                      <span className="block text-sm text-[var(--ink)]/75">{t('bizHintText')}</span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[var(--ink)]" aria-hidden />
                  </button>
                )}
                {/* La Community in fondo, nella parte «Per me» */}
                {segment === 'me' && community.length > 0 && (
                  <div className="mt-8">
                    <CommunityBlock items={community} />
                  </div>
                )}
              </>
            ) : (
              <section aria-labelledby={`group-${current.group}`}>
                {/* Telefono: le categorie della parte in una fila che resta in alto e scorre di lato (contain: non allarga la pagina) */}
                <div className="sticky top-0 z-10 -mx-4 mb-4 bg-[var(--background)]/95 px-4 py-2 backdrop-blur lg:hidden">
                  <div className="flex gap-2 overflow-x-auto pb-1 [contain:inline-size] [scrollbar-width:none]">
                    <button
                      type="button"
                      onClick={() => chooseGroup(null)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--ink)]/15 bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)]"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden /> {t('backToCategories')}
                    </button>
                    {segmentGroups.map(({ group }) => {
                      const Icon = GROUP_ICON[group]
                      const on = group === current.group
                      return (
                        <button
                          key={group}
                          type="button"
                          aria-current={on ? 'true' : undefined}
                          ref={on ? (el) => el?.scrollIntoView({ inline: 'center', block: 'nearest' }) : undefined}
                          onClick={() => chooseGroup(group)}
                          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                            on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-[var(--gold)]/35 bg-white text-[var(--ink)]'
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden /> {t(`group_${group}`)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Fascia della categoria, nera e oro come il resto del sito */}
                <div className="mb-4 flex items-center gap-4 rounded-2xl bg-[var(--ink)] p-4 text-white shadow-[0_12px_30px_rgba(23,23,23,0.18)] sm:p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--gold)] text-[var(--ink)]">
                    <CurrentIcon group={current.group} />
                  </span>
                  <div className="min-w-0">
                    <h2 id={`group-${current.group}`} className="text-xl font-extrabold text-[var(--gold-bright)]">
                      {t(`group_${current.group}`)}
                    </h2>
                    <p className="text-sm text-white/75">{t(`groupLine_${current.group}`)}</p>
                  </div>
                  <span className="ml-auto hidden shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-[var(--gold-bright)] sm:block">
                    {t('servicesCount', { n: sizeOf(current.group, current.items) })}
                  </span>
                </div>

                {/* Sicurezza: prima di tutto il controllo veloce */}
                {current.group === 'security' && (
                  <div className="mb-4">
                    <QuickCheckBox />
                  </div>
                )}
                {groupBody(current.group, current.items)}
                {current.group === 'docs' && <p className="mt-4 text-xs text-[var(--muted)]">{t('docsBoth')}</p>}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CurrentIcon({ group }: { group: ServiceGroup }) {
  const Icon = GROUP_ICON[group]
  return <Icon className="h-6 w-6" aria-hidden />
}

function SideRow({
  active,
  onClick,
  Icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  Icon: LucideIcon
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${active ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink)] hover:bg-[var(--paper)]'}`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-[var(--gold)] text-[var(--ink)]' : 'bg-[var(--ink)] text-[var(--gold-bright)]'}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 leading-tight">{label}</span>
      <span className="text-xs font-bold opacity-60">{count}</span>
    </button>
  )
}

// Copertina di una categoria: icona, nome, a cosa serve, primi servizi, quanti aperti
function CategoryCover({ group, items, size, open, onClick }: { group: ServiceGroup; items: ServiceItem[]; size: number; open: number; onClick: () => void }) {
  const t = useTranslations('hub')
  const Icon = GROUP_ICON[group]
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white p-3.5 text-left shadow-[0_6px_18px_rgba(23,23,23,0.06)] transition-all hover:-translate-y-0.5 hover:border-[var(--gold)] hover:shadow-md sm:p-4"
    >
      <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" aria-hidden />
      <span className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ink)] text-[var(--gold-bright)]">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <span className="mt-3 text-[15px] font-extrabold leading-tight text-[var(--ink)] sm:text-base">{t(`group_${group}`)}</span>
      <span className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--muted)] sm:text-[13px]">{t(`groupLine_${group}`)}</span>
      <span className="mt-auto flex items-end justify-between gap-2 pt-3">
        <span className="flex -space-x-1.5" aria-hidden>
          {items.slice(0, 3).map((item) => {
            const ItemIcon = marketplaceIconMap[item.iconName] || Smartphone
            return (
              <span key={item.toolName} className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-white bg-[var(--gold-pale)] text-[var(--ink)]">
                <ItemIcon className="h-3.5 w-3.5" />
              </span>
            )
          })}
        </span>
        <span className="text-right text-[11px] font-bold leading-tight text-[var(--ink)]">
          {t('servicesCount', { n: size })}
          {open < size && <span className="block font-semibold text-[var(--muted)]">{t('openCount', { n: open })}</span>}
        </span>
      </span>
    </button>
  )
}

export function ServiceCard({
  item,
  isFavorite,
  onToggle,
  compact = false,
  brand = false,
}: {
  item: ServiceItem
  isFavorite: boolean
  onToggle?: (toolName: string, isFavorite: boolean) => void
  // Home: solo icona, nome e Apri/lucchetto, senza descrizione né stella
  compact?: boolean
  // Pagina Servizi: icone nere e oro per tutti, nome più grande
  brand?: boolean
}) {
  const t = useTranslations('hub')
  const Icon = marketplaceIconMap[item.iconName] || Smartphone
  // Sezioni della Community: colore proprio
  const style = brand ? { dot: 'bg-[var(--gold)]', tile: 'bg-[var(--ink)] text-[var(--gold-bright)]' } : item.tone ? { dot: 'bg-sky-600', tile: item.tone } : GROUP_STYLE[item.group]
  // Servizi uniti («KUMANI Benessere · Concentrazione»): nella Home prima il
  // nome del servizio, sotto piccolo il gruppo
  const [hubName, toolTitle] = item.title.includes(' · ') ? item.title.split(' · ', 2) : [null, item.title]
  const compactNote = [hubName, item.open ? null : item.plan === 'pro' ? t('includedPro') : t('includedBase')].filter(Boolean).join(' · ')

  return (
    <div className={`relative ${item.open ? '' : 'opacity-[0.86]'}`}>
      <Link
        href={serviceHref(item)}
        className={`group flex h-full gap-3 rounded-2xl border bg-white p-3.5 shadow-[0_6px_18px_rgba(23,23,23,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-md ${
          item.open ? 'border-[var(--gold)]/30 hover:border-[var(--gold)]' : 'border-dashed border-[var(--ink)]/20 bg-[#fbfaf7] hover:border-[var(--gold)]'
        } ${compact ? 'items-center' : 'items-start'}`}
      >
        <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.open ? style.tile : 'bg-[#efede8] text-[var(--muted)]'}`}>
          <Icon className="h-5 w-5" strokeWidth={1.8} />
          {!item.open && (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[var(--ink)] text-white">
              <Lock className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          )}
        </span>
        <span className={`flex min-w-0 flex-1 flex-col ${compact ? '' : 'pr-7'}`}>
          <span className={`text-[var(--ink)] ${compact ? 'truncate font-bold' : `line-clamp-2 leading-snug ${brand ? 'text-[16px] font-extrabold' : 'font-bold'}`}`}>{compact ? toolTitle : item.title}</span>
          {compact && compactNote && <span className="truncate text-xs text-[var(--muted)]">{compactNote}</span>}
          {!compact && <PlanTag plan={item.plan} className="mt-1" />}
          {!compact && <span className="mt-0.5 line-clamp-3 text-xs leading-5 text-[var(--muted)]">{item.description}</span>}
          {!compact && (
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.open ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${brand ? 'bg-[var(--gold-pale)] text-[var(--ink)]' : 'bg-sky-50 text-sky-800'}`}>
                  {t('open')} <ArrowRight className="h-3 w-3" />
                </span>
              ) : (
                <>
                  <span className="rounded-full bg-[var(--gold-pale)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink)]">
                    {item.plan === 'pro' ? t('includedPro') : t('includedBase')}
                  </span>
                  {item.passPrice && <span className="text-[11px] font-semibold text-[var(--muted)]">{t('orPass', { price: item.passPrice })}</span>}
                </>
              )}
            </span>
          )}
        </span>
        {compact && (item.open ? <ArrowRight className="h-4 w-4 shrink-0 text-[var(--gold)]" /> : null)}
      </Link>
      {!compact && (
        <>
          <FavoriteStarButton toolName={item.toolName} initialIsFavorite={isFavorite} variant="light" onToggle={onToggle} />
          {item.guide && (
            <Link
              href={`/guida/${item.guide}?from=${encodeURIComponent(item.href)}`}
              aria-label={t('guideFor', { name: item.title })}
              title={t('guideFor', { name: item.title })}
              className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--gold-pale)] hover:text-[var(--ink)]"
            >
              <BookOpen className="h-4 w-4" />
            </Link>
          )}
        </>
      )}
    </div>
  )
}
