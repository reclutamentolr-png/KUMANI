'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FolderOpen, Plus, Search, Smartphone, Wallet, X, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import FavoritesPicker from './FavoritesPicker'
import { FolderOverlay, FolderPicker, FolderTile, type FolderKey } from './HomeFolders'
import { FROM_ICONS_KEY, shortServiceName } from '@/lib/homeView'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { GROUP_STYLE } from '@/lib/serviceGroups'
import type { ServiceItem } from '@/lib/servicesCatalog'

// Home a icone: come la schermata di un telefono. In alto saluto, data e
// «Cerca un servizio»; poi «I tuoi servizi» (scelti con «Aggiungi») e
// «Usati spesso», con il pallino rosso di quello che c'è da fare oggi; sotto Wallet, Documenti, Benessere e «Aggiungi». Dai servizi
// aperti da qui «‹ Home» riporta a questa schermata (ToolBackLink).
// «Usati spesso»: quanti servizi (oltre a quelli scelti a mano)
const MAX_USED = 8

type Shortcut = { key: string; href?: string; onClick?: () => void; label: string; full?: string; Icon: LucideIcon; tone: string; badge?: number }

// Toccando un'icona il servizio sa che si arriva dalle icone: «‹ Home» riporta qui
const markFromIcons = () => {
  try {
    sessionStorage.setItem(FROM_ICONS_KEY, '1')
  } catch {
    // facoltativo
  }
}

function AppIcon({ item }: { item: Shortcut }) {
  const body = (
    <>
      <span className={`flex h-14 w-14 items-center justify-center rounded-[18px] shadow-[0_6px_14px_rgba(0,0,0,0.18)] transition-transform group-active:scale-95 sm:h-16 sm:w-16 lg:h-[88px] lg:w-[88px] lg:rounded-[24px] ${item.tone}`}>
        <item.Icon className="h-6 w-6 sm:h-7 sm:w-7 lg:h-9 lg:w-9" aria-hidden />
      </span>
      {!!item.badge && (
        <span className="absolute right-1 top-0 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--background)] bg-red-600 px-1 text-[10px] font-bold text-white sm:right-3">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
      <span className="line-clamp-2 w-full hyphens-auto text-center text-[11px] font-semibold leading-tight text-inherit [overflow-wrap:anywhere] sm:text-xs lg:text-sm">{item.label}</span>
    </>
  )
  const cls = 'group relative flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 lg:gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]'
  if (!item.href)
    return (
      <button type="button" onClick={item.onClick} aria-label={item.full ?? item.label} className={cls}>
        {body}
      </button>
    )
  return (
    <Link href={item.href} onClick={markFromIcons} aria-label={item.full ?? item.label} title={item.full ?? item.label} className={cls}>
      {body}
    </Link>
  )
}

export default function IconHome({
  firstName,
  dateLabel,
  karma,
  planLabel,
  items,
  usage,
  favorites,
  badges,
  folders,
}: {
  firstName: string | null
  dateLabel: string
  karma: number
  planLabel: string
  // Tutti i servizi (getServicesCatalog)
  items: ServiceItem[]
  // Giorni di uso negli ultimi 30 giorni, per servizio
  usage: Record<string, number>
  favorites: string[]
  // Pallini: cose da fare oggi per servizio (es. agenda, bollette)
  badges: Record<string, number>
  // Categorie (servizi uniti) nella fascia in basso, come cartelle
  folders: string[]
}) {
  const t = useTranslations('homeView')
  const [query, setQuery] = useState('')
  // Preferiti aggiornati subito da «Aggiungi»; tornano a quelli del server quando cambiano
  const [favs, setFavs] = useState(favorites)
  const [serverFavs, setServerFavs] = useState(favorites)
  if (serverFavs !== favorites) {
    setServerFavs(favorites)
    setFavs(favorites)
  }
  const [picking, setPicking] = useState(false)
  // Cartella aperta e scelta delle categorie della fascia
  const [openFolder, setOpenFolder] = useState<FolderKey | null>(null)
  const [pickingFolders, setPickingFolders] = useState(false)

  const toShortcut = (item: ServiceItem): Shortcut => ({
    key: item.toolName,
    href: item.href,
    label: shortServiceName(item.title),
    full: item.title,
    Icon: marketplaceIconMap[item.iconName] ?? Smartphone,
    tone: item.open ? (item.tone ?? GROUP_STYLE[item.group].tile) : 'bg-white/80 text-[var(--muted)]',
    badge: badges[item.toolName],
  })

  // «I tuoi servizi»: tutti quelli scelti a mano (preferiti), nell'ordine in
  // cui sono stati aggiunti: i nuovi vanno in fondo (anche in una riga sotto).
  // «Usati spesso», a parte: i più aperti negli ultimi 30 giorni tra quelli
  // non scelti, così aggiungendo un servizio non ne sparisce nessuno.
  // Solo servizi che la persona può aprire.
  const { chosen, used } = useMemo(() => {
    const open = new Map(items.filter((item) => item.open).map((item) => [item.toolName, item]))
    // favorites arriva dal più recente: si gira per avere l'ordine di aggiunta
    const chosen = [...favs].reverse().map((name) => open.get(name)).filter((item): item is ServiceItem => !!item)
    const used = [...open.values()]
      .filter((item) => !favs.includes(item.toolName) && ((usage[item.toolName] ?? 0) > 0 || badges[item.toolName]))
      .sort((a, b) => (usage[b.toolName] ?? 0) - (usage[a.toolName] ?? 0) || a.title.localeCompare(b.title))
      .slice(0, MAX_USED)
    return { chosen, used }
  }, [items, usage, favs, badges])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return items.filter((item) => item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)).slice(0, 12)
  }, [items, query])

  const fixed: Shortcut[] = [
    { key: 'wallet', href: '/wallet', label: t('wallet'), Icon: Wallet, tone: 'bg-[var(--ink)] text-[var(--gold-bright)] ring-1 ring-[var(--gold)]/40' },
    { key: 'documents', href: '/documenti', label: t('documents'), Icon: FolderOpen, tone: 'bg-[var(--ink)] text-[var(--gold-bright)] ring-1 ring-[var(--gold)]/40' },
  ]
  // «Aggiungi» di «I tuoi servizi»: sceglie i singoli servizi
  const addService: Shortcut = { key: 'add-service', onClick: () => setPicking(true), label: t('add'), Icon: Plus, tone: 'border-2 border-dashed border-[var(--gold)] bg-white text-[var(--ink)] shadow-none' }
  // «Aggiungi» della fascia: sceglie le categorie (cartelle)
  const addFolder: Shortcut = { key: 'add-folder', onClick: () => setPickingFolders(true), label: t('addCategory'), Icon: Plus, tone: 'border-2 border-dashed border-[var(--gold)] bg-white text-[var(--ink)] shadow-none' }

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-b from-[#1d1b17] via-[#2a2620] to-[#2a2620] text-white shadow-[0_14px_40px_rgba(23,23,23,0.2)]" aria-labelledby="icon-home-title">
      <div className="space-y-4 p-4 sm:p-6">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--gold-bright)] first-letter:uppercase">{dateLabel}</p>
          <h2 id="icon-home-title" className="text-2xl font-extrabold leading-tight">
            {firstName ? t('helloName', { name: firstName }) : t('hello')}
          </h2>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
          <label htmlFor="icon-home-search" className="sr-only">
            {t('search')}
          </label>
          <input
            id="icon-home-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-white/60 focus:border-[var(--gold)] focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('clear')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/70 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          <Link href="/wallet" className="rounded-full bg-[var(--gold-bright)]/15 px-2.5 py-1 text-[var(--gold-bright)] hover:bg-[var(--gold-bright)]/25">
            {t('karma', { count: karma })}
          </Link>
          <Link href="/billing" className="rounded-full bg-[var(--gold-bright)]/15 px-2.5 py-1 text-[var(--gold-bright)] hover:bg-[var(--gold-bright)]/25">
            {planLabel}
          </Link>
        </div>

        {results ? (
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/70">{t('results')}</p>
            {results.length === 0 ? (
              <p className="text-sm text-white/70">{t('noResults')}</p>
            ) : (
              <div className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-6 lg:grid-cols-7">
                {results.map((item) => (
                  <AppIcon key={item.toolName} item={toShortcut(item)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/70">{t('mostUsed')}</p>
              {/* «Aggiungi» sempre per primo a sinistra, poi i servizi scelti
                  nell'ordine in cui sono stati aggiunti (i nuovi in fondo) */}
              <div className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-6 lg:grid-cols-7">
                <AppIcon item={addService} />
                {chosen.map((item) => (
                  <AppIcon key={item.toolName} item={toShortcut(item)} />
                ))}
              </div>
              {chosen.length === 0 && <p className="mt-2 text-sm text-white/70">{t('emptyChosen')}</p>}
            </div>
            {used.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/70">{t('usedOften')}</p>
                <div className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-6 lg:grid-cols-7">
                  {used.map((item) => (
                    <AppIcon key={item.toolName} item={toShortcut(item)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sempre a portata: Wallet, Documenti e le categorie scelte (cartelle), poi «Aggiungi» */}
      <div data-icon-strip className="grid grid-cols-4 gap-x-1 gap-y-3 bg-[var(--background)] px-4 pb-4 pt-4 text-[var(--ink)] sm:grid-cols-6 sm:px-6 lg:grid-cols-8">
        {fixed.map((item) => (
          <AppIcon key={item.key} item={item} />
        ))}
        {folders.map((hub) => (
          <FolderTile key={hub} hub={hub as FolderKey} items={items} onOpen={() => setOpenFolder(hub as FolderKey)} />
        ))}
        <AppIcon item={addFolder} />
      </div>
      {picking && <FavoritesPicker items={items} favorites={favs} onChange={setFavs} onClose={() => setPicking(false)} />}
      {openFolder && <FolderOverlay hub={openFolder} items={items} onClose={() => setOpenFolder(null)} />}
      {pickingFolders && <FolderPicker items={items} folders={folders} onClose={() => setPickingFolders(false)} />}
    </section>
  )
}
