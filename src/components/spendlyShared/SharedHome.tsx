'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, Crown, LoaderCircle, LogIn, Plus, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createSharedGroup, joinSharedGroup } from '@/app/actions/spendlyShared'
import { GROUP_EMOJIS, type SharedGroupSummary } from '@/lib/spendlyShared'

// I miei gruppi, «Crea un gruppo» (serve Spendly) ed «Entra con il codice»
// (basta essere registrati; il codice può arrivare già dal link d'invito).
export default function SharedHome({
  groups,
  canCreate,
  code,
  preview,
}: {
  groups: SharedGroupSummary[]
  canCreate: boolean
  code: string
  preview: { name: string; emoji: string; creator_name: string; members: number; is_member: boolean } | null
}) {
  const t = useTranslations('spendlyShared')
  const locale = useLocale()
  const router = useRouter()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0])
  const [joinCode, setJoinCode] = useState(code)
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState('')
  const go = (id: string) => router.push(`${locale === 'it' ? '' : `/${locale}`}/spese-condivise/${id}`)

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('create')
    setError('')
    const res = await createSharedGroup(name, emoji)
    if (res.success && res.data) return go(res.data.id)
    setBusy(null)
    setError(res.success ? t('error_saveError') : (res.limitText ?? t(`error_${res.message}`)))
  }
  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('join')
    setError('')
    const res = await joinSharedGroup(joinCode)
    if (res.success && res.data) return go(res.data.id)
    setBusy(null)
    setError(res.success ? t('error_saveError') : t(`error_${res.message}`))
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </p>
      )}

      {/* Invito arrivato dal link */}
      {preview && !preview.is_member && (
        <form onSubmit={join} className="rounded-2xl border-2 border-[var(--gold)] bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">{t('inviteFrom', { name: preview.creator_name })}</p>
          <p className="mt-1 text-xl font-bold text-[var(--ink)]">
            {preview.emoji} {preview.name}
          </p>
          <p className="text-sm text-gray-500">{t('membersCount', { n: preview.members })}</p>
          <button type="submit" disabled={busy !== null} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 font-bold text-white disabled:opacity-60">
            {busy === 'join' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} {t('joinThis')}
          </button>
        </form>
      )}

      {groups.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-[var(--ink)]">{t('myGroups')}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <li key={g.id}>
                <Link href={`/spese-condivise/${g.id}`} className="group flex items-center gap-4 rounded-2xl border border-[var(--gold)]/30 bg-white p-4 shadow-sm hover:border-[var(--gold)]">
                  <span className="text-3xl" aria-hidden>
                    {g.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-[var(--ink)]">{g.name}</span>
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <Users className="h-3.5 w-3.5" /> {t('membersCount', { n: g.members })}
                      {g.is_owner && (
                        <>
                          {' · '}
                          <Crown className="h-3.5 w-3.5 text-[var(--gold)]" /> {t('owner')}
                        </>
                      )}
                    </span>
                  </span>
                  <ArrowRight className="h-5 w-5 text-[var(--gold)] transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={create} className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-bold text-[var(--ink)]">
            <Plus className="h-5 w-5 text-[var(--gold)]" /> {t('createTitle')}
          </h2>
          {canCreate ? (
            <>
              <p className="mt-1 text-sm text-gray-600">{t('createText')}</p>
              <label className="mt-3 block text-sm font-semibold text-gray-700">
                {t('groupName')}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  required
                  placeholder={t('groupNamePlaceholder')}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal focus:border-[var(--gold)] focus:outline-none"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t('groupEmoji')}>
                {GROUP_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={emoji === e}
                    onClick={() => setEmoji(e)}
                    className={`h-11 w-11 rounded-xl border-2 text-xl ${emoji === e ? 'border-[var(--gold)] bg-[var(--gold)]/10' : 'border-gray-200'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <button type="submit" disabled={busy !== null || !name.trim()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 font-bold text-[var(--ink)] disabled:opacity-60">
                {busy === 'create' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t('createButton')}
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              {t('createNeedsPlan')}{' '}
              <Link href="/billing" className="font-bold text-[var(--gold)] underline-offset-2 hover:underline">
                {t('seePlans')}
              </Link>
            </p>
          )}
        </form>

        <form onSubmit={join} className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-bold text-[var(--ink)]">
            <LogIn className="h-5 w-5 text-[var(--gold)]" /> {t('joinTitle')}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{t('joinText')}</p>
          <label className="mt-3 block text-sm font-semibold text-gray-700">
            {t('inviteCode')}
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={12}
              required
              autoCapitalize="characters"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-mono font-normal tracking-widest focus:border-[var(--gold)] focus:outline-none"
            />
          </label>
          <button type="submit" disabled={busy !== null || !joinCode.trim()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 font-bold text-white disabled:opacity-60">
            {busy === 'join' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} {t('joinButton')}
          </button>
        </form>
      </div>
    </div>
  )
}
