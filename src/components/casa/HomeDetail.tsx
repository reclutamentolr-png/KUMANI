'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarClock, FileText, House, MapPin, Pencil, Plug, Trash2, Zap, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { deleteHome } from '@/app/actions/casa'
import { CASA_TABS, type CasaAppliance, type CasaBill, type CasaDeadline, type CasaDocument, type CasaHome, type CasaTab, type CasaUtility } from '@/lib/casa'
import { askConfirm } from '@/lib/confirm'
import { defaultLocale } from '../../../i18n'
import DeadlinesPanel from '@/components/casa/DeadlinesPanel'
import UtilitiesPanel from '@/components/casa/UtilitiesPanel'
import AppliancesPanel from '@/components/casa/AppliancesPanel'
import DocumentsPanel from '@/components/casa/DocumentsPanel'

const TAB_ICONS: Record<CasaTab, LucideIcon> = { deadlines: CalendarClock, utilities: Zap, appliances: Plug, documents: FileText }

export default function HomeDetail({
  home,
  deadlines,
  utilities,
  appliances,
  documents,
  bills,
  linkedBillIds,
  fileUrls,
  today,
  spendlyAvailable,
  initialTab,
}: {
  home: CasaHome
  deadlines: CasaDeadline[]
  utilities: CasaUtility[]
  appliances: CasaAppliance[]
  documents: CasaDocument[]
  bills: CasaBill[]
  linkedBillIds: string[]
  fileUrls: Record<string, string>
  today: string
  spendlyAvailable: boolean
  initialTab: CasaTab
}) {
  const t = useTranslations('casa')
  const router = useRouter()
  const locale = useLocale()
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const [tab, setTab] = useState<CasaTab>(initialTab)
  const [deleting, setDeleting] = useState(false)

  const counts: Record<CasaTab, number> = { deadlines: deadlines.length, utilities: utilities.length, appliances: appliances.length, documents: documents.length }
  const overdue = deadlines.filter((d) => d.due_date < today).length

  const choose = (next: CasaTab) => {
    setTab(next)
    // La scheda resta nell'indirizzo (tornando indietro si riapre quella)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    window.history.replaceState(window.history.state, '', url)
  }

  const remove = async () => {
    if (!(await askConfirm(t('deleteHomeConfirm', { name: home.name })))) return
    setDeleting(true)
    const result = await deleteHome(home.id)
    if (!result.success) {
      setDeleting(false)
      return
    }
    router.push(`${prefix}/marketplace/casa`)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-6">
        <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
            <House className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-bright)]">{t(`homeKind_${home.kind}`)}</p>
            <h1 className="truncate text-2xl font-bold sm:text-3xl">{home.name}</h1>
            {home.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(home.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-white/75 hover:text-white"
              >
                <MapPin className="h-4 w-4" /> {home.address}
              </a>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Link href={`/marketplace/casa/${home.id}/edit`} aria-label={t('editHome')} className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white">
              <Pencil className="h-5 w-5" />
            </Link>
            <button type="button" onClick={remove} disabled={deleting} aria-label={t('deleteHome')} className="rounded-lg p-2 text-white/80 hover:bg-red-500/20 hover:text-red-200 disabled:opacity-50">
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
        {overdue > 0 && <p className="relative mt-4 rounded-xl bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-100">{t('overdueBanner', { count: overdue })}</p>}
        {home.notes && <p className="relative mt-4 whitespace-pre-line text-sm text-white/70">{home.notes}</p>}
      </section>

      <div role="tablist" aria-label={t('sectionsLabel')} className="grid grid-cols-4 gap-1 rounded-2xl border border-[var(--gold)]/25 bg-white p-1 shadow-sm">
        {CASA_TABS.map((key) => {
          const Icon = TAB_ICONS[key]
          const active = tab === key
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => choose(key)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-bold transition sm:flex-row sm:justify-center sm:gap-1.5 sm:text-sm ${
                active ? 'bg-[var(--ink)] text-[var(--gold-bright)] shadow' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{t(`tab_${key}`)}</span>
              {counts[key] > 0 && <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/15' : 'bg-gray-100'}`}>{counts[key]}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'deadlines' && <DeadlinesPanel homeId={home.id} deadlines={deadlines} today={today} />}
      {tab === 'utilities' && <UtilitiesPanel homeId={home.id} utilities={utilities} bills={bills} linkedBillIds={linkedBillIds} today={today} spendlyAvailable={spendlyAvailable} />}
      {tab === 'appliances' && <AppliancesPanel homeId={home.id} appliances={appliances} fileUrls={fileUrls} today={today} />}
      {tab === 'documents' && <DocumentsPanel homeId={home.id} documents={documents} fileUrls={fileUrls} today={today} />}
    </div>
  )
}
