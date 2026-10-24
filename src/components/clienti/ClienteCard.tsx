'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, FilePlus2, Hammer, LoaderCircle, Mail, MessageCircle, Pencil, Phone, ShoppingBag, Stamp, Trash2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { askConfirm } from '@/lib/confirm'
import { limitTextOf } from '@/lib/limitText'
import { createJob, deleteClientRecord, saveClientNotes, setNextStep, updateClientRecord } from '@/app/actions/clienti'
import {
  CLIENT_LIMITS,
  QUICK_STEPS,
  STAGE_STYLES,
  formatEur,
  isStepDue,
  romeToday,
  whatsappDigits,
  type ClientFormData,
  type ClientJob,
  type ClientPayment,
  type ClientQuote,
  type JobFormData,
  type ClientRecord,
  type ClientShopOrder,
  type ClientStamps,
} from '@/lib/clienti'
import ClientForm, { inputClass } from './ClientForm'
import JobForm from './JobForm'
import Payments from './Payments'

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm'
const contactBtn =
  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-bold transition-opacity hover:opacity-90'

export default function ClienteCard({
  client: initial,
  quotes,
  jobs,
  payments: initialPayments,
  canQuote,
  orders,
  stamps,
  canReceipt,
}: {
  canReceipt: boolean
  client: ClientRecord
  quotes: ClientQuote[]
  jobs: ClientJob[]
  payments: ClientPayment[]
  canQuote: boolean
  orders: ClientShopOrder[]
  stamps: ClientStamps[]
}) {
  const t = useTranslations('clienti')
  const locale = useLocale()
  const router = useRouter()
  const [client, setClient] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [stepText, setStepText] = useState('')
  const [stepDue, setStepDue] = useState(romeToday(1))
  const [stepBusy, setStepBusy] = useState(false)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [notesState, setNotesState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [payments, setPayments] = useState(initialPayments)
  const [addingJob, setAddingJob] = useState(false)

  const formatDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' })
  // Da incassare: preventivi accettati + lavori senza preventivo; incassato: online + registrati
  const jobQuoteIds = new Set(jobs.map((j) => j.quote_id).filter(Boolean))
  const jobPriceFor = (j: ClientJob) => {
    if (j.amount !== null) return j.amount
    const q = quotes.find((x) => x.id === j.quote_id)
    return q && q.payment_status !== 'refunded' ? q.gross : 0
  }
  const accepted = jobs.reduce((s, j) => s + jobPriceFor(j), 0) + quotes.filter((q) => q.accepted && !jobQuoteIds.has(q.id)).reduce((s, q) => s + q.gross, 0)
  const paid = quotes.reduce((s, q) => s + q.paid_amount, 0) + payments.reduce((s, p) => s + p.amount, 0)
  const owed = Math.max(0, Math.round((accepted - paid) * 100) / 100)
  const wa = whatsappDigits(client.phone)
  const subtitle = [client.contact_name, [client.address, client.city].filter(Boolean).join(', '), client.vat ? t('vatShort', { vat: client.vat }) : null]
    .filter(Boolean)
    .join(' · ')

  const saveStep = async (text: string, due: string | null) => {
    setStepBusy(true)
    setError(null)
    const result = await setNextStep(client.id, text, due)
    setStepBusy(false)
    if (!result.success) {
      setError(t('errors.saveError'))
      return
    }
    setClient((prev) => ({ ...prev, next_step: text.trim() || null, next_step_due: text.trim() ? due : null }))
    setStepText('')
    router.refresh()
  }

  const saveNotes = async () => {
    setNotesState('saving')
    const result = await saveClientNotes(client.id, notes)
    setNotesState(result.success ? 'saved' : 'error')
  }

  const saveDetails = async (form: ClientFormData) => {
    const result = await updateClientRecord(client.id, form)
    if (!result.success) return limitTextOf(result) ?? t(`errors.${result.message === 'duplicateName' || result.message === 'nameRequired' ? result.message : 'saveError'}`)
    setClient((prev) => ({
      ...prev,
      name: form.name.trim(),
      contact_name: form.contactName.trim() || null,
      vat: form.vat.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      postal_code: form.postalCode.trim() || null,
      pec: form.pec.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    }))
    setEditing(false)
    router.refresh()
    return null
  }

  const remove = async () => {
    if (!(await askConfirm(t('deleteConfirm', { name: client.name })))) return
    const result = await deleteClientRecord(client.id)
    if (!result.success) {
      setError(t('errors.saveError'))
      return
    }
    router.push('/app/clienti')
  }

  const newJob = async (form: JobFormData) => {
    const result = await createJob(client.id, form)
    if (!result.success) return limitTextOf(result) ?? t(`errors.${['titleRequired', 'amountInvalid'].includes(result.message) ? result.message : 'saveError'}`)
    router.push(`/app/clienti/lavoro/${result.data.id}`)
    return null
  }
  const jobPrice = (j: ClientJob) => j.amount ?? quotes.find((q) => q.id === j.quote_id)?.gross ?? null

  const quoteState = (q: ClientQuote) =>
    q.payment_status === 'paid' ? t('quotePaid') : q.payment_status === 'refunded' ? t('quoteRefunded') : q.accepted ? t('quoteAccepted') : t('quoteWaiting')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="break-words text-3xl font-bold text-[var(--ink)]">{client.name}</h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>}
        {stamps.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-2">
            {stamps.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold-pale)] px-3 py-1 text-xs font-bold text-[#7a5a14]">
                <Stamp className="h-3.5 w-3.5" aria-hidden="true" />
                {t('extras.stamps', { business: s.business, stamps: s.stamps, total: s.total })}
              </span>
            ))}
          </p>
        )}
      </div>

      {(client.phone || client.email) && (
        <div className="grid grid-cols-3 gap-2">
          {client.phone && (
            <a href={`tel:${client.phone.replace(/[^\d+]/g, '')}`} className={`${contactBtn} bg-[var(--ink)] text-[var(--gold-bright)]`}>
              <Phone className="h-5 w-5" aria-hidden="true" />
              {t('call')}
            </a>
          )}
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={`${contactBtn} border border-[var(--gold)]/35 bg-white text-[var(--ink)]`}>
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              WhatsApp
            </a>
          )}
          {client.email && (
            <a href={`mailto:${client.email}`} className={`${contactBtn} border border-[var(--gold)]/35 bg-white text-[var(--ink)]`}>
              <Mail className="h-5 w-5" aria-hidden="true" />
              {t('email')}
            </a>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.2)]">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('moneyTitle')}</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-white/65">{t('acceptedTotal')}</p>
            <p className="mt-0.5 text-lg font-extrabold">{formatEur(accepted, locale)}</p>
          </div>
          <div>
            <p className="text-xs text-white/65">{t('paidTotal')}</p>
            <p className="mt-0.5 text-lg font-extrabold text-[#9be0ae]">{formatEur(paid, locale)}</p>
          </div>
          <div>
            <p className="text-xs text-white/65">{t('owedTotal')}</p>
            <p className="mt-0.5 text-lg font-extrabold text-[var(--gold-bright)]">{formatEur(owed, locale)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/60">{t('moneyHint')}</p>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-extrabold text-[var(--ink)]">{t('jobs.listTitle')}</h3>
          {!addingJob && (
            <button
              type="button"
              onClick={() => setAddingJob(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)] hover:opacity-90"
            >
              <Hammer className="h-4 w-4" aria-hidden="true" />
              {t('jobs.new')}
            </button>
          )}
        </div>
        {addingJob && (
          <div className="mt-4 rounded-2xl bg-[var(--background)] p-4">
            <JobForm
              initial={{ title: '', amount: '', quoteId: '', address: [client.address, client.city].filter(Boolean).join(', '), startDate: '', dueDate: '' }}
              quotes={quotes.filter((q) => q.payment_status !== 'refunded')}
              submitLabel={t('jobs.create')}
              onSubmit={newJob}
              onCancel={() => setAddingJob(false)}
            />
          </div>
        )}
        {jobs.length === 0 && !addingJob ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{t('jobs.none')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--gold)]/15">
            {jobs.map((j) => {
              const price = jobPrice(j)
              const done = j.checklist.filter((i) => i.done).length
              return (
                <li key={j.id}>
                  <Link href={`/app/clienti/lavoro/${j.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-[#8a6a1f]">
                    <span className="min-w-0">
                      <span className="block break-words font-bold text-[var(--ink)]">{j.title}</span>
                      <span className="block text-sm text-[var(--muted)]">
                        {[
                          price === null ? null : formatEur(price, locale),
                          j.checklist.length > 0 ? t('jobs.checklistCount', { done, total: j.checklist.length }) : null,
                          j.due_date ? t('jobs.dueShort', { date: formatDay(j.due_date) }) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${STAGE_STYLES[j.stage]}`}>{t(`jobs.stages.${j.stage}`)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <h3 className="text-base font-extrabold text-[var(--ink)]">{t('pay.title')}</h3>
        <Payments
          clientId={client.id}
          payments={payments}
          onlineQuotes={quotes.filter((q) => q.paid_amount > 0)}
          jobs={jobs}
          suggestedAmount={owed}
          canReceipt={canReceipt}
          onChange={(next) => {
            setPayments(next)
            router.refresh()
          }}
        />
      </section>

      <section className={card}>
        <h3 className="text-base font-extrabold text-[var(--ink)]">{t('nextStepTitle')}</h3>
        {client.next_step ? (
          <div className={`mt-3 flex items-center justify-between gap-3 rounded-2xl p-3 ${isStepDue(client.next_step_due) ? 'bg-[var(--gold-pale)]' : 'bg-[var(--background)]'}`}>
            <span className="min-w-0">
              <span className="block break-words font-bold text-[var(--ink)]">{client.next_step}</span>
              {client.next_step_due && (
                <span className="block text-sm text-[var(--muted)]">
                  {client.next_step_due <= romeToday() ? `${t('dueBadge')} · ` : ''}
                  {formatDay(client.next_step_due)}
                </span>
              )}
            </span>
            <button
              type="button"
              disabled={stepBusy}
              onClick={() => saveStep('', null)}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-60"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {t('stepDone')}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-[#1d6b34]">{t('noStep')}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_STEPS.map((q) => (
            <button
              key={q.key}
              type="button"
              disabled={stepBusy}
              onClick={() => saveStep(t(q.key), romeToday(q.days))}
              className="min-h-10 rounded-full border border-[var(--gold)]/35 bg-white px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-60"
            >
              + {t(q.key)}
            </button>
          ))}
        </div>

        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            if (stepText.trim()) saveStep(stepText, stepDue || null)
          }}
        >
          <label className="block text-sm font-semibold text-[var(--muted)]">
            {t('stepOther')}
            <input value={stepText} maxLength={CLIENT_LIMITS.nextStep} onChange={(e) => setStepText(e.target.value)} placeholder={t('stepPlaceholder')} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-[var(--muted)]">
            {t('stepWhen')}
            <input type="date" value={stepDue} onChange={(e) => setStepDue(e.target.value)} className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={stepBusy || !stepText.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-50"
          >
            {stepBusy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {t('stepSave')}
          </button>
        </form>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-extrabold text-[var(--ink)]">{t('quotesTitle')}</h3>
          {canQuote && (
            <Link
              href={`/app/preventivi/new?client=${client.id}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--gold-bright)] px-4 text-sm font-bold text-[var(--ink)] hover:opacity-90"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              {t('newQuote')}
            </Link>
          )}
        </div>
        {quotes.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{t('noQuotes')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--gold)]/15">
            {quotes.map((q) => (
              <li key={q.id}>
                <Link href={`/app/preventivi/${q.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-[#8a6a1f]">
                  <span className="min-w-0">
                    <span className="block break-words font-bold text-[var(--ink)]">
                      {t('quoteNumber', { number: q.quote_number })}
                      {q.subject ? ` · ${q.subject}` : ''}
                    </span>
                    <span className="block text-sm text-[var(--muted)]">
                      {new Date(`${q.issue_date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })} · {quoteState(q)}
                      {q.paid_amount > 0 ? ` · ${t('paidOnline', { amount: formatEur(q.paid_amount, locale) })}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-extrabold text-[var(--ink)]">{formatEur(q.gross, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {orders.length > 0 && (
        <section className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-[var(--ink)]">
              <ShoppingBag className="h-4 w-4 text-[var(--gold)]" aria-hidden="true" />
              {t('extras.ordersTitle')}
            </h3>
            <span className="text-sm font-semibold text-[var(--muted)]">
              {t('extras.ordersTotal', { amount: formatEur(orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0), locale) })}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-[var(--gold)]/15">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href="/app/shop?tab=orders" className="flex items-center justify-between gap-3 py-3 hover:text-[#8a6a1f]">
                  <span className="min-w-0">
                    <span className="block font-bold text-[var(--ink)]">{t('extras.orderNumber', { number: o.number })}</span>
                    <span className="block text-sm text-[var(--muted)]">
                      {new Date(o.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Rome' })} · {t(`extras.status.${o.status}`)}
                    </span>
                  </span>
                  <span className={`shrink-0 font-extrabold ${o.status === 'cancelled' ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>{formatEur(o.total, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-[var(--muted)]">{t('extras.ordersHint')}</p>
        </section>
      )}

      <section className={card}>
        <label className="block">
          <span className="text-base font-extrabold text-[var(--ink)]">{t('notesTitle')}</span>
          <textarea
            rows={4}
            value={notes}
            maxLength={CLIENT_LIMITS.notes}
            onChange={(e) => {
              setNotes(e.target.value)
              setNotesState('idle')
            }}
            placeholder={t('notesPlaceholder')}
            className="mt-2 block w-full rounded-xl border border-[var(--gold)]/35 bg-white p-3 text-base text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={saveNotes}
            disabled={notesState === 'saving' || notes === (client.notes ?? '') && notesState !== 'error'}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-white px-5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-50"
          >
            {notesState === 'saving' && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {t('saveNotes')}
          </button>
          <span role="status" className={`text-sm font-semibold ${notesState === 'error' ? 'text-red-700' : 'text-[#1d6b34]'}`}>
            {notesState === 'saved' ? t('saved') : notesState === 'error' ? t('errors.saveError') : ''}
          </span>
        </div>
      </section>

      <section className={card}>
        {editing ? (
          <>
            <h3 className="mb-4 text-base font-extrabold text-[var(--ink)]">{t('editClient')}</h3>
            <ClientForm
              initial={{
                name: client.name,
                contactName: client.contact_name ?? '',
                vat: client.vat ?? '',
                address: client.address ?? '',
                city: client.city ?? '',
                postalCode: client.postal_code ?? '',
                pec: client.pec ?? '',
                email: client.email ?? '',
                phone: client.phone ?? '',
              }}
              submitLabel={t('saveClient')}
              onSubmit={saveDetails}
              onCancel={() => setEditing(false)}
            />
          </>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-white px-5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t('editClient')}
            </button>
            <button
              type="button"
              onClick={remove}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('deleteClient')}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
