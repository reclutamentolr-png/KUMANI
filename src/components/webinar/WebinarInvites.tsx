'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { inviteToWebinar, listWebinarInvites, removeWebinarInvite, searchWebinarInvitees, type WebinarInvitee } from '@/app/actions/webinar'

// Chi organizza invita i Kumani per nome: ricevono l'avviso sul telefono e
// nella campanella con il link (e un secondo avviso quando la diretta parte)
export default function WebinarInvites({ webinarId }: { webinarId: string }) {
  const t = useTranslations('webinar')
  const [invited, setInvited] = useState<WebinarInvitee[] | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WebinarInvitee[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const res = await listWebinarInvites(webinarId)
    setInvited('error' in res ? [] : res)
  }, [webinarId])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- elenco letto dal server all'apertura
    load()
  }, [load])

  const onQuery = (value: string) => {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    if (value.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    timer.current = setTimeout(async () => {
      const res = await searchWebinarInvitees(webinarId, value)
      setResults('error' in res ? [] : res)
      setSearching(false)
    }, 350)
  }

  const invite = async (person: WebinarInvitee) => {
    setBusy(person.id)
    setError(null)
    const res = await inviteToWebinar(webinarId, person.id)
    setBusy(null)
    if ('error' in res) return setError(res.error === 'too_many' ? t('inviteTooMany') : t('errorGeneric'))
    setInvited((prev) => (prev && !prev.some((p) => p.id === person.id) ? [...prev, person] : prev))
  }

  const remove = async (person: WebinarInvitee) => {
    setBusy(person.id)
    const res = await removeWebinarInvite(webinarId, person.id)
    setBusy(null)
    if (!('error' in res)) setInvited((prev) => prev?.filter((p) => p.id !== person.id) ?? prev)
  }

  const invitedIds = new Set((invited ?? []).map((p) => p.id))

  return (
    <div className="rounded-2xl border border-[var(--gold)]/30 bg-white p-4">
      <p className="text-sm font-bold">{t('kumaniInviteTitle')}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{t('kumaniInviteHint')}</p>

      <div className="mt-3 flex items-center gap-2 rounded-full border border-[var(--gold)]/40 px-3 focus-within:ring-2 focus-within:ring-[var(--gold)]">
        <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('kumaniInviteSearch')}
          aria-label={t('kumaniInviteSearch')}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-[var(--muted)]" aria-hidden />}
      </div>

      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-[var(--gold)]/15 rounded-2xl border border-[var(--gold)]/25">
          {results.map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-sm font-semibold">{person.name}</span>
              {invitedIds.has(person.id) ? (
                <span className="text-xs font-bold text-emerald-700">{t('kumaniInvited')}</span>
              ) : (
                <button
                  type="button"
                  disabled={busy === person.id}
                  onClick={() => invite(person)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 text-xs font-bold text-[var(--gold-bright)] disabled:opacity-50"
                >
                  {busy === person.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <UserPlus className="h-3.5 w-3.5" aria-hidden />}
                  {t('kumaniInviteButton')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && !searching && results.length === 0 && <p className="mt-2 text-xs text-[var(--muted)]">{t('kumaniInviteNone')}</p>}
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}

      {invited === null ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-[var(--muted)]" aria-hidden />
      ) : invited.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-bold text-[var(--muted)]">{t('kumaniInvitedCount', { count: invited.length })}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {invited.map((person) => (
              <li key={person.id} className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-pale)] py-1 pl-3 pr-1 text-xs font-semibold">
                {person.name}
                <button
                  type="button"
                  disabled={busy === person.id}
                  onClick={() => remove(person)}
                  aria-label={t('kumaniInviteRemove', { name: person.name })}
                  className="rounded-full p-1 hover:bg-white"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
