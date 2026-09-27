'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BadgeCheck, Ban, Flag, HeartHandshake, LoaderCircle, MessageCircle, Pause, Pencil, Sparkles, UserX } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import {
  blockAffinityUser,
  getFriendsOverview,
  reportAffinityUser,
  respondToIntro,
  setFriendsParticipation,
  type FriendIntro,
  type FriendsOverview,
} from '@/app/actions/affinityFriends'
import { AFFINITY_AXES, type AffinityMap } from '@/lib/affinity'
import { MENU_LOCALE_NAMES, MENU_LOCALES } from '@/lib/menu'
import { useAffinityRealtime } from '@/lib/useAffinityRealtime'
import AffinityChat from './AffinityChat'
import AffinityRadar from './AffinityRadar'
import ArchetypeIcon from './ArchetypeIcon'

// Affinity Amicizie (sotto il risultato del gioco): requisiti, consenso,
// presentazioni della settimana, risposte, match con chat, blocca/segnala.
export default function AffinityFriends({ myMap }: { myMap: AffinityMap }) {
  const t = useTranslations('affinity')
  const [data, setData] = useState<FriendsOverview | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ bio: '', languages: [] as string[], consent: false })
  const [chat, setChat] = useState<FriendIntro | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const axisLabels = Object.fromEntries(AFFINITY_AXES.map((axis) => [axis, t(`axis_${axis}`)]))

  // Stato precedente delle presentazioni: per accorgersi di un nuovo match
  // arrivato in tempo reale (l'altra persona ha appena detto sì).
  const previous = useRef<Map<string, string> | null>(null)
  const formLoaded = useRef(false)

  const load = useCallback(async () => {
    const overview = await getFriendsOverview()
    setData(overview)
    if (!overview) return
    // Il modulo si riempie solo la prima volta: un aggiornamento in tempo
    // reale non deve cancellare quello che si sta scrivendo.
    if (!formLoaded.current) {
      formLoaded.current = true
      setForm((f) => ({ ...f, bio: overview.bio ?? '', languages: overview.languages }))
    }
    const before = previous.current
    const newMatch = before ? overview.intros.find((intro) => intro.status === 'match' && before.get(intro.id) === 'waiting') : undefined
    if (newMatch) setMessage(t('f_newMatch', { name: newMatch.first_name ?? '' }))
    previous.current = new Map(overview.intros.map((intro) => [intro.id, intro.status]))
  }, [t])

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono, come KuManagementPanel).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Risposte, nuovi match e messaggi arrivano senza ricaricare la pagina.
  useAffinityRealtime(load)

  if (data === undefined) {
    return (
      <div className="flex justify-center rounded-2xl border border-[var(--gold)]/25 bg-white p-8">
        <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" />
      </div>
    )
  }
  if (data === null || data.status === 'blocked') return null

  const header = (
    <div className="flex items-start gap-3">
      <HeartHandshake className="mt-0.5 h-7 w-7 shrink-0 text-[var(--gold)]" />
      <div>
        <h3 className="font-bold text-[var(--ink)]">{t('f_title')}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('f_subtitle', { count: data.per_week })}</p>
      </div>
    </div>
  )

  // Requisiti non soddisfatti
  if (data.status !== 'ok') {
    return (
      <div className="space-y-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-6">
        {header}
        <p className="rounded-xl bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">{t(`f_req_${data.status}`)}</p>
        {data.status === 'no_plan' && (
          <Link href={{ pathname: '/billing' }} className="inline-flex rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white">
            {t('f_subscribe')}
          </Link>
        )}
      </div>
    )
  }

  const save = async (on: boolean) => {
    setBusy(true)
    setMessage(null)
    const result = await setFriendsParticipation(on, form.bio, form.languages)
    setBusy(false)
    if (result === 'ok') {
      setEditing(false)
      await load()
    } else {
      setMessage(t('f_error'))
    }
  }

  // Consenso / modifica dati
  if (!data.opted_in || editing) {
    return (
      <div className="space-y-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-6">
        {header}
        <ul className="space-y-1.5 text-sm text-[var(--muted)]">
          <li>• {t('f_rule1')}</li>
          <li>• {t('f_rule2')}</li>
          <li>• {t('f_rule3')}</li>
        </ul>
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">{t('f_languages')}</p>
          <div className="flex flex-wrap gap-2">
            {MENU_LOCALES.map((l) => {
              const on = form.languages.includes(l)
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setForm({ ...form, languages: on ? form.languages.filter((x) => x !== l) : [...form.languages, l] })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-[var(--gold)]/30 text-[var(--muted)] hover:border-[var(--gold)]'
                  }`}
                >
                  {MENU_LOCALE_NAMES[l]}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700">{t('f_bio')}</label>
          <textarea
            value={form.bio}
            maxLength={160}
            rows={2}
            placeholder={t('f_bioPlaceholder')}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
          />
        </div>
        {!data.opted_in && (
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => setForm({ ...form, consent: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[var(--gold)]"
            />
            {t('f_consent')}
          </label>
        )}
        {message && <p className="text-sm font-semibold text-amber-700">{message}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => save(true)}
            disabled={busy || form.languages.length === 0 || (!data.opted_in && !form.consent)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {data.opted_in ? t('f_saveChanges') : t('f_activate')}
          </button>
          {data.opted_in && (
            <>
              <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100">
                {t('f_cancel')}
              </button>
              <button
                type="button"
                onClick={() => confirm(t('f_pauseConfirm')) && save(false)}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <Pause className="h-4 w-4" /> {t('f_pause')}
              </button>
            </>
          )}
        </div>
        {form.languages.length === 0 && <p className="text-xs text-gray-500">{t('f_languagesRequired')}</p>}
      </div>
    )
  }

  const respond = async (intro: FriendIntro, yes: boolean) => {
    setBusy(true)
    const result = await respondToIntro(intro.id, yes)
    setBusy(false)
    if (result === 'match') setMessage(t('f_newMatch', { name: intro.first_name ?? '' }))
    await load()
  }

  const block = async (intro: FriendIntro) => {
    if (!confirm(t('f_blockConfirm', { name: intro.first_name ?? '' }))) return
    await blockAffinityUser(intro.other_id)
    await load()
  }

  const report = async (intro: FriendIntro) => {
    const reason = prompt(t('f_reportPrompt', { name: intro.first_name ?? '' }))
    if (!reason?.trim()) return
    const ok = await reportAffinityUser(intro.other_id, reason)
    setMessage(ok ? t('f_reported') : t('f_error'))
    await load()
  }

  const visible = data.intros.filter((intro) => intro.status !== 'declined')

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        {header}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[var(--ink)]"
          title={t('f_edit')}
          aria-label={t('f_edit')}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p>}

      {visible.length === 0 ? (
        <p className="rounded-xl bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">{t('f_noIntros')}</p>
      ) : (
        <ul className="space-y-4">
          {visible.map((intro) => (
            <li key={intro.id} className="rounded-2xl border border-[var(--gold)]/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                    {intro.archetype ? <ArchetypeIcon archetype={intro.archetype} className="h-5 w-5" /> : null}
                  </span>
                  <div>
                    <p className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
                      {intro.first_name}
                      {intro.verified && (
                        <span title={t('f_verified')}>
                          <BadgeCheck className="h-4 w-4 text-[var(--gold)]" />
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {[intro.city, intro.archetype ? t(`arch_${intro.archetype}_name`) : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-2xl font-bold text-[var(--ink)]">{intro.score}%</span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">{t('compatibility')}</span>
                </p>
              </div>

              {intro.bio && <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm italic text-gray-700">“{intro.bio}”</p>}

              {intro.map && (
                <div className="mx-auto mt-2 max-w-[220px]">
                  <AffinityRadar
                    series={[
                      { map: intro.map, color: '#a78bfa' },
                      { map: myMap, color: '#c79a3b' },
                    ]}
                    labels={axisLabels}
                    size={240}
                  />
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {intro.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond(intro, true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] disabled:opacity-50"
                    >
                      <HeartHandshake className="h-4 w-4" /> {t('f_yes')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond(intro, false)}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {t('f_no')}
                    </button>
                  </>
                )}
                {intro.status === 'waiting' && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{t('f_waiting')}</span>}
                {intro.status === 'closed' && <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">{t('f_closed')}</span>}
                {intro.status === 'match' && (
                  <button
                    type="button"
                    onClick={() => setChat(intro)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white"
                  >
                    <MessageCircle className="h-4 w-4 text-[var(--gold-bright)]" /> {t('f_write')}
                    {intro.unread > 0 && <span className="rounded-full bg-[var(--gold-bright)] px-1.5 text-[10px] text-[var(--ink)]">{intro.unread}</span>}
                  </button>
                )}
                <span className="ml-auto flex items-center gap-1 text-gray-400">
                  <button type="button" onClick={() => block(intro)} className="rounded-md p-1.5 hover:bg-gray-100 hover:text-gray-700" title={t('f_block')} aria-label={t('f_block')}>
                    <UserX className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => report(intro)} className="rounded-md p-1.5 hover:bg-red-50 hover:text-red-600" title={t('f_report')} aria-label={t('f_report')}>
                    <Flag className="h-4 w-4" />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 text-xs leading-5 text-gray-500">
        <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('f_footer')}
      </p>

      {chat && (
        <AffinityChat
          introId={chat.id}
          name={chat.first_name ?? ''}
          onClose={() => {
            setChat(null)
            load()
          }}
        />
      )}
    </div>
  )
}
