'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Copy,
  Crown,
  FileBadge,
  ListChecks,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import {
  addChecklistItem,
  deleteChecklistItem,
  deleteTrip,
  getTripBundle,
  removeTripMember,
  rotateInviteCode,
  updateChecklistItem,
  updateTrip,
  type TripBundle,
} from '@/app/actions/travel'
import {
  docStatus,
  formatTripDates,
  itineraryDays,
  mapUrl,
  sortActivities,
  tripPhase,
  type DocType,
  type TripActivity,
  type TripChecklistItem,
} from '@/lib/travel'
import TravelTripForm from './TravelTripForm'
import TravelActivityForm from './TravelActivityForm'
import TravelBudget from './TravelBudget'
import TravelDocuments from './TravelDocuments'

type Bundle = TripBundle
type Tab = 'itinerary' | 'budget' | 'checklist' | 'documents' | 'members'

// Scheda del viaggio: intestazione con conto alla rovescia e invito, poi
// itinerario giorno per giorno, checklist con responsabili e membri.
// Si aggiorna da sola quando un altro membro cambia qualcosa.
export default function TravelWorkspace({
  initial,
  today,
  siteUrl,
  myReferral,
  myUserId,
  hasLifeCalendar,
}: {
  initial: Bundle
  today: string
  siteUrl: string
  myReferral: string | null
  myUserId: string
  hasLifeCalendar: boolean
}) {
  const t = useTranslations('travel')
  const locale = useLocale()
  const router = useRouter()
  const [bundle, setBundle] = useState<Bundle>(initial)
  const [tab, setTab] = useState<Tab>('itinerary')
  const [sheet, setSheet] = useState<'invite' | 'settings' | null>(null)
  const [activityForm, setActivityForm] = useState<{ day: string; activity: TripActivity | null } | null>(null)
  const [newItem, setNewItem] = useState({ title: '', assignedTo: '' })
  const [copied, setCopied] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const { detail, activities, checklist, expenses, settlements, documents } = bundle
  const tripId = initial.detail.id
  const homePath = `${locale === 'it' ? '' : `/${locale}`}/viaggi`

  const refresh = useCallback(async () => {
    const next = await getTripBundle(tripId)
    if (next) setBundle(next)
    else router.push(homePath)
  }, [tripId, router, homePath])

  // Tempo reale sul canale privato del viaggio + controllo di riserva
  useEffect(() => {
    const supabase = createClient()
    let active = true
    ;(async () => {
      await supabase.realtime.setAuth()
      if (!active) return
      channelRef.current = supabase
        .channel(`trip:${tripId}`, { config: { private: true } })
        .on('broadcast', { event: '*' }, () => refresh())
        .subscribe()
    })()
    const fallback = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 60000)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      clearInterval(fallback)
      document.removeEventListener('visibilitychange', onVisible)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [tripId, refresh])

  const phase = tripPhase(detail, today)
  const myDocs = documents.filter((d) => d.member_id === detail.my_member_id)
  const myDocProblems =
    phase.phase === 'ended'
      ? 0
      : ((detail.required_docs ?? []) as DocType[]).filter((type) => !myDocs.some((d) => d.doc_type === type)).length +
        myDocs.filter((d) => docStatus(d, detail, today) !== 'ok').length
  const dates = formatTripDates(detail, locale)
  const memberName = (id: string | null) => detail.members.find((m) => m.id === id)?.name ?? null
  const myMemberId = detail.my_member_id
  // Costi delle attività nella valuta del viaggio (come nel budget)
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: detail.base_currency || 'EUR' }).format(value)

  // Invito: link con il codice invito KUMANI di chi condivide
  const inviteUrl = `${siteUrl}/viaggi/invito/${detail.invite_code}${myReferral ? `?ref=${encodeURIComponent(myReferral)}` : ''}`
  const inviteText = t('inviteMessage', { title: detail.title, code: detail.invite_code, url: inviteUrl })

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard non disponibile: il link resta visibile da copiare a mano
    }
  }

  const run = async (action: () => Promise<{ success: boolean }>) => {
    try {
      const result = await action()
      if (!result.success) alert(t('error_saveError'))
    } finally {
      await refresh()
    }
  }

  const phaseBadge =
    phase.phase === 'upcoming'
      ? phase.days === 0
        ? t('departsToday')
        : t('departsIn', { count: phase.days })
      : phase.phase === 'ongoing'
        ? t('ongoingDay', { day: phase.day, total: phase.total })
        : phase.phase === 'ended'
          ? t('ended')
          : t('noDates')

  // ---------------------------------------------------------------- Itinerario
  const sorted = sortActivities(activities)
  const days = itineraryDays(detail, activities)
  const totalCost = activities.reduce((sum, a) => sum + (a.cost_amount ?? 0), 0)
  const dayLabel = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const dayNumber = (day: string) => {
    if (!detail.starts_on || day < detail.starts_on || (detail.ends_on && day > detail.ends_on)) return null
    return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${detail.starts_on}T12:00:00Z`)) / 86400000) + 1
  }

  const itinerary = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">
          {t('activitiesCount', { count: activities.length })}
          {totalCost > 0 && ` · ${t('estimatedCost', { amount: money(totalCost) })}`}
        </p>
        {detail.can_edit && (
          <button
            type="button"
            onClick={() => setActivityForm({ day: days.includes(today) ? today : days[0] ?? today, activity: null })}
            className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> {t('addActivity')}
          </button>
        )}
      </div>
      {days.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-white/70 p-8 text-center text-[var(--muted)]">{t('itineraryEmpty')}</div>
      ) : (
        days.map((day) => {
          const dayActivities = sorted.filter((a) => a.day === day)
          const number = dayNumber(day)
          return (
            <section key={day} className={`rounded-2xl border bg-white p-4 ${day === today ? 'border-[var(--gold)]' : 'border-gray-200'}`}>
              <header className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">{number ? t('dayNumber', { number }) : t('extraDay')}</p>
                  <h3 className="font-bold capitalize text-[var(--ink)]">{dayLabel(day)}</h3>
                </div>
                {detail.can_edit && (
                  <button
                    type="button"
                    onClick={() => setActivityForm({ day, activity: null })}
                    className="rounded-lg p-2 text-[var(--muted)] hover:bg-gray-100 hover:text-[var(--ink)]"
                    aria-label={t('addActivity')}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </header>
              {dayActivities.length === 0 ? (
                <p className="text-sm text-gray-400">{t('dayEmpty')}</p>
              ) : (
                <ol className="space-y-2">
                  {dayActivities.map((activity) => {
                    const link = mapUrl(activity)
                    const responsible = memberName(activity.responsible_id)
                    return (
                      <li key={activity.id} className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                        <span className="w-12 shrink-0 pt-0.5 text-sm font-bold text-[var(--ink)]">{activity.time ?? '—'}</span>
                        <button
                          type="button"
                          disabled={!detail.can_edit}
                          onClick={() => setActivityForm({ day, activity })}
                          className="min-w-0 flex-1 text-left disabled:cursor-default"
                        >
                          <p className="font-semibold text-[var(--ink)]">{activity.title}</p>
                          {activity.place && <p className="truncate text-sm text-[var(--muted)]">{activity.place}</p>}
                          {activity.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{activity.notes}</p>}
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                            {responsible && <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700">{responsible}</span>}
                            {activity.cost_amount != null && activity.cost_amount > 0 && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">{money(activity.cost_amount)}</span>
                            )}
                          </div>
                        </button>
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--gold)] shadow-sm hover:text-[var(--ink)]"
                            aria-label={t('openMap')}
                          >
                            <MapPin className="h-4 w-4" />
                          </a>
                        )}
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          )
        })
      )}
    </div>
  )

  // ---------------------------------------------------------------- Checklist
  const doneCount = checklist.filter((item) => item.done).length
  const canTick = (item: TripChecklistItem) => detail.can_edit || item.assigned_to === myMemberId

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.title.trim()) return
    const values = newItem
    setNewItem({ title: '', assignedTo: '' })
    await run(() => addChecklistItem(tripId, values.title, values.assignedTo))
  }

  const checklistView = (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[var(--ink)]">
          <span>{t('checklistProgress', { done: doneCount, total: checklist.length })}</span>
          <span>{checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-emerald-500 transition-all" style={{ width: `${checklist.length ? (doneCount / checklist.length) * 100 : 0}%` }} />
        </div>
      </div>
      <ul className="space-y-2">
        {checklist.map((item) => (
          <li key={item.id} className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 ${item.done ? 'border-emerald-200' : 'border-gray-200'}`}>
            <button
              type="button"
              disabled={!canTick(item)}
              onClick={() => run(() => updateChecklistItem(item.id, { done: !item.done }))}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'} disabled:opacity-50`}
              aria-label={item.title}
            >
              {item.done && <Check className="h-4 w-4" />}
            </button>
            <span className={`min-w-0 flex-1 text-sm ${item.done ? 'text-gray-400 line-through' : 'text-[var(--ink)]'}`}>{item.title}</span>
            {detail.can_edit ? (
              <select
                value={item.assigned_to ?? ''}
                onChange={(e) => run(() => updateChecklistItem(item.id, { assignedTo: e.target.value || null }))}
                className={`max-w-[9rem] rounded-lg border px-2 py-1 text-xs font-semibold ${item.assigned_to ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}
              >
                <option value="">{t('nobody')}</option>
                {detail.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.assigned_to ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                {memberName(item.assigned_to) ?? t('nobody')}
              </span>
            )}
            {detail.can_edit && (
              <button
                type="button"
                onClick={() => confirm(t('deleteItemConfirm', { name: item.title })) && run(() => deleteChecklistItem(item.id))}
                className="rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
                aria-label={t('delete')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {checklist.length === 0 && <p className="text-center text-sm text-[var(--muted)]">{t('checklistEmpty')}</p>}
      {detail.can_edit && (
        <form onSubmit={addItem} className="flex flex-col gap-2 rounded-2xl border border-[var(--gold)]/30 bg-white p-3 sm:flex-row">
          <input
            value={newItem.title}
            onChange={(e) => setNewItem((v) => ({ ...v, title: e.target.value }))}
            maxLength={120}
            placeholder={t('newItemPlaceholder')}
            className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2 focus:border-[var(--gold)] focus:outline-none"
          />
          <select
            value={newItem.assignedTo}
            onChange={(e) => setNewItem((v) => ({ ...v, assignedTo: e.target.value }))}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('nobody')}</option>
            {detail.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="submit" className="flex items-center justify-center gap-1 rounded-xl bg-[var(--ink)] px-4 py-2 font-semibold text-white">
            <Plus className="h-4 w-4" /> {t('add')}
          </button>
        </form>
      )}
    </div>
  )

  // ---------------------------------------------------------------- Membri
  const membersView = (
    <div className="space-y-3">
      <ul className="space-y-2">
        {detail.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-bold text-[var(--gold-bright)]">
              {m.name.charAt(0).toUpperCase()}
            </span>
            <span className="flex-1 font-semibold text-[var(--ink)]">
              {m.name} {m.is_me && <span className="text-sm font-normal text-[var(--muted)]">({t('me')})</span>}
            </span>
            {m.role === 'owner' ? (
              <span className="flex items-center gap-1 rounded-full bg-[var(--gold-pale)] px-2 py-0.5 text-xs font-bold text-[var(--ink)]">
                <Crown className="h-3 w-3" /> {t('organizer')}
              </span>
            ) : (
              detail.is_owner && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(t('removeMemberConfirm', { name: m.name }))) return
                    const result = await removeTripMember(m.id)
                    if (!result.success) alert(t(`error_${result.error}`))
                    await refresh()
                  }}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  aria-label={t('removeMember')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setSheet('invite')}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--gold)]/50 py-3 font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
      >
        <UserPlus className="h-5 w-5" /> {t('inviteFriends')}
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Intestazione */}
      <div className="relative overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
        <div className="relative flex items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-4xl">{detail.emoji}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold sm:text-3xl">{detail.title}</h1>
            <p className="mt-1 text-white/70">{[detail.destination, dates].filter(Boolean).join(' · ') || t('noDates')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${
                  phase.phase === 'ongoing' ? 'bg-emerald-500 text-white' : phase.phase === 'upcoming' ? 'bg-[var(--gold)] text-[var(--ink)]' : 'bg-white/15 text-white'
                }`}
              >
                {phaseBadge}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm">
                <Users className="h-4 w-4" /> {t('membersCount', { count: detail.members.length })}
              </span>
            </div>
          </div>
          <button type="button" onClick={() => setSheet('settings')} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label={t('settings')}>
            <Settings className="h-5 w-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setSheet('invite')}
          className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] py-3 font-bold text-[var(--ink)] sm:w-auto sm:px-6"
        >
          <UserPlus className="h-5 w-5" /> {t('inviteFriends')}
        </button>
      </div>

      {/* Schede */}
      {/* Avviso documenti: i miei mancanti, scaduti o in scadenza */}
      {myDocProblems > 0 && (
        <button
          type="button"
          onClick={() => setTab('documents')}
          className="flex w-full items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-700"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" /> {t('docsAlert', { count: myDocProblems })}
        </button>
      )}

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-xl border border-[var(--gold)]/25 bg-white p-1 sm:w-full">
          {(
            [
              ['itinerary', CalendarDays, t('tabItinerary')],
              ['budget', Wallet, t('tabBudget')],
              ['checklist', ListChecks, `${t('tabChecklist')} ${checklist.length ? `${doneCount}/${checklist.length}` : ''}`],
              ['documents', FileBadge, t('tabDocuments')],
              ['members', Users, t('tabMembers')],
            ] as const
          ).map(([key, Icon, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${tab === key ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)]'}`}
            >
              <Icon className="h-4 w-4" /> {text}
            </button>
          ))}
        </div>
      </div>

      {tab === 'itinerary' ? (
        itinerary
      ) : tab === 'budget' ? (
        <TravelBudget detail={detail} expenses={expenses} settlements={settlements} myUserId={myUserId} today={today} onChanged={refresh} />
      ) : tab === 'checklist' ? (
        checklistView
      ) : tab === 'documents' ? (
        <TravelDocuments detail={detail} documents={documents} today={today} hasLifeCalendar={hasLifeCalendar} onChanged={refresh} />
      ) : (
        membersView
      )}

      {!detail.can_edit && <p className="text-center text-xs text-[var(--muted)]">{t('readOnlyNote')}</p>}

      {/* Invito */}
      {sheet === 'invite' && (
        <Sheet title={t('inviteFriends')} onClose={() => setSheet(null)}>
          <p className="mb-4 text-sm text-gray-600">{t('inviteHint')}</p>
          <div className="mb-4 rounded-2xl bg-[var(--ink)] p-4 text-center text-white">
            <p className="text-xs uppercase tracking-widest text-white/60">{t('inviteCode')}</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-[var(--gold-bright)]">{detail.invite_code}</p>
          </div>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 font-bold text-white"
          >
            <MessageCircle className="h-5 w-5" /> {t('shareWhatsapp')}
          </a>
          <button type="button" onClick={copyInvite} className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 font-semibold text-[var(--ink)]">
            {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />} {copied ? t('copied') : t('copyLink')}
          </button>
          <p className="mt-3 break-all text-center text-xs text-[var(--muted)]">{inviteUrl}</p>
          {detail.is_owner && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(t('rotateCodeConfirm'))) return
                const result = await rotateInviteCode(detail.id)
                if (!result.success) alert(t(`error_${result.error}`))
                await refresh()
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <RefreshCw className="h-4 w-4" /> {t('rotateCode')}
            </button>
          )}
        </Sheet>
      )}

      {/* Impostazioni */}
      {sheet === 'settings' && (
        <Sheet title={detail.is_owner ? t('editTrip') : t('settings')} onClose={() => setSheet(null)}>
          {detail.is_owner ? (
            <>
              <TravelTripForm
                mode="edit"
                initial={{
                  title: detail.title,
                  destination: detail.destination ?? '',
                  startsOn: detail.starts_on ?? '',
                  endsOn: detail.ends_on ?? '',
                  emoji: detail.emoji,
                  membersCanEdit: detail.members_can_edit,
                  baseCurrency: detail.base_currency,
                }}
                currencyLocked={expenses.length > 0}
                onSubmit={async (values) => {
                  const result = await updateTrip(tripId, values)
                  if (!result.success) return t(`error_${result.error}`)
                  setSheet(null)
                  await refresh()
                  return null
                }}
              />
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(t('deleteTripConfirm', { name: detail.title }))) return
                  const result = await deleteTrip(tripId)
                  if (result.success) router.push(homePath)
                  else alert(t('error_saveError'))
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> {t('deleteTrip')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(t('leaveConfirm', { name: detail.title }))) return
                const result = await removeTripMember(myMemberId)
                if (result.success) router.push(homePath)
                else alert(t(`error_${result.error}`))
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3 font-semibold text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> {t('leaveTrip')}
            </button>
          )}
        </Sheet>
      )}

      {/* Attività */}
      {activityForm && (
        <Sheet title={activityForm.activity ? t('editActivity') : t('addActivity')} onClose={() => setActivityForm(null)}>
          <TravelActivityForm
            tripId={tripId}
            day={activityForm.day}
            activity={activityForm.activity}
            members={detail.members}
            onDone={async () => {
              setActivityForm(null)
              await refresh()
            }}
          />
        </Sheet>
      )}
    </div>
  )
}
