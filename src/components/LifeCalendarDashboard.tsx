'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { useRouter } from 'next/navigation'
import { Search, PlusCircle, CalendarClock, Archive, X } from 'lucide-react'
import { deleteProfile } from '@/app/actions/lifeCalendar'
import LifeCalendarItemCard from '@/components/LifeCalendarItemCard'
import { getItemStatus, CATEGORIES, type Category, type ItemStatus } from '@/lib/lifeCalendar'
import { askConfirm } from '@/lib/confirm'

type Item = {
  id: string
  title: string
  category: string
  due_date: string
  recurrence: string
  profile_id: string | null
  profile_name?: string | null
}

type Profile = { id: string; name: string }

const STATUS_ACCENT: Record<ItemStatus, string> = {
  regular: 'bg-green-500',
  upcoming: 'bg-[var(--gold-bright)]',
  urgent: 'bg-amber-600',
  expired: 'bg-red-600',
}

type ArchivedItem = { id: string; title: string; category: string; due_date: string }

export default function LifeCalendarDashboard({
  items,
  profiles,
  archived = [],
}: {
  items: Item[]
  profiles: Profile[]
  archived?: ArchivedItem[]
}) {
  const t = useTranslations('lifeCalendar')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all')
  const [profileFilter, setProfileFilter] = useState<string | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all')
  const router = useRouter()
  const [showArchive, setShowArchive] = useState(false)
  const [manageProfiles, setManageProfiles] = useState(false)

  const removeProfile = async (profile: Profile) => {
    if (!(await askConfirm(t('deleteProfileConfirm', { name: profile.name })))) return
    await deleteProfile(profile.id)
    router.refresh()
  }

  const summary = useMemo(() => {
    const counts: Record<ItemStatus, number> = { regular: 0, upcoming: 0, urgent: 0, expired: 0 }
    items.forEach((item) => {
      counts[getItemStatus(item.due_date)]++
    })
    return counts
  }, [items])

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => (search ? item.title.toLowerCase().includes(search.toLowerCase()) : true))
      .filter((item) => (categoryFilter === 'all' ? true : item.category === categoryFilter))
      .filter((item) => (profileFilter === 'all' ? true : item.profile_id === profileFilter))
      .filter((item) => (statusFilter === 'all' ? true : getItemStatus(item.due_date) === statusFilter))
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
  }, [items, search, categoryFilter, profileFilter, statusFilter])

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(['regular', 'upcoming', 'urgent', 'expired'] as ItemStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            className={`bg-white rounded-2xl border p-4 text-left shadow-sm transition-all ${
              statusFilter === status ? 'border-[var(--gold)] ring-2 ring-[var(--gold)]/30' : 'border-[var(--gold)]/25 hover:border-[var(--gold)]/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-2xl font-bold text-[var(--ink)]">{summary[status]}</div>
              <span className={`h-3 w-3 rounded-full shrink-0 ${STATUS_ACCENT[status]}`} />
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">{t(`status_${status}`)}</div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--gold)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as Category | 'all')}
            className="px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm bg-white"
          >
            <option value="all">{t('allCategories')}</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`category_${category}`)}
              </option>
            ))}
          </select>
          {profiles.length > 0 && (
            <button
              type="button"
              onClick={() => setManageProfiles((v) => !v)}
              className="px-3 py-2 border-2 border-[var(--gold)]/40 rounded-lg text-sm font-medium text-[var(--ink)] hover:border-[var(--gold)] hover:bg-[var(--gold-pale)] bg-white transition-colors"
            >
              {t('manageProfiles')}
            </button>
          )}
          {profiles.length > 0 && (
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm bg-white"
            >
              <option value="all">{t('allProfiles')}</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {manageProfiles && profiles.length > 0 && (
          <div className="mb-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)] p-3">
            <p className="mb-2 text-xs text-[var(--ink)]/80">{t('manageProfilesHint')}</p>
            <div className="flex flex-wrap gap-2">
              {profiles.map((profile) => (
                <span key={profile.id} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-[var(--ink)] border border-[var(--gold)]/30">
                  {profile.name}
                  <button type="button" onClick={() => removeProfile(profile)} className="text-gray-400 hover:text-red-600" aria-label={t('delete')}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {filteredItems.length > 0 ? (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <LifeCalendarItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-xl border border-dashed border-[var(--gold)]/40 text-[var(--muted)]">
            <CalendarClock className="w-12 h-12 mx-auto mb-4 text-[var(--gold)]" />
            <p>{items.length === 0 ? t('noItemsYet') : t('noResults')}</p>
          </div>
        )}
      </div>

      {archived.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--gold)]/25 shadow-sm p-5">
          <button type="button" onClick={() => setShowArchive((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left font-semibold text-[var(--ink)]">
            <span className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-[var(--gold)]" /> {t('archiveTitle', { count: archived.length })}
            </span>
            <span className="shrink-0 text-sm font-semibold text-[var(--gold)]">{showArchive ? t('hide') : t('show')}</span>
          </button>
          {showArchive && (
            <ul className="mt-3 divide-y divide-[var(--gold)]/15">
              {archived.map((item) => (
                <li key={item.id}>
                  <Link href={`/marketplace/life-calendar/${item.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-[var(--gold)]">
                    <span className="truncate text-[var(--ink)]">{item.title}</span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {t(`category_${item.category}`)} · {new Date(`${item.due_date}T12:00:00Z`).toLocaleDateString('it-IT')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Link
        href="/marketplace/life-calendar/new"
        data-fab className="fixed bottom-6 right-6 z-10 flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-full font-bold shadow-lg hover:brightness-105 hover:shadow-xl hover:-translate-y-0.5 transition-all"
      >
        <PlusCircle className="w-5 h-5" />
        {t('newItem')}
      </Link>
    </div>
  )
}
