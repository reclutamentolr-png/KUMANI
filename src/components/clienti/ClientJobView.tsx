'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { askConfirm } from '@/lib/confirm'
import { deleteJob, saveChecklist, setJobStage, updateJob } from '@/app/actions/clienti'
import {
  CLIENT_LIMITS,
  JOB_STAGES,
  formatEur,
  parseEuro,
  type ChecklistItem,
  type ClientJob,
  type ClientPayment,
  type ClientQuote,
  type JobFormData,
  type JobStage,
} from '@/lib/clienti'
import { inputClass } from './ClientForm'
import JobForm from './JobForm'
import Payments from './Payments'

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm'

export default function ClientJobView({
  job: initial,
  client,
  payments: initialPayments,
  quote,
  quotes,
}: {
  job: ClientJob
  client: { id: string; name: string }
  payments: ClientPayment[]
  quote: ClientQuote | null
  quotes: ClientQuote[]
}) {
  const t = useTranslations('clienti')
  const locale = useLocale()
  const router = useRouter()
  const [job, setJob] = useState(initial)
  const [payments, setPayments] = useState(initialPayments)
  const [editing, setEditing] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [error, setError] = useState<string | null>(null)

  const linkedQuote = quotes.find((q) => q.id === job.quote_id) ?? quote
  const price = job.amount ?? linkedQuote?.gross ?? null
  const paidOnline = linkedQuote?.paid_amount ?? 0
  const paid = payments.reduce((s, p) => s + p.amount, 0) + paidOnline
  const left = price === null ? null : Math.max(0, Math.round((price - paid) * 100) / 100)
  const formatDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const subtitle = [
    linkedQuote ? t('jobs.fromQuoteShort', { number: linkedQuote.quote_number }) : null,
    job.address,
    job.start_date ? t('jobs.startShort', { date: formatDay(job.start_date) }) : null,
    job.due_date ? t('jobs.dueShort', { date: formatDay(job.due_date) }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const pickStage = async (stage: JobStage) => {
    const previous = job.stage
    setJob((prev) => ({ ...prev, stage }))
    const result = await setJobStage(job.id, stage)
    if (!result.success) {
      setJob((prev) => ({ ...prev, stage: previous }))
      setError(t('errors.saveError'))
    }
  }

  const storeChecklist = async (checklist: ChecklistItem[]) => {
    const previous = job.checklist
    setJob((prev) => ({ ...prev, checklist }))
    const result = await saveChecklist(job.id, checklist)
    if (!result.success) {
      setJob((prev) => ({ ...prev, checklist: previous }))
      setError(t('errors.saveError'))
    }
  }

  const addItem = (e: React.FormEvent) => {
    e.preventDefault()
    const text = newItem.trim()
    if (!text || job.checklist.length >= CLIENT_LIMITS.checklistItems) return
    storeChecklist([...job.checklist, { text, done: false }])
    setNewItem('')
  }

  const saveDetails = async (form: JobFormData, notes: string) => {
    const result = await updateJob(job.id, form, notes)
    if (!result.success) return t(`errors.${['titleRequired', 'amountInvalid'].includes(result.message) ? result.message : 'saveError'}`)
    setEditing(false)
    router.refresh()
    const amount = parseEuro(form.amount)
    setJob((prev) => ({
      ...prev,
      title: form.title.trim(),
      quote_id: form.quoteId || null,
      amount,
      address: form.address.trim() || null,
      start_date: form.startDate || null,
      due_date: form.dueDate || null,
      notes: notes.trim() || null,
    }))
    return null
  }

  const remove = async () => {
    if (!(await askConfirm(t('jobs.deleteConfirm', { title: job.title })))) return
    const result = await deleteJob(job.id)
    if (!result.success) {
      setError(t('errors.saveError'))
      return
    }
    router.push(`/marketplace/clienti/${client.id}`)
  }

  const doneCount = job.checklist.filter((i) => i.done).length

  return (
    <div className="space-y-5">
      <div>
        <h2 className="break-words text-3xl font-bold text-[var(--ink)]">{job.title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          <Link href={`/marketplace/clienti/${client.id}`} className="font-semibold text-[#8a6a1f] underline-offset-2 hover:underline">
            {client.name}
          </Link>
          {subtitle ? ` · ${subtitle}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={t('jobs.stageLabel')}>
        {JOB_STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            aria-pressed={job.stage === stage}
            onClick={() => pickStage(stage)}
            className={`min-h-11 rounded-xl px-2 text-sm font-bold transition-colors ${
              job.stage === stage ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-[var(--gold)]/35 bg-white text-[var(--muted)] hover:bg-[var(--gold-pale)]'
            }`}
          >
            {t(`jobs.stages.${stage}`)}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.2)]">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('jobs.moneyTitle')}</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-white/65">{t('jobs.price')}</p>
            <p className="mt-0.5 text-lg font-extrabold">{price === null ? '—' : formatEur(price, locale)}</p>
          </div>
          <div>
            <p className="text-xs text-white/65">{t('jobs.paid')}</p>
            <p className="mt-0.5 text-lg font-extrabold text-[#9be0ae]">{formatEur(paid, locale)}</p>
          </div>
          <div>
            <p className="text-xs text-white/65">{t('jobs.left')}</p>
            <p className="mt-0.5 text-lg font-extrabold text-[var(--gold-bright)]">{left === null ? '—' : formatEur(left, locale)}</p>
          </div>
        </div>
      </section>

      <section className={card}>
        <h3 className="text-base font-extrabold text-[var(--ink)]">{t('pay.title')}</h3>
        <Payments
          clientId={client.id}
          payments={payments}
          onlineQuotes={linkedQuote && linkedQuote.paid_amount > 0 ? [linkedQuote] : []}
          jobs={[job]}
          fixedJobId={job.id}
          suggestedAmount={left ?? undefined}
          onChange={(next) => {
            setPayments(next)
            router.refresh()
          }}
        />
      </section>

      <section className={card}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-extrabold text-[var(--ink)]">{t('jobs.checklistTitle')}</h3>
          {job.checklist.length > 0 && (
            <span className="text-sm font-semibold text-[var(--muted)]">
              {doneCount}/{job.checklist.length}
            </span>
          )}
        </div>
        {job.checklist.length === 0 && <p className="mt-2 text-sm text-[var(--muted)]">{t('jobs.checklistEmpty')}</p>}
        <ul className="mt-2">
          {job.checklist.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-base">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => storeChecklist(job.checklist.map((x, i) => (i === index ? { ...x, done: !x.done } : x)))}
                  className="h-5 w-5 shrink-0 accent-[var(--ink)]"
                />
                <span className={`break-words ${item.done ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>{item.text}</span>
              </label>
              <button
                type="button"
                onClick={() => storeChecklist(job.checklist.filter((_, i) => i !== index))}
                aria-label={t('jobs.removeItem', { text: item.text })}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-red-50 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {job.checklist.length < CLIENT_LIMITS.checklistItems && (
          <form onSubmit={addItem} className="mt-2 flex gap-2">
            <label className="sr-only" htmlFor="job-new-item">
              {t('jobs.addItem')}
            </label>
            <input
              id="job-new-item"
              value={newItem}
              maxLength={CLIENT_LIMITS.checklistItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder={t('jobs.itemPlaceholder')}
              className={`${inputClass} mt-0`}
            />
            <button
              type="submit"
              disabled={!newItem.trim()}
              aria-label={t('jobs.addItem')}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)] disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
            </button>
          </form>
        )}
      </section>

      <section className={card}>
        {editing ? (
          <>
            <h3 className="mb-4 text-base font-extrabold text-[var(--ink)]">{t('jobs.edit')}</h3>
            <JobForm
              initial={{
                title: job.title,
                amount: job.amount === null ? '' : String(job.amount).replace('.', ','),
                quoteId: job.quote_id ?? '',
                address: job.address ?? '',
                startDate: job.start_date ?? '',
                dueDate: job.due_date ?? '',
              }}
              quotes={quotes}
              withNotes
              initialNotes={job.notes ?? ''}
              submitLabel={t('jobs.save')}
              onSubmit={saveDetails}
              onCancel={() => setEditing(false)}
            />
          </>
        ) : (
          <>
            {job.notes && <p className="mb-4 whitespace-pre-line break-words text-sm text-[var(--ink)]">{job.notes}</p>}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-white px-5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {t('jobs.edit')}
              </button>
              <button
                type="button"
                onClick={remove}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('jobs.delete')}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
