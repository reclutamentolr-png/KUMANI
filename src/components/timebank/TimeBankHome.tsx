'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  Flag,
  HandHeart,
  Hourglass,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Video,
  XCircle,
} from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import VerificationSetup, { type VerificationStatus } from '@/components/verification/VerificationSetup'
import {
  cancelTimebankExchange,
  closeTimebankPost,
  confirmTimebankExchange,
  disputeTimebankExchange,
  getTimebankMy,
  listTimebankBoard,
  listTimebankMessages,
  reportTimebank,
  respondTimebankExchange,
  sendTimebankMessage,
} from '@/app/actions/timebank'
import {
  TIMEBANK_CATEGORIES,
  TIMEBANK_CATEGORY_EMOJI,
  formatHours,
  type TimebankExchange,
  type TimebankMessage,
  type TimebankMy,
  type TimebankPost,
  type TimebankStatus,
} from '@/lib/timebank'
import { PostForm, ProfileForm, ProposeForm, inputClass } from './TimeBankForms'

type SheetState =
  | { kind: 'verify' }
  | { kind: 'profile' }
  | { kind: 'post'; postKind: 'request' | 'offer' }
  | { kind: 'propose'; post: TimebankPost }
  | { kind: 'exchange'; exchange: TimebankExchange }
  | null

type Tab = 'board' | 'exchanges' | 'posts' | 'ledger'

export default function TimeBankHome({ status, initialPosts, initialMy }: { status: TimebankStatus; initialPosts: TimebankPost[]; initialMy: TimebankMy }) {
  const t = useTranslations('timebank')
  const locale = useLocale()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('board')
  const [posts, setPosts] = useState(initialPosts)
  const [my, setMy] = useState(initialMy)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [filters, setFilters] = useState({ kind: '', category: '', mode: '', city: '', query: '' })
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const ready = status.verified && status.joined
  const profile = status.profile_data
  const hours = (value: number) => formatHours(value, locale)
  const errorText = (code: string) => (t.has(`error_${code}`) ? t(`error_${code}`, { ...status.limits }) : t('error_saveError'))

  const reloadBoard = useCallback(async (next = filters) => {
    setLoading(true)
    setPosts(await listTimebankBoard(next))
    setLoading(false)
  }, [filters])

  const refreshAll = async () => {
    const [board, mine] = await Promise.all([listTimebankBoard(filters), status.joined ? getTimebankMy() : Promise.resolve(my)])
    setPosts(board)
    setMy(mine)
    router.refresh()
  }

  // Scambi che aspettano una mia azione
  const pending = my.exchanges.filter(
    (e) => (e.status === 'proposed' && !e.proposed_by_me) || (e.status === 'accepted' && !e.my_confirmed),
  ).length

  const act = async (action: () => Promise<string>, success?: string) => {
    const result = await action()
    if (result === 'ok' || result === 'completed') {
      setNotice(result === 'completed' ? t('exchangeCompleted') : (success ?? null))
      setSheet(null)
      await refreshAll()
    } else {
      setNotice(errorText(result))
    }
  }

  return (
    <div className="space-y-6">
      {/* Saldo e azioni */}
      {ready && profile ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--gold)]/40 bg-white p-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('balance')}</p>
            <p className={`mt-1 text-4xl font-black ${profile.balance < 0 ? 'text-amber-700' : 'text-[var(--ink)]'}`}>
              {t('hoursValue', { hours: Number(profile.balance) })}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">{t('balanceHint', { min: status.limits.min_balance, max: status.limits.max_balance })}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('given')}</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{hours(profile.hours_given)} h</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('received')}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{hours(profile.hours_received)} h</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--gold)]/40 bg-white p-5">
          <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
            <ShieldCheck className="h-5 w-5 text-[var(--gold)]" /> {status.verified ? t('joinTitle') : t('verifyTitle')}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{status.verified ? t('joinText', { hours: status.limits.welcome }) : t('verifyText')}</p>
          <button
            type="button"
            disabled={!status.online || status.blocked}
            onClick={() => setSheet(status.verified ? { kind: 'profile' } : { kind: 'verify' })}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <BadgeCheck className="h-4 w-4 text-[var(--gold-bright)]" /> {status.verified ? t('joinCta') : t('verifyCta')}
          </button>
        </div>
      )}

      {ready && status.online && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSheet({ kind: 'post', postKind: 'request' })} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)]">
            <Plus className="h-4 w-4" /> {t('newRequest')}
          </button>
          <button type="button" onClick={() => setSheet({ kind: 'post', postKind: 'offer' })} className="inline-flex items-center gap-2 rounded-xl border border-[var(--ink)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)]">
            <HandHeart className="h-4 w-4" /> {t('newOffer')}
          </button>
          <button type="button" onClick={() => setSheet({ kind: 'profile' })} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">
            {t('editProfile')}
          </button>
        </div>
      )}

      {notice && (
        <p className="rounded-xl bg-[var(--gold-pale)]/60 px-4 py-3 text-sm font-semibold text-[var(--ink)]" role="status">
          {notice}
        </p>
      )}

      {/* Schede */}
      <div className="flex flex-wrap gap-2">
        {([
          ['board', t('tabBoard')],
          ...(status.joined ? ([['exchanges', t('tabExchanges')], ['posts', t('tabPosts')], ['ledger', t('tabLedger')]] as const) : []),
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`relative rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-[var(--ink)] text-white' : 'border border-gray-200 bg-white text-gray-700'}`}
          >
            {label}
            {key === 'exchanges' && pending > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--gold)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink)]">{pending}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'board' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              reloadBoard()
            }}
            className="grid gap-2 rounded-2xl border border-gray-200 bg-white p-3 sm:grid-cols-5"
          >
            <select className={inputClass} value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
              <option value="">{t('filterAll')}</option>
              <option value="request">{t('filterRequests')}</option>
              <option value="offer">{t('filterOffers')}</option>
            </select>
            <select className={inputClass} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">{t('filterAllCategories')}</option>
              {TIMEBANK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TIMEBANK_CATEGORY_EMOJI[c]} {t(`cat_${c}`)}
                </option>
              ))}
            </select>
            <select className={inputClass} value={filters.mode} onChange={(e) => setFilters({ ...filters, mode: e.target.value })}>
              <option value="">{t('filterAnyMode')}</option>
              <option value="in_person">{t('mode_in_person')}</option>
              <option value="online">{t('mode_online')}</option>
            </select>
            <input className={inputClass} value={filters.city} placeholder={t('filterCity')} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
            <div className="flex gap-2">
              <input className={inputClass} value={filters.query} placeholder={t('filterSearch')} onChange={(e) => setFilters({ ...filters, query: e.target.value })} />
              <button type="submit" className="rounded-xl bg-[var(--ink)] px-3 text-white" aria-label={t('filterSearch')}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </button>
            </div>
          </form>

          {posts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-8 text-center text-sm text-[var(--muted)]">{t('boardEmpty')}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  canAct={ready && status.online && !post.is_mine}
                  onPropose={() => setSheet({ kind: 'propose', post })}
                  onReport={async () => {
                    const reason = prompt(t('reportPrompt'))
                    if (!reason || reason.trim().length < 5) return
                    const result = await reportTimebank({ postId: post.id }, reason)
                    setNotice(result === 'ok' ? t('reportSent') : errorText(result))
                  }}
                />
              ))}
            </div>
          )}
          <SafetyBox />
        </div>
      )}

      {tab === 'exchanges' && (
        <div className="space-y-3">
          {my.exchanges.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-[var(--muted)]">{t('exchangesEmpty')}</p>
          ) : (
            my.exchanges.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => setSheet({ kind: 'exchange', exchange: ex })}
                className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left hover:border-[var(--gold)]"
              >
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ex.role === 'giver' ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
                  {ex.role === 'giver' ? t('roleGiver') : t('roleReceiver')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[var(--ink)]">{ex.post_title ?? t('exchangeWith', { name: ex.other_name })}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {t('exchangeWith', { name: ex.other_name })} · {t('hoursValue', { hours: Number(ex.hours) })}
                    {ex.scheduled_on ? ` · ${new Date(`${ex.scheduled_on}T12:00:00`).toLocaleDateString(locale)}` : ''}
                  </span>
                </span>
                <StatusBadge exchange={ex} />
              </button>
            ))
          )}
        </div>
      )}

      {tab === 'posts' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {my.posts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-[var(--muted)] sm:col-span-2">{t('postsEmpty')}</p>
          ) : (
            my.posts.map((post) => (
              <div key={post.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="font-semibold text-[var(--ink)]">
                  {TIMEBANK_CATEGORY_EMOJI[post.category]} {post.title}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {post.kind === 'request' ? t('kindRequest') : t('kindOffer')} · {t('hoursValue', { hours: Number(post.hours) })} · {t(`postStatus_${post.status}`)}
                </p>
                {post.status === 'open' && status.online && (
                  <button
                    type="button"
                    onClick={() => confirm(t('closePostConfirm')) && act(() => closeTimebankPost(post.id), t('postClosed'))}
                    className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {t('closePost')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="rounded-2xl border border-gray-200 bg-white">
          {my.ledger.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--muted)]">{t('ledgerEmpty')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {my.ledger.map((row, i) => (
                <li key={`${row.created_at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    <span className="block font-medium text-[var(--ink)]">{t(`ledger_${row.kind}`)}</span>
                    <span className="text-xs text-[var(--muted)]">{new Date(row.created_at).toLocaleString(locale)}</span>
                  </span>
                  <span className={`font-bold ${Number(row.amount) >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {Number(row.amount) >= 0 ? '+' : ''}
                    {hours(Number(row.amount))} h
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Finestre */}
      {sheet?.kind === 'verify' && (
        <VerificationSetup
          kind="timebank"
          status={status as unknown as VerificationStatus}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet({ kind: 'profile' })
            router.refresh()
          }}
        />
      )}
      {sheet?.kind === 'profile' && (
        <Sheet title={status.joined ? t('editProfile') : t('joinTitle')} onClose={() => setSheet(null)}>
          <ProfileForm
            initial={profile}
            onSaved={async () => {
              setSheet(null)
              setNotice(status.joined ? t('profileSaved') : t('joined', { hours: status.limits.welcome }))
              // Appena entrati: carica subito lo storico (credito di benvenuto)
              if (!status.joined) setMy(await getTimebankMy())
              router.refresh()
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === 'post' && (
        <Sheet title={sheet.postKind === 'request' ? t('newRequest') : t('newOffer')} onClose={() => setSheet(null)}>
          <PostForm
            kind={sheet.postKind}
            defaults={profile}
            onSaved={async () => {
              setSheet(null)
              setNotice(t('postPublished'))
              await refreshAll()
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === 'propose' && (
        <Sheet title={sheet.post.title} onClose={() => setSheet(null)}>
          <ProposeForm
            post={sheet.post}
            onSent={async () => {
              setSheet(null)
              setNotice(t('proposalSent'))
              setTab('exchanges')
              await refreshAll()
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === 'exchange' && (
        <ExchangeSheet
          exchange={sheet.exchange}
          online={status.online}
          onClose={() => setSheet(null)}
          onAction={act}
        />
      )}
    </div>
  )
}

function PostCard({ post, canAct, onPropose, onReport }: { post: TimebankPost; canAct: boolean; onPropose: () => void; onReport: () => void }) {
  const t = useTranslations('timebank')
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${post.kind === 'request' ? 'bg-[var(--gold-pale)] text-[var(--ink)]' : 'bg-emerald-50 text-emerald-700'}`}>
          {post.kind === 'request' ? t('kindRequest') : t('kindOffer')}
        </span>
        <span className="flex items-center gap-1 text-xs font-bold text-[var(--ink)]">
          <Hourglass className="h-3.5 w-3.5 text-[var(--gold)]" /> {t('hoursValue', { hours: Number(post.hours) })}
        </span>
      </div>
      <p className="mt-2 font-bold text-[var(--ink)]">
        {TIMEBANK_CATEGORY_EMOJI[post.category]} {post.title}
      </p>
      <p className="mt-1 line-clamp-3 text-sm text-[var(--ink-soft)]">{post.description}</p>
      <p className="mt-2 flex items-center gap-1 text-xs text-[var(--muted)]">
        {post.mode === 'online' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
        {post.mode === 'online' ? t('mode_online') : [post.city, post.mode === 'both' ? t('mode_online') : null].filter(Boolean).join(' · ')}
        {post.when_text ? ` · ${post.when_text}` : ''}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {post.author_name} · {t('authorExchanges', { count: post.author_exchanges })}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        {canAct ? (
          <button type="button" onClick={onPropose} className="rounded-xl bg-[var(--ink)] px-3 py-2 text-xs font-bold text-white">
            {post.kind === 'request' ? t('offerHelp') : t('askThis')}
          </button>
        ) : (
          <span className="text-xs text-[var(--muted)]">{post.is_mine ? t('yourPost') : ''}</span>
        )}
        {!post.is_mine && (
          <button type="button" onClick={onReport} className="text-gray-400 hover:text-red-500" aria-label={t('report')}>
            <Flag className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ exchange }: { exchange: TimebankExchange }) {
  const t = useTranslations('timebank')
  const waitingMe = (exchange.status === 'proposed' && !exchange.proposed_by_me) || (exchange.status === 'accepted' && !exchange.my_confirmed)
  const color =
    exchange.status === 'completed'
      ? 'bg-emerald-100 text-emerald-700'
      : exchange.status === 'cancelled'
        ? 'bg-gray-100 text-gray-600'
        : exchange.status === 'disputed'
          ? 'bg-red-100 text-red-700'
          : waitingMe
            ? 'bg-[var(--gold)] text-[var(--ink)]'
            : 'bg-amber-50 text-amber-800'
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${color}`}>{waitingMe ? t('needsYou') : t(`status_${exchange.status}`)}</span>
}

function ExchangeSheet({
  exchange,
  online,
  onClose,
  onAction,
}: {
  exchange: TimebankExchange
  online: boolean
  onClose: () => void
  onAction: (action: () => Promise<string>, success?: string) => Promise<void>
}) {
  const t = useTranslations('timebank')
  const locale = useLocale()
  const [messages, setMessages] = useState<TimebankMessage[] | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => setMessages(await listTimebankMessages(exchange.id)), [exchange.id])
  useEffect(() => {
    // Caricamento dei messaggi dal server (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const run = async (action: () => Promise<string>, success?: string) => {
    setBusy(true)
    await onAction(action, success)
    setBusy(false)
  }
  const open = ['proposed', 'accepted', 'disputed'].includes(exchange.status)
  const button = 'flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50'

  return (
    <Sheet title={exchange.post_title ?? t('exchangeWith', { name: exchange.other_name })} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
          <p>
            {exchange.role === 'giver' ? t('summaryGiver', { name: exchange.other_name }) : t('summaryReceiver', { name: exchange.other_name })}{' '}
            <strong>{t('hoursValue', { hours: Number(exchange.hours) })}</strong>
            {exchange.scheduled_on ? ` · ${new Date(`${exchange.scheduled_on}T12:00:00`).toLocaleDateString(locale)}` : ''}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{t(`status_${exchange.status}`)}</p>
          {exchange.status === 'accepted' && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {exchange.my_confirmed ? t('youConfirmed') : t('confirmHint')} {exchange.other_confirmed ? t('otherConfirmed') : ''}
            </p>
          )}
          {exchange.dispute_reason && <p className="mt-2 text-xs text-red-700">{t('disputeReason', { reason: exchange.dispute_reason })}</p>}
          {exchange.staff_note && <p className="mt-1 text-xs text-gray-700">{t('staffNote', { note: exchange.staff_note })}</p>}
        </div>

        {online && (
          <div className="flex flex-wrap gap-2">
            {exchange.status === 'proposed' && !exchange.proposed_by_me && (
              <>
                <button type="button" disabled={busy} onClick={() => run(() => respondTimebankExchange(exchange.id, true), t('accepted'))} className={`${button} bg-emerald-600 text-white`}>
                  <CheckCircle2 className="h-4 w-4" /> {t('accept')}
                </button>
                <button type="button" disabled={busy} onClick={() => run(() => respondTimebankExchange(exchange.id, false), t('declined'))} className={`${button} border border-gray-300 text-gray-700`}>
                  <XCircle className="h-4 w-4" /> {t('decline')}
                </button>
              </>
            )}
            {exchange.status === 'accepted' && !exchange.my_confirmed && (
              <button
                type="button"
                disabled={busy}
                onClick={() => confirm(t('confirmPrompt', { hours: Number(exchange.hours) })) && run(() => confirmTimebankExchange(exchange.id), t('confirmedWaiting'))}
                className={`${button} bg-[var(--ink)] text-white`}
              >
                <BadgeCheck className="h-4 w-4 text-[var(--gold-bright)]" /> {t('confirmDone')}
              </button>
            )}
            {(exchange.status === 'proposed' || exchange.status === 'accepted') && !exchange.my_confirmed && !exchange.other_confirmed && (
              <button type="button" disabled={busy} onClick={() => confirm(t('cancelConfirm')) && run(() => cancelTimebankExchange(exchange.id), t('cancelled'))} className={`${button} border border-gray-300 text-gray-700`}>
                {t('cancelExchange')}
              </button>
            )}
            {exchange.status === 'accepted' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const reason = prompt(t('disputePrompt'))
                  if (reason && reason.trim().length >= 5) run(() => disputeTimebankExchange(exchange.id, reason), t('disputed'))
                }}
                className={`${button} border border-red-200 text-red-600`}
              >
                {t('dispute')}
              </button>
            )}
          </div>
        )}

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
            <MessageCircle className="h-4 w-4 text-[var(--gold)]" /> {t('messages')}
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-[var(--background)] p-3">
            {messages === null ? (
              <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-[var(--gold)]" />
            ) : messages.length === 0 ? (
              <p className="text-center text-xs text-[var(--muted)]">{t('noMessages')}</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.mine ? 'bg-[var(--ink)] text-white' : 'border border-gray-200 bg-white text-[var(--ink)]'}`}>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-0.5 text-[10px] ${m.mine ? 'text-white/60' : 'text-[var(--muted)]'}`}>
                      <Clock className="mr-0.5 inline h-3 w-3" />
                      {new Date(m.created_at).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          {open && online && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!body.trim()) return
                const result = await sendTimebankMessage(exchange.id, body)
                if (result === 'ok') {
                  setBody('')
                  load()
                } else {
                  // Es. limite di 100 messaggi al giorno: prima l'errore non si vedeva
                  alert(t.has(`error_${result}`) ? t(`error_${result}`) : t('error_saveError'))
                }
              }}
              className="mt-2 flex gap-2"
            >
              <input className={inputClass} maxLength={1000} value={body} placeholder={t('messagePlaceholder')} onChange={(e) => setBody(e.target.value)} />
              <button type="submit" className="rounded-xl bg-[var(--ink)] px-3 text-white" aria-label={t('send')}>
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">{t('messagesPrivacy')}</p>
        </div>

        <button
          type="button"
          onClick={async () => {
            const reason = prompt(t('reportPrompt'))
            if (reason && reason.trim().length >= 5) {
              const result = await reportTimebank({ exchangeId: exchange.id }, reason)
              alert(result === 'ok' ? t('reportSent') : t.has(`error_${result}`) ? t(`error_${result}`) : t('error_saveError'))
            }
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600"
        >
          <Flag className="h-3.5 w-3.5" /> {t('reportPerson')}
        </button>
      </div>
    </Sheet>
  )
}

function SafetyBox() {
  const t = useTranslations('timebank')
  return (
    <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 p-5">
      <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
        <ShieldCheck className="h-5 w-5 text-[var(--gold)]" /> {t('safetyTitle')}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink-soft)]">
        {(['safety1', 'safety2', 'safety3', 'safety4', 'safety5'] as const).map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </div>
  )
}
