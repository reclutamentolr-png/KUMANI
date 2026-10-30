'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'
import { askConfirm } from '@/lib/confirm'
import { downloadCsv, toCsv } from '@/lib/magazzino'
import { deleteClient, deleteReceipt, listReceipts, setReceiptCancelled, setReceiptPaid } from '@/app/actions/ricevutaOccasionale'
import {
  RO_INPS_NEAR_CENTS,
  RO_INPS_THRESHOLD_CENTS,
  centsIt,
  dateIt,
  formatCents,
  formatDate,
  receiptFileName,
  romeTodayIso,
  yearTotals,
  type IssuerProfile,
  type OccasionalReceipt,
  type ReceiptClient,
} from '@/lib/ricevutaOccasionale'
import { ClientSheetForm, ProfileForm, ReceiptSheetForm, inputClass, labelClass, primaryClass, useErrorText } from './RicevutaForms'

type Tab = 'receipts' | 'clients' | 'profile'
type SheetState =
  | { kind: 'receipt'; receipt: OccasionalReceipt | null }
  | { kind: 'client'; client: ReceiptClient | null }
  | { kind: 'paid'; receipt: OccasionalReceipt }
  | null

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function RicevutaOccasionaleApp({
  initialProfile,
  initialClients,
  initialReceipts,
  initialLoadError = false,
  initialYear,
  firstYear,
}: {
  initialProfile: IssuerProfile | null
  initialClients: ReceiptClient[]
  initialReceipts: OccasionalReceipt[]
  /** Le ricevute dell'anno non si sono potute leggere */
  initialLoadError?: boolean
  initialYear: number
  firstYear: number | null
}) {
  const t = useTranslations('ricevutaOccasionale')
  const locale = useLocale()
  const errorText = useErrorText()
  const money = (c: number) => formatCents(c, locale)

  const [tab, setTab] = useState<Tab>(initialProfile ? 'receipts' : 'profile')
  const [profile, setProfile] = useState(initialProfile)
  const [clients, setClients] = useState(initialClients)
  const [year, setYear] = useState(initialYear)
  const [receipts, setReceipts] = useState(initialReceipts)
  // Ricevute già caricate per anno (per l'avviso dei 5.000 € nella finestra)
  const [byYear, setByYear] = useState<Record<number, OccasionalReceipt[]>>(initialLoadError ? {} : { [initialYear]: initialReceipts })
  const [loading, setLoading] = useState(false)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(initialLoadError ? { ok: false, text: t('loadError') } : null)
  // Ultimo anno chiesto: una risposta arrivata in ritardo per un altro anno non conta
  const yearRequest = useRef(initialYear)
  const [pdfBusy, setPdfBusy] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const currentYear = Number(romeTodayIso().slice(0, 4))
  const years = useMemo(() => {
    const from = Math.min(firstYear ?? currentYear, currentYear, year)
    const to = Math.max(currentYear, year)
    return Array.from({ length: to - from + 1 }, (_, i) => to - i)
  }, [firstYear, currentYear, year])

  const totals = useMemo(() => yearTotals(receipts), [receipts])
  const lastNumber = receipts.reduce((max, r) => Math.max(max, r.number), 0)

  const loadYear = useCallback(
    async (y: number) => {
      yearRequest.current = y
      setYear(y)
      setLoading(true)
      let list: OccasionalReceipt[] | null = null
      try {
        list = await listReceipts(y)
      } catch {
        list = null
      }
      if (yearRequest.current !== y) return
      setLoading(false)
      if (!list) {
        setReceipts([])
        setNotice({ ok: false, text: t('loadError') })
        return
      }
      setReceipts(list)
      setByYear((m) => ({ ...m, [y]: list }))
    },
    [t],
  )

  // Una ricevuta cambiata: si aggiorna nell'elenco del suo anno
  const putReceipt = (r: OccasionalReceipt) => {
    setByYear((m) => {
      const list = m[r.year] ?? []
      const next = list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [r, ...list].sort((a, b) => b.number - a.number)
      return { ...m, [r.year]: next }
    })
    if (r.year === year) {
      setReceipts((list) => (list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [r, ...list].sort((a, b) => b.number - a.number)))
    }
  }

  const putClient = (c: ReceiptClient) =>
    setClients((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]).sort((a, b) => a.name.localeCompare(b.name)))

  // Compensi dell'anno senza la ricevuta che si sta modificando
  const yearGrossFor = (editingId: string | null) => (y: number) =>
    yearTotals((byYear[y] ?? []).filter((r) => r.id !== editingId)).grossCents

  const downloadPdf = async (r: OccasionalReceipt) => {
    setPdfBusy(r.id)
    try {
      const { buildReceiptPdfBlob } = await import('@/lib/ricevutaOccasionalePdf')
      downloadBlob(await buildReceiptPdfBlob(r), receiptFileName(r))
    } catch (err) {
      console.error(err)
      setNotice({ ok: false, text: t('pdfError') })
    } finally {
      setPdfBusy(null)
    }
  }

  const exportCsv = () => {
    const rows: (string | null)[][] = [
      [
        t('csvNumber'),
        t('csvDate'),
        t('csvClient'),
        t('csvClientTaxId'),
        t('csvClientKind'),
        t('csvDescription'),
        t('csvGross'),
        t('csvExpenses'),
        t('csvWithholding'),
        t('csvStamp'),
        t('csvTotal'),
        t('csvNet'),
        t('csvPaidOn'),
        t('csvStatus'),
      ],
      ...[...receipts]
        .sort((a, b) => a.number - b.number)
        .map((r) => [
          `${r.number}/${r.year}`,
          dateIt(r.issue_date),
          r.client_name,
          r.client_tax_id,
          r.client_kind === 'withholding' ? t('kindWithholding') : t('kindPrivate'),
          r.description.replace(/\s+/g, ' '),
          centsIt(r.gross_cents),
          centsIt(r.expenses_cents),
          centsIt(r.withholding_cents),
          centsIt(r.stamp_cents),
          centsIt(r.total_cents),
          centsIt(r.net_cents),
          r.paid_on ? dateIt(r.paid_on) : '',
          r.cancelled_at ? t('statusCancelled') : r.paid_on ? t('statusPaid') : t('statusUnpaid'),
        ]),
    ]
    downloadCsv(`ricevute-occasionali-${year}.csv`, toCsv(rows))
  }

  const run = async (id: string, action: () => Promise<{ success: true; data: OccasionalReceipt } | { success: false; message: string }>) => {
    setRowBusy(id)
    let result: Awaited<ReturnType<typeof action>>
    try {
      result = await action()
    } catch {
      result = { success: false, message: 'saveError' }
    }
    setRowBusy(null)
    if (!result.success) return setNotice({ ok: false, text: errorText(result.message) })
    putReceipt(result.data)
  }

  const tabButton = (key: Tab, Icon: typeof User, text: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-bold transition-colors sm:flex-none sm:gap-2 sm:px-5 ${
        tab === key ? 'bg-[var(--ink)] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{text}</span>
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1.5">
        {tabButton('receipts', FileSpreadsheet, t('tabReceipts'))}
        {tabButton('clients', Users, t('tabClients'))}
        {tabButton('profile', User, t('tabProfile'))}
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}
        >
          <span>{notice.text}</span>
          <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>
            {t('close')}
          </button>
        </div>
      )}

      {tab === 'receipts' && (
        <div className="space-y-4">
          {!profile ? (
            <div className="rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/50 p-5">
              <p className="font-bold text-[var(--ink)]">{t('profileFirstTitle')}</p>
              <p className="mt-1 text-sm text-gray-700">{t('profileFirstText')}</p>
              <button type="button" onClick={() => setTab('profile')} className={`${primaryClass} mt-3 sm:w-auto`}>
                <User className="h-4 w-4" /> {t('profileFirstButton')}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setSheet({ kind: 'receipt', receipt: null })} className={primaryClass}>
              <Plus className="h-5 w-5" /> {t('newReceipt')}
            </button>
          )}

          {/* Anno e totali */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                {t('yearLabel')}
                <select className="rounded-xl border border-gray-300 px-3 py-2 text-[15px]" value={year} onChange={(e) => loadYear(Number(e.target.value))}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                data-guest-hide
                onClick={exportCsv}
                disabled={!receipts.length}
                className="flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> {t('exportCsv')}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('totalGross')} value={money(totals.grossCents)} />
              <Stat label={t('totalWithholding')} value={money(totals.withholdingCents)} />
              <Stat label={t('totalNet')} value={money(totals.netCents)} strong />
              <Stat label={t('totalCount')} value={String(totals.count)} />
            </div>
            {totals.count > 0 && (
              <p className="mt-3 text-sm text-gray-600">
                {t('totalPaidUnpaid', { paid: money(totals.paidNetCents), unpaid: money(totals.unpaidNetCents) })}
              </p>
            )}
            {totals.grossCents > RO_INPS_THRESHOLD_CENTS ? (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t('inpsOver', { year, over: money(totals.grossCents - RO_INPS_THRESHOLD_CENTS) })}
              </p>
            ) : totals.grossCents >= RO_INPS_NEAR_CENTS ? (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t('inpsNear', { left: money(RO_INPS_THRESHOLD_CENTS - totals.grossCents) })}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-[var(--muted)]">{t('inpsHint')}</p>
          </div>

          {/* Elenco */}
          {loading ? (
            <div className="flex justify-center py-8">
              <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" />
            </div>
          ) : receipts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-[var(--muted)]">{t('emptyReceipts', { year })}</p>
          ) : (
            <ul className="space-y-3">
              {receipts.map((r) => {
                const busy = rowBusy === r.id
                return (
                  <li key={r.id} className={`rounded-2xl border bg-white p-4 ${r.cancelled_at ? 'border-gray-200 opacity-70' : 'border-gray-200'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--ink)]">
                          {t('receiptNumber', { number: r.number, year: r.year })}{' '}
                          <span className="font-normal text-[var(--muted)]">· {formatDate(r.issue_date, locale)}</span>
                        </p>
                        <p className="truncate text-sm font-semibold text-gray-700">{r.client_name}</p>
                      </div>
                      <StatusBadge receipt={r} locale={locale} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">{r.description}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                      <span>
                        {t('listGross')} <b className="tabular-nums">{money(r.gross_cents + r.expenses_cents)}</b>
                      </span>
                      {r.withholding && (
                        <span>
                          {t('listWithholding')} <b className="tabular-nums">{money(r.withholding_cents)}</b>
                        </span>
                      )}
                      <span>
                        {t('listNet')} <b className="tabular-nums text-[var(--ink)]">{money(r.net_cents)}</b>
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton data-guest-hide onClick={() => downloadPdf(r)} disabled={pdfBusy === r.id} primary>
                        {pdfBusy === r.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t('pdf')}
                      </ActionButton>
                      {!r.cancelled_at && (
                        <>
                          {r.paid_on ? (
                            <ActionButton
                              disabled={busy}
                              onClick={async () => {
                                if (!(await askConfirm(t('unpaidConfirm', { number: r.number, year: r.year })))) return
                                await run(r.id, () => setReceiptPaid(r.id, null))
                              }}
                            >
                              <RotateCcw className="h-4 w-4" /> {t('markUnpaid')}
                            </ActionButton>
                          ) : (
                            <ActionButton disabled={busy} onClick={() => setSheet({ kind: 'paid', receipt: r })}>
                              <CheckCircle2 className="h-4 w-4" /> {t('markPaid')}
                            </ActionButton>
                          )}
                          <ActionButton disabled={busy || !profile} onClick={() => setSheet({ kind: 'receipt', receipt: r })}>
                            <Pencil className="h-4 w-4" /> {t('edit')}
                          </ActionButton>
                          <ActionButton
                            disabled={busy}
                            onClick={async () => {
                              if (!(await askConfirm(t('cancelConfirm', { number: r.number, year: r.year }), { tone: 'warning' }))) return
                              await run(r.id, () => setReceiptCancelled(r.id, true))
                            }}
                          >
                            <Ban className="h-4 w-4" /> {t('cancelReceipt')}
                          </ActionButton>
                        </>
                      )}
                      {r.cancelled_at && (
                        <ActionButton disabled={busy} onClick={() => run(r.id, () => setReceiptCancelled(r.id, false))}>
                          <RotateCcw className="h-4 w-4" /> {t('restoreReceipt')}
                        </ActionButton>
                      )}
                      {r.number === lastNumber && (
                        <ActionButton
                          danger
                          disabled={busy}
                          onClick={async () => {
                            if (!(await askConfirm(t('deleteConfirm', { number: r.number, year: r.year })))) return
                            setRowBusy(r.id)
                            const result = await deleteReceipt(r.id).catch(() => ({ success: false as const, message: 'deleteError' }))
                            setRowBusy(null)
                            if (!result.success) return setNotice({ ok: false, text: errorText(result.message) })
                            setReceipts((list) => list.filter((x) => x.id !== r.id))
                            setByYear((m) => ({ ...m, [r.year]: (m[r.year] ?? []).filter((x) => x.id !== r.id) }))
                          }}
                        >
                          <Trash2 className="h-4 w-4" /> {t('delete')}
                        </ActionButton>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {receipts.length > 1 && <p className="text-xs text-[var(--muted)]">{t('deleteHint')}</p>}
        </div>
      )}

      {tab === 'clients' && (
        <div className="space-y-4">
          <button type="button" onClick={() => setSheet({ kind: 'client', client: null })} className={primaryClass}>
            <Plus className="h-5 w-5" /> {t('newClient')}
          </button>
          {clients.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-[var(--muted)]">{t('emptyClients')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
              {clients.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-4">
                  {c.kind === 'withholding' ? <Building2 className="h-5 w-5 shrink-0 text-[var(--gold)]" /> : <User className="h-5 w-5 shrink-0 text-[var(--gold)]" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--ink)]">{c.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {c.kind === 'withholding' ? t('kindWithholding') : t('kindPrivate')}
                      {c.tax_id ? ` · ${c.tax_id}` : ''}
                      {c.city ? ` · ${c.city}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    title={t('edit')}
                    aria-label={t('edit')}
                    onClick={() => setSheet({ kind: 'client', client: c })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={t('delete')}
                    aria-label={t('delete')}
                    onClick={async () => {
                      if (!(await askConfirm(t('deleteClientConfirm', { name: c.name })))) return
                      const result = await deleteClient(c.id).catch(() => ({ success: false as const, message: 'deleteError' }))
                      if (!result.success) return setNotice({ ok: false, text: errorText(result.message) })
                      setClients((list) => list.filter((x) => x.id !== c.id))
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-[var(--muted)]">{t('clientsHint')}</p>
        </div>
      )}

      {tab === 'profile' && (
        <ProfileForm
          profile={profile}
          onSaved={(p) => {
            const first = !profile
            setProfile(p)
            if (first) {
              setTab('receipts')
              setNotice({ ok: true, text: t('profileSavedFirst') })
            }
          }}
        />
      )}

      {/* Avviso fisso */}
      <p className="flex items-start gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('disclaimer')}
      </p>

      {sheet?.kind === 'receipt' && profile && (
        <Sheet title={sheet.receipt ? t('editReceiptTitle', { number: sheet.receipt.number, year: sheet.receipt.year }) : t('newReceipt')} onClose={() => setSheet(null)}>
          <ReceiptSheetForm
            receipt={sheet.receipt}
            profile={profile}
            clients={clients}
            yearGrossCents={yearGrossFor(sheet.receipt?.id ?? null)}
            onSaved={(r, newClient) => {
              const isNew = !sheet.receipt
              if (newClient) putClient(newClient)
              putReceipt(r)
              setSheet(null)
              // Ricevuta nuova di un altro anno: si va a quell'anno
              if (isNew && r.year !== year) void loadYear(r.year)
              setNotice({ ok: true, text: isNew ? t('receiptCreated', { number: r.number, year: r.year }) : t('receiptSaved') })
            }}
          />
        </Sheet>
      )}

      {sheet?.kind === 'client' && (
        <Sheet title={sheet.client ? t('editClientTitle') : t('newClient')} onClose={() => setSheet(null)}>
          <ClientSheetForm
            client={sheet.client}
            onSaved={(c) => {
              putClient(c)
              setSheet(null)
            }}
          />
        </Sheet>
      )}

      {sheet?.kind === 'paid' && (
        <Sheet title={t('markPaidTitle', { number: sheet.receipt.number, year: sheet.receipt.year })} onClose={() => setSheet(null)}>
          <PaidForm
            receipt={sheet.receipt}
            onSaved={(r) => {
              putReceipt(r)
              setSheet(null)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${strong ? 'bg-[var(--ink)] text-white' : 'bg-gray-50'}`}>
      <p className={`text-xs font-semibold ${strong ? 'text-[var(--gold-bright)]' : 'text-[var(--muted)]'}`}>{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}

function StatusBadge({ receipt: r, locale }: { receipt: OccasionalReceipt; locale: string }) {
  const t = useTranslations('ricevutaOccasionale')
  if (r.cancelled_at) return <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-bold text-gray-700">{t('statusCancelled')}</span>
  if (r.paid_on)
    return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{t('statusPaidOn', { date: formatDate(r.paid_on, locale) })}</span>
  return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{t('statusUnpaid')}</span>
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
  danger,
  ...rest
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  danger?: boolean
  'data-guest-hide'?: boolean
}) {
  return (
    <button
      type="button"
      {...rest}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
        primary
          ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]'
          : danger
            ? 'border border-red-200 text-red-600'
            : 'border border-gray-300 text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function PaidForm({ receipt, onSaved }: { receipt: OccasionalReceipt; onSaved: (r: OccasionalReceipt) => void }) {
  const t = useTranslations('ricevutaOccasionale')
  const locale = useLocale()
  const errorText = useErrorText()
  const [date, setDate] = useState(romeTodayIso())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const result = await setReceiptPaid(receipt.id, date).catch(() => ({ success: false as const, message: 'saveError' }))
        setBusy(false)
        if (!result.success) return setError(errorText(result.message))
        onSaved(result.data)
      }}
    >
      <p className="text-sm text-gray-700">{t('markPaidText', { net: formatCents(receipt.net_cents, locale), client: receipt.client_name })}</p>
      <div>
        <label className={labelClass} htmlFor="ro-paid-date">
          {t('fieldPaidOn')}
        </label>
        <input id="ro-paid-date" type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex gap-2">
        <CancelButton className={cancelButtonLgClass} />
        <button type="submit" disabled={busy || !date} className={primaryClass}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {t('markPaid')}
        </button>
      </div>
    </form>
  )
}
