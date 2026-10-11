'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { saveProposal, similarProposals } from '@/app/actions/proposals'
import { PROPOSAL_LIMITS, PROPOSAL_TOPICS, type ProposalForm, type ProposalStatus } from '@/lib/proposals'

const input =
  'mt-1 block w-full rounded-xl border border-[var(--gold)]/35 bg-white px-3 text-base text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'block text-sm font-semibold text-[var(--muted)]'

type Similar = { id: string; title: string; votes_count: number; status: ProposalStatus }

export default function ProposalFormView({
  initial,
  editId,
  services,
}: {
  initial: ProposalForm
  editId?: string
  services: { value: string; label: string }[]
}) {
  const t = useTranslations('proposals')
  const [form, setForm] = useState<ProposalForm>(initial)
  const [rules, setRules] = useState(!!editId)
  const [similar, setSimilar] = useState<Similar[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentId, setSentId] = useState<string | null>(null)
  const set = (patch: Partial<ProposalForm>) => setForm((prev) => ({ ...prev, ...patch }))

  // Proposte simili mentre si scrive il titolo (con una piccola pausa)
  useEffect(() => {
    if (editId) return
    const text = form.title.trim()
    if (text.length < 6) return
    const timer = setTimeout(() => {
      similarProposals(text).then(setSimilar)
    }, 450)
    return () => clearTimeout(timer)
  }, [form.title, editId])
  const shownSimilar = form.title.trim().length < 6 ? [] : similar

  const titleLen = form.title.trim().length
  const bodyLen = form.body.trim().length
  const valid =
    rules &&
    titleLen >= PROPOSAL_LIMITS.titleMin &&
    titleLen <= PROPOSAL_LIMITS.titleMax &&
    bodyLen >= PROPOSAL_LIMITS.bodyMin &&
    bodyLen <= PROPOSAL_LIMITS.bodyMax &&
    (form.topic !== 'existing' || !!form.toolName)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    setError(null)
    const result = await saveProposal(form, editId)
    setSaving(false)
    if (!result.success) {
      const known = ['plan_required', 'weekly_limit', 'pending_limit', 'titleLength', 'bodyLength', 'not_editable', 'disabled']
      setError(t(`errors.${known.includes(result.message) ? result.message : 'saveError'}`))
      return
    }
    setSentId(result.data.id)
  }

  if (sentId) {
    return (
      <section className="space-y-4 rounded-3xl border border-[var(--gold)]/25 bg-white p-6 text-center shadow-sm" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#1d6b34]" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-[var(--ink)]">{t('sentTitle')}</h2>
        <p className="text-[var(--muted)]">{t('sentText')}</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={`/community/proposte/${sentId}`} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--ink)] px-5 font-bold text-[var(--gold-bright)]">
            {t('seeProposal')}
          </Link>
          <Link href="/community/proposte" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--gold)]/40 bg-white px-5 font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
            {t('backToList')}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <fieldset>
        <legend className={label}>{t('form.topic')}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {PROPOSAL_TOPICS.map((topic) => (
            <label
              key={topic}
              className={`flex min-h-16 cursor-pointer flex-col justify-center rounded-2xl border px-4 py-3 transition-colors ${
                form.topic === topic ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-[var(--gold)]/35 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]/50'
              }`}
            >
              <input type="radio" name="topic" value={topic} checked={form.topic === topic} onChange={() => set({ topic })} className="sr-only" />
              <span className="font-extrabold">{t(`topics.${topic}`)}</span>
              <span className={`text-xs ${form.topic === topic ? 'text-white/75' : 'text-[var(--muted)]'}`}>{t(`topicHints.${topic}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {form.topic === 'existing' && (
        <label className={label}>
          {t('form.service')}
          <select value={form.toolName} onChange={(e) => set({ toolName: e.target.value })} className={`${input} min-h-12`}>
            <option value="">{t('form.servicePick')}</option>
            {services.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={label}>
        {t('form.title')}
        <input
          value={form.title}
          maxLength={PROPOSAL_LIMITS.titleMax}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t('form.titlePlaceholder')}
          className={`${input} min-h-12`}
          aria-describedby="title-count"
        />
        <span id="title-count" className="mt-1 block text-right text-xs text-[var(--muted)]">
          {titleLen}/{PROPOSAL_LIMITS.titleMax}
        </span>
      </label>

      {shownSimilar.length > 0 && (
        <section className="rounded-2xl bg-[var(--gold-pale)]/60 p-4" aria-live="polite">
          <p className="text-sm font-extrabold text-[var(--ink)]">{t('similarTitle')}</p>
          <ul className="mt-2 space-y-1.5">
            {shownSimilar.map((s) => (
              <li key={s.id}>
                <Link href={`/community/proposte/${s.id}`} className="text-sm font-bold text-[#7a5a14] underline-offset-2 hover:underline">
                  «{s.title}» · {t('supporters', { count: s.votes_count })}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted)]">{t('similarHint')}</p>
        </section>
      )}

      <label className={label}>
        {t('form.body')}
        <textarea
          rows={7}
          value={form.body}
          maxLength={PROPOSAL_LIMITS.bodyMax}
          onChange={(e) => set({ body: e.target.value })}
          placeholder={t('form.bodyPlaceholder')}
          className={`${input} py-3`}
          aria-describedby="body-count"
        />
        <span id="body-count" className="mt-1 block text-right text-xs text-[var(--muted)]">
          {bodyLen}/{PROPOSAL_LIMITS.bodyMax}
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 text-sm leading-relaxed text-[var(--ink)]">
        <input type="checkbox" checked={rules} onChange={() => setRules((v) => !v)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
        <span>{t('form.rules')}</span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!valid || saving}
        className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-5 text-base font-extrabold text-[var(--gold-bright)] disabled:opacity-50"
      >
        {saving && <LoaderCircle className="h-5 w-5 animate-spin" />}
        {editId ? t('form.resend') : t('form.send')}
      </button>
      <p className="text-center text-xs text-[var(--muted)]">{t('form.afterSend')}</p>
    </form>
  )
}
