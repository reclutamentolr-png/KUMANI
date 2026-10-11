'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, FilePlus2, LoaderCircle, Mail, MessageCircle, Pencil, Phone, Trash2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { askConfirm } from '@/lib/confirm'
import { deleteClientRecord, saveClientNotes, setNextStep, updateClientRecord } from '@/app/actions/clienti'
import {
  CLIENT_LIMITS,
  QUICK_STEPS,
  formatEur,
  isStepDue,
  romeToday,
  whatsappDigits,
  type ClientFormData,
  type ClientQuote,
  type ClientRecord,
} from '@/lib/clienti'
import ClientForm, { inputClass } from './ClientForm'

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm'
const contactBtn =
  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-bold transition-opacity hover:opacity-90'

export default function ClienteCard({ client: initial, quotes, canQuote }: { client: ClientRecord; quotes: ClientQuote[]; canQuote: boolean }) {
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

  const formatDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' })
  const accepted = quotes.filter((q) => q.accepted).reduce((s, q) => s + q.gross, 0)
  const paid = quotes.reduce((s, q) => s + q.paid_amount, 0)
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
    if (!result.success) return t(`errors.${result.message === 'duplicateName' || result.message === 'nameRequired' ? result.message : 'saveError'}`)
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
    router.push('/marketplace/clienti')
  }

  const quoteState = (q: ClientQuote) =>
    q.payment_status === 'paid' ? t('quotePaid') : q.payment_status === 'refunded' ? t('quoteRefunded') : q.accepted ? t('quoteAccepted') : t('quoteWaiting')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="break-words text-3xl font-bold text-[var(--ink)]">{client.name}</h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>}
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
              href={`/marketplace/preventivi/new?client=${client.id}`}
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
                <Link href={`/marketplace/preventivi/${q.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-[#8a6a1f]">
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
