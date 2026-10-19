'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  BookUser,
  Briefcase,
  CalendarClock,
  Check,
  Dices,
  Flower2,
  HeartHandshake,
  House,
  Lock,
  PanelsTopLeft,
  PiggyBank,
  Plane,
  Plus,
  QrCode,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
  Signature,
  Smartphone,
  Store,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { setHomeFolders } from '@/app/actions/homeView'
import { FROM_ICONS_KEY, MAX_HOME_FOLDERS, shortServiceName } from '@/lib/homeView'
import { COMMUNITY_FOLDER, COMMUNITY_TONE } from '@/lib/communityItems'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { GROUP_STYLE, type ServiceGroup } from '@/lib/serviceGroups'
import { HUB_GROUP, HUB_ICON_NAME, HUB_TABS, SERVICE_HUBS, type ServiceHub } from '@/lib/serviceHubs'
import type { ServiceItem } from '@/lib/servicesCatalog'

// Home a icone: le categorie (servizi uniti) nella fascia in basso, come le
// cartelle del telefono. L'icona mostra fino a 4 mini icone dei servizi che
// contiene; toccandola si apre sopra la pagina con le icone di quei servizi.
// «Aggiungi» della fascia sceglie quali categorie tenere.
const HUB_ICON: Record<string, LucideIcon> = {
  ScanEye,
  ShieldCheck,
  ShieldAlert,
  Flower2,
  Dices,
  QrCode,
  PiggyBank,
  Briefcase,
  BookUser,
  Signature,
  Store,
  PanelsTopLeft,
  CalendarClock,
  House,
  Plane,
  HeartHandshake,
}

export type FolderEntry = { key: string; href: string; label: string; Icon: LucideIcon; locked: boolean }
// Una cartella: un servizio unito oppure la Community (sue sezioni)
export type FolderKey = ServiceHub | typeof COMMUNITY_FOLDER

const toneOf = (hub: FolderKey) => (hub === COMMUNITY_FOLDER ? COMMUNITY_TONE : (GROUP_STYLE[HUB_GROUP[hub] as ServiceGroup]?.tile ?? 'bg-white text-[var(--ink)]'))
const iconOf = (hub: FolderKey): LucideIcon => (hub === COMMUNITY_FOLDER ? Users : (HUB_ICON[HUB_ICON_NAME[hub]] ?? Smartphone))

// Nome della cartella: «KUMANI Benessere» → «Benessere»; la Community col suo nome
function useFolderTitle() {
  const t = useTranslations('serviceHubs')
  const tt = useTranslations('toolTiers')
  return (hub: FolderKey) => (hub === COMMUNITY_FOLDER ? tt('communityTitle') : t(`${hub}.title`).replace(/^KUMANI\s+/, ''))
}

// Le schede di una categoria, solo quelle accese (lo strumento c'è nell'elenco)
export function folderEntries(hub: FolderKey, items: ServiceItem[], tab: (key: string) => string): FolderEntry[] {
  // Community: le sue sezioni (bloccate: si sbloccano col piano)
  if (hub === COMMUNITY_FOLDER)
    return items
      .filter((item) => item.community)
      .map((item) => ({ key: item.toolName, href: item.open ? item.href : '/billing', label: shortServiceName(item.title), Icon: marketplaceIconMap[item.iconName] ?? Users, locked: !item.open }))
  const byTool = new Map(items.map((item) => [item.toolName, item]))
  const HubIcon = HUB_ICON[HUB_ICON_NAME[hub]] ?? Smartphone
  return HUB_TABS[hub].flatMap((t) => {
    const item = t.tool ? byTool.get(t.tool) : undefined
    if (t.tool && !item) return []
    return [
      {
        key: t.key,
        href: t.href,
        label: tab(`${hub}.tab_${t.key}`),
        Icon: item ? (marketplaceIconMap[item.iconName] ?? HubIcon) : HubIcon,
        locked: item ? !item.open : false,
      },
    ]
  })
}

const markFromIcons = () => {
  try {
    sessionStorage.setItem(FROM_ICONS_KEY, '1')
  } catch {
    // facoltativo
  }
}

export function FolderTile({ hub, items, onOpen }: { hub: FolderKey; items: ServiceItem[]; onOpen: () => void }) {
  const t = useTranslations('serviceHubs')
  const titleOf = useFolderTitle()
  const entries = folderEntries(hub, items, t).slice(0, 4)
  const tone = toneOf(hub)
  return (
    <button type="button" onClick={onOpen} aria-label={titleOf(hub)} className="group flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 lg:gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
      <span className="grid h-14 w-14 grid-cols-2 grid-rows-2 gap-1 rounded-[18px] border border-[var(--gold)]/25 bg-[var(--ink)]/[0.06] p-1.5 shadow-[0_6px_14px_rgba(0,0,0,0.1)] transition-transform group-active:scale-95 sm:h-16 sm:w-16 lg:h-[88px] lg:w-[88px] lg:gap-1.5 lg:rounded-[24px] lg:p-2">
        {entries.map((entry) => (
          <span key={entry.key} className={`flex items-center justify-center rounded-md ${tone}`}>
            <entry.Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-5 lg:w-5" aria-hidden />
          </span>
        ))}
      </span>
      <span className="line-clamp-2 w-full hyphens-auto text-center text-[11px] font-semibold leading-tight [overflow-wrap:anywhere] sm:text-xs lg:text-sm">{titleOf(hub)}</span>
    </button>
  )
}

export function FolderOverlay({ hub, items, onClose }: { hub: FolderKey; items: ServiceItem[]; onClose: () => void }) {
  const t = useTranslations('serviceHubs')
  const titleOf = useFolderTitle()
  const tv = useTranslations('homeView')
  const entries = folderEntries(hub, items, t)
  const tone = toneOf(hub)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="folder-title" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[28px] bg-[var(--paper)] p-5 text-[var(--ink)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="folder-title" className="text-lg font-extrabold">
            {titleOf(hub)}
          </h2>
          <button type="button" onClick={onClose} aria-label={tv('pickerDone')} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
          {entries.map((entry) => (
            <Link key={entry.key} href={entry.href} onClick={markFromIcons} className="group relative flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1">
              <span className={`relative flex h-14 w-14 items-center justify-center rounded-[18px] shadow-[0_6px_14px_rgba(0,0,0,0.12)] transition-transform group-active:scale-95 ${tone} ${entry.locked ? 'opacity-60' : ''}`}>
                <entry.Icon className="h-6 w-6" aria-hidden />
                {entry.locked && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--paper)] bg-[var(--ink)] text-[var(--gold-bright)]">
                    <Lock className="h-2.5 w-2.5" aria-label={t('locked')} />
                  </span>
                )}
              </span>
              <span className="line-clamp-2 w-full hyphens-auto text-center text-[11px] font-semibold leading-tight [overflow-wrap:anywhere]">{entry.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// «Aggiungi» della fascia: quali categorie tenere come cartelle
export function FolderPicker({ items, folders, onClose }: { items: ServiceItem[]; folders: string[]; onClose: () => void }) {
  const t = useTranslations('serviceHubs')
  const tv = useTranslations('homeView')
  const titleOf = useFolderTitle()
  const router = useRouter()
  const [chosen, setChosen] = useState(folders)
  const [changed, setChanged] = useState(false)
  const available = useMemo(() => ([...SERVICE_HUBS, COMMUNITY_FOLDER] as FolderKey[]).filter((hub) => folderEntries(hub, items, t).length > 0), [items, t])

  const close = () => {
    if (changed) router.refresh()
    onClose()
  }

  const toggle = async (hub: string) => {
    const on = chosen.includes(hub)
    if (!on && chosen.length >= MAX_HOME_FOLDERS) return
    const next = on ? chosen.filter((h) => h !== hub) : [...chosen, hub]
    setChosen(next)
    setChanged(true)
    if (!(await setHomeFolders(next))) setChosen(chosen)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="folders-title" onClick={close}>
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-3xl bg-white text-[var(--ink)] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--gold)]/20 p-5 pb-4">
          <div>
            <h2 id="folders-title" className="text-lg font-bold">
              {tv('foldersTitle')}
            </h2>
            <p className="text-sm text-[var(--muted)]">{tv('foldersHint', { max: MAX_HOME_FOLDERS })}</p>
          </div>
          <button type="button" onClick={close} aria-label={tv('pickerDone')} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {available.map((hub) => {
            const on = chosen.includes(hub)
            const HubIcon = iconOf(hub)
            const names = folderEntries(hub, items, t).map((entry) => entry.label).join(' · ')
            return (
              <li key={hub}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(hub)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${on ? 'border-[var(--gold)] bg-[var(--gold-pale)]/60' : 'border-transparent hover:bg-[var(--gold-pale)]/40'}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneOf(hub)}`}>
                    <HubIcon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{titleOf(hub)}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">{names}</span>
                  </span>
                  <span className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold ${on ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-white text-[var(--ink)] ring-1 ring-[var(--gold)]/40'}`}>
                    {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {on ? tv('pickerAdded') : tv('pickerAdd')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-[var(--gold)]/20 p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <button type="button" onClick={close} className="w-full rounded-xl bg-[var(--ink)] py-3 text-sm font-bold text-white hover:bg-[var(--ink-soft)]">
            {tv('pickerDone')}
          </button>
        </div>
      </div>
    </div>
  )
}
