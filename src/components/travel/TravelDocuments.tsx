'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, CircleSlash, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { deleteDocument, saveDocument, setRequiredDocs } from '@/app/actions/travel'
import { DOC_TYPES, docStatus, type DocStatus, type DocType, type TripDetail, type TripDocument } from '@/lib/travel'
import { askConfirm } from '@/lib/confirm'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'

const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'

const STATUS_STYLE: Record<DocStatus, { tone: string; Icon: typeof CheckCircle2 }> = {
  ok: { tone: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle2 },
  warning: { tone: 'bg-amber-100 text-amber-700', Icon: AlertTriangle },
  expired: { tone: 'bg-red-100 text-red-700', Icon: XCircle },
  missing: { tone: 'bg-gray-100 text-gray-500', Icon: CircleSlash },
}

// Documenti del viaggio: solo tipo e scadenza (niente foto né numeri).
// Ognuno vede e gestisce i propri; l'organizzatore sceglie quelli richiesti e
// vede a colpo d'occhio chi è in regola.
export default function TravelDocuments({
  detail,
  documents,
  today,
  hasLifeCalendar,
  onChanged,
}: {
  detail: TripDetail
  documents: TripDocument[]
  today: string
  hasLifeCalendar: boolean
  onChanged: () => Promise<void>
}) {
  const t = useTranslations('travel')
  const locale = useLocale()
  const [form, setForm] = useState<{ doc: TripDocument | null; type: DocType } | null>(null)
  const [savingRequired, setSavingRequired] = useState(false)

  const required = (detail.required_docs ?? []) as DocType[]
  const mine = documents.filter((d) => d.member_id === detail.my_member_id)
  const status = (doc: TripDocument | null) => docStatus(doc, detail, today)
  const date = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const missingMine = required.filter((type) => !mine.some((d) => d.doc_type === type))

  const toggleRequired = async (type: DocType) => {
    setSavingRequired(true)
    try {
      const next = required.includes(type) ? required.filter((x) => x !== type) : [...required, type]
      const result = await setRequiredDocs(detail.id, next)
      if (!result.success) alert(t('error_saveError'))
    } finally {
      setSavingRequired(false)
      await onChanged()
    }
  }

  const badge = (value: DocStatus) => {
    const { tone, Icon } = STATUS_STYLE[value]
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>
        <Icon className="h-3.5 w-3.5" /> {t(`docStatus_${value}`)}
      </span>
    )
  }

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-xl bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('docsPrivacy')}
      </p>

      {/* Documenti richiesti */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 flex items-center gap-2 font-bold text-[var(--ink)]">
          {t('requiredDocs')} {savingRequired && <LoaderCircle className="h-4 w-4 animate-spin text-[var(--gold)]" />}
        </h3>
        <p className="mb-3 text-xs text-[var(--muted)]">{detail.is_owner ? t('requiredDocsOwnerHint') : t('requiredDocsHint')}</p>
        <div className="flex flex-wrap gap-2">
          {(detail.is_owner ? DOC_TYPES : required).map((type) => {
            const on = required.includes(type)
            return detail.is_owner ? (
              <button
                key={type}
                type="button"
                disabled={savingRequired}
                onClick={() => toggleRequired(type)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-gray-200 bg-white text-gray-500'}`}
              >
                {t(`doc_${type}`)}
              </button>
            ) : (
              <span key={type} className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-sm font-semibold text-white">
                {t(`doc_${type}`)}
              </span>
            )
          })}
          {!detail.is_owner && required.length === 0 && <span className="text-sm text-[var(--muted)]">{t('noRequiredDocs')}</span>}
        </div>
      </section>

      {/* I miei documenti */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold text-[var(--ink)]">{t('myDocs')}</h3>
          <button type="button" onClick={() => setForm({ doc: null, type: missingMine[0] ?? 'passport' })} className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> {t('addDoc')}
          </button>
        </div>
        <ul className="space-y-2">
          {missingMine.map((type) => (
            <li key={`missing-${type}`} className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2.5">
              <span className="flex-1 font-semibold text-[var(--ink)]">{t(`doc_${type}`)}</span>
              {badge('missing')}
              <button type="button" onClick={() => setForm({ doc: null, type })} className="rounded-lg bg-[var(--gold)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">
                {t('addDocShort')}
              </button>
            </li>
          ))}
          {mine.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--ink)]">
                  {t(`doc_${doc.doc_type}`)}
                  {doc.label && <span className="font-normal text-[var(--muted)]"> · {doc.label}</span>}
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  {doc.expires_on ? t('expiresOn', { date: date(doc.expires_on) }) : t('noExpiry')}
                  {doc.life_calendar_item_id && ` · ${t('inLifeCalendar')}`}
                </span>
              </span>
              {badge(status(doc))}
              <button type="button" onClick={() => setForm({ doc, type: doc.doc_type })} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[var(--ink)]" aria-label={t('editDoc')}>
                <Pencil className="h-4 w-4" />
              </button>
            </li>
          ))}
          {mine.length === 0 && missingMine.length === 0 && <li className="text-sm text-[var(--muted)]">{t('myDocsEmpty')}</li>}
        </ul>
      </section>

      {/* Il gruppo (solo organizzatore) */}
      {detail.is_owner && required.length > 0 && (
        <section className="rounded-2xl border border-[var(--gold)]/40 bg-white p-4">
          <h3 className="mb-3 font-bold text-[var(--ink)]">{t('groupDocs')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted)]">
                  <th className="py-1 pr-3 font-semibold">{t('tabMembers')}</th>
                  {required.map((type) => (
                    <th key={type} className="px-2 py-1 font-semibold">
                      {t(`doc_${type}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.members.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="py-2 pr-3 font-semibold text-[var(--ink)]">{m.name}</td>
                    {required.map((type) => {
                      const doc = documents.find((d) => d.member_id === m.id && d.doc_type === type) ?? null
                      const value = status(doc)
                      const { tone, Icon } = STATUS_STYLE[value]
                      return (
                        <td key={type} className="px-2 py-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${tone}`} title={doc?.expires_on ? date(doc.expires_on) : undefined}>
                            <Icon className="h-3.5 w-3.5" /> {t(`docStatus_${value}`)}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {form && (
        <Sheet title={form.doc ? t('editDoc') : t('addDoc')} onClose={() => setForm(null)}>
          <DocumentForm
            tripId={detail.id}
            tripTitle={detail.title}
            doc={form.doc}
            initialType={form.type}
            hasLifeCalendar={hasLifeCalendar}
            onDone={async () => {
              setForm(null)
              await onChanged()
            }}
          />
        </Sheet>
      )}
    </div>
  )
}

function DocumentForm({
  tripId,
  tripTitle,
  doc,
  initialType,
  hasLifeCalendar,
  onDone,
}: {
  tripId: string
  tripTitle: string
  doc: TripDocument | null
  initialType: DocType
  hasLifeCalendar: boolean
  onDone: () => Promise<void>
}) {
  const t = useTranslations('travel')
  const [docType, setDocType] = useState<DocType>(doc?.doc_type ?? initialType)
  const [docLabel, setDocLabel] = useState(doc?.label ?? '')
  const [expiresOn, setExpiresOn] = useState(doc?.expires_on ?? '')
  const [toLifeCalendar, setToLifeCalendar] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await saveDocument(tripId, {
        id: doc?.id,
        docType,
        label: docLabel,
        expiresOn,
        addToLifeCalendar: hasLifeCalendar && toLifeCalendar,
        reminderTitle: `${t(`doc_${docType}`)}${docLabel ? ` (${docLabel})` : ''} — ${tripTitle}`,
      })
      if (result.success) await onDone()
      else setError(t(`error_${result.error}`))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!doc || !(await askConfirm(t('deleteDocConfirm')))) return
    setBusy(true)
    try {
      const result = await deleteDocument(doc.id)
      if (result.success) await onDone()
      else setError(t('error_saveError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={label}>{t('docType')}</label>
        <select className={input} value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
          {DOC_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`doc_${type}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>{t('docLabel')}</label>
        <input className={input} value={docLabel} maxLength={60} onChange={(e) => setDocLabel(e.target.value)} placeholder={t('docLabelPlaceholder')} />
      </div>
      <div>
        <label className={label}>{t('docExpiry')}</label>
        <input type="date" className={input} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
      </div>
      {hasLifeCalendar && !doc?.life_calendar_item_id && (
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--ink)]" checked={toLifeCalendar} onChange={(e) => setToLifeCalendar(e.target.checked)} />
          <span>
            <strong className="block text-[var(--ink)]">{t('addToLifeCalendar')}</strong>
            {t('addToLifeCalendarHint')}
          </span>
        </label>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        {doc && (
          <button type="button" onClick={remove} disabled={busy} className="flex items-center gap-1 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> {t('delete')}
          </button>
        )}
        <CancelButton className={cancelButtonLgClass} />
        <button type="submit" disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-white disabled:opacity-60">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {t('save')}
        </button>
      </div>
    </form>
  )
}
