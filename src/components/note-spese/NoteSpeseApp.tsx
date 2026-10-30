'use client'

import { useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  CircleCheck,
  Copy,
  FileDown,
  FileSpreadsheet,
  LoaderCircle,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react'
import { askConfirm } from '@/lib/confirm'
import { deleteReport, getReport, listReports, refreshReceiptUrls } from '@/app/actions/noteSpese'
import {
  computeTotals,
  downloadBlob,
  fileSlug,
  formatCents,
  formatDay,
  formatKm,
  formatRate,
  itemKm,
  romeToday,
  routeText,
  sortItems,
  toCsv,
  type ExpenseCategory,
  type ExpenseItem,
  type ExpenseReport,
  type ExpenseReportSummary,
  type ReportStatus,
} from '@/lib/noteSpese'
import type { ExpensePdfLabels } from '@/lib/noteSpesePdf'
import ItemSheet from './ItemSheet'
import { DuplicateSheet, ReportSheet, StatusSheet } from './ReportSheets'
import { CategoryIcon, STATUS_STYLES, card, primary, secondary } from './shared'

// Oggi, ma dentro il periodo della nota se è già scritto
function defaultDay(report: ExpenseReport): string {
  const today = romeToday()
  if (report.period_from && today < report.period_from) return report.period_from
  if (report.period_to && today > report.period_to) return report.period_to
  return today
}

type SheetState =
  | { kind: 'report'; report: ExpenseReport | null }
  | { kind: 'item'; item: ExpenseItem | null; file: File | null }
  | { kind: 'status'; status: ReportStatus }
  | { kind: 'duplicate' }
  | null

export default function NoteSpeseApp({
  initialReports,
  initialDetail = null,
  initialLoadError = false,
}: {
  initialReports: ExpenseReportSummary[]
  // Elenco non letto (errore del database): si dice, non si mostra vuoto
  initialLoadError?: boolean
  // Nota da aprire subito (anteprima con dati di prova)
  initialDetail?: { report: ExpenseReport; items: ExpenseItem[] } | null
}) {
  const t = useTranslations('noteSpese')
  const locale = useLocale()
  const [reports, setReports] = useState(initialReports)
  const [detail, setDetail] = useState<{ report: ExpenseReport; items: ExpenseItem[] } | null>(initialDetail)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const loadErrorText = () => (t.has('error_load') ? t('error_load') : t('error_saveError'))
  const [notice, setNotice] = useState<string | null>(() => (initialLoadError ? loadErrorText() : null))
  const [exporting, setExporting] = useState(false)
  // Ultima data e categoria usate: la voce dopo parte già da lì
  const [lastUsed, setLastUsed] = useState<{ spentOn: string; category: ExpenseCategory } | null>(null)
  const quickPhotoRef = useRef<HTMLInputElement>(null)

  const money = (cents: number) => formatCents(cents, locale)
  const day = (d: string | null) => formatDay(d, locale)

  const statusText = (r: ExpenseReport) =>
    r.status === 'submitted' ? t('statusSubmittedOn', { date: day(r.submitted_on) }) : r.status === 'reimbursed' ? t('statusReimbursedOn', { date: day(r.reimbursed_on) }) : t('status_open')

  const periodText = (r: ExpenseReport) => {
    const from = day(r.period_from)
    const to = day(r.period_to)
    return from && to && from !== to ? `${from} – ${to}` : from || to
  }

  const refreshList = async () => {
    const list = await listReports().catch(() => null)
    if (list) setReports(list)
    else setNotice(loadErrorText())
  }

  const openReport = async (id: string) => {
    setLoadingId(id)
    setNotice(null)
    const data = await getReport(id).catch(() => null)
    setLoadingId(null)
    if (!data) {
      setNotice(t('error_saveError'))
      return
    }
    setLastUsed(null)
    setDetail(data)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeReport = () => {
    setDetail(null)
    setNotice(null)
    void refreshList()
  }

  const suggestion = useMemo(() => ({ employeeName: reports[0]?.employee_name ?? '', recipient: reports[0]?.recipient ?? '' }), [reports])

  // ——— Elenco delle note spese ———
  if (!detail) {
    return (
      <div className="space-y-4">
        {notice && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{notice}</p>}
        <button type="button" onClick={() => setSheet({ kind: 'report', report: null })} className={`${primary} text-lg`}>
          <Plus className="h-5 w-5" /> {t('reportNew')}
        </button>

        {reports.length === 0 ? (
          <div className={`${card} text-center`}>
            <ReceiptText className="mx-auto h-10 w-10 text-[var(--gold)]" />
            <p className="mt-3 text-lg font-bold text-[var(--ink)]">{t('emptyTitle')}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{t('emptyText')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => openReport(r.id)} className={`${card} flex w-full items-center gap-3 text-left transition hover:border-[var(--gold)]/60`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-[var(--ink)]">{r.title}</p>
                    <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{[periodText(r), r.recipient].filter(Boolean).join(' · ')}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2.5 py-1 font-semibold ${STATUS_STYLES[r.status]}`}>{statusText(r)}</span>
                      <span className="text-[var(--muted)]">{t('itemsCount', { n: r.items_count })}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-[var(--ink)]">{money(r.total_cents)}</p>
                    {loadingId === r.id ? <LoaderCircle className="ml-auto mt-1 h-5 w-5 animate-spin text-[var(--gold)]" /> : <ChevronRight className="ml-auto mt-1 h-5 w-5 text-gray-400" />}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {sheet?.kind === 'report' && (
          <ReportSheet
            report={null}
            suggestion={suggestion}
            onClose={() => setSheet(null)}
            onSaved={(report) => {
              setSheet(null)
              setReports((list) => [{ ...report, items_count: 0, total_cents: 0 }, ...list])
              setDetail({ report, items: [] })
            }}
          />
        )}
      </div>
    )
  }

  // ——— Una nota spese ———
  const { report } = detail
  const items = sortItems(detail.items)
  const totals = computeTotals(items, report.advance_cents)

  const updateReport = (next: ExpenseReport) => {
    setDetail((d) => (d ? { ...d, report: next } : d))
    setSheet(null)
  }

  const exportCsv = () => {
    const rows: (string | number | null)[][] = [
      [t('colDate'), t('colCategory'), t('colDescription'), t('fieldFrom'), t('fieldTo'), t('colKm'), t('fieldRoundTrip'), t('colRate'), t('colAmount'), t('fieldReceipt')],
      ...items.map((it) => [
        it.spent_on,
        t(`cat_${it.category}`),
        it.description,
        it.route_from,
        it.route_to,
        it.category === 'mileage' ? itemKm(it) : null,
        it.category === 'mileage' ? (it.round_trip ? t('yes') : t('no')) : null,
        it.km_rate,
        it.amount_cents / 100,
        it.receipt_path ? t('yes') : t('no'),
      ]),
      [],
      [t('totalExpenses'), null, null, null, null, totals.totalKm || null, null, null, totals.totalCents / 100, null],
      ...(totals.advanceCents > 0 ? [[t('advance'), null, null, null, null, null, null, null, -totals.advanceCents / 100, null]] : []),
      [totals.dueCents >= 0 ? t('due') : t('dueBack'), null, null, null, null, null, null, null, Math.abs(totals.dueCents) / 100, null],
    ]
    downloadBlob(`${fileSlug(report.title)}.csv`, new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  }

  const exportPdf = async () => {
    setExporting(true)
    setNotice(null)
    try {
      // Link delle foto rinnovati: quelli caricati con la pagina scadono dopo un'ora
      const urls = items.some((i) => i.receipt_path) ? await refreshReceiptUrls(report.id) : {}
      const withUrls = items.map((i) => ({ ...i, receipt_url: urls[i.id] ?? i.receipt_url }))
      const labels: ExpensePdfLabels = {
        docTitle: t('pdfTitle'),
        employee: t('fieldEmployee'),
        recipient: t('fieldRecipient'),
        period: t('pdfPeriod'),
        status: t('pdfStatus'),
        statusText: statusText(report),
        colNumber: t('pdfColNumber'),
        colDate: t('colDate'),
        colCategory: t('colCategory'),
        colDescription: t('colDescription'),
        colAttachment: t('pdfColAttachment'),
        colAmount: t('colAmount'),
        category: (c) => t(`cat_${c}`),
        roundTrip: t('roundTripShort'),
        perKm: t('perKm'),
        totalsTitle: t('totalsTitle'),
        totalKm: t('totalKm'),
        totalExpenses: t('totalExpenses'),
        advance: t('advance'),
        due: t('due'),
        dueBack: t('dueBack'),
        notes: t('fieldNotes'),
        signEmployee: t('pdfSignEmployee'),
        signManager: t('pdfSignManager'),
        signDate: t('pdfSignDate'),
        attachmentsTitle: t('pdfAttachments'),
        attachment: (n) => t('pdfAttachment', { n }),
        noItems: t('noItems'),
        pageOf: (page, pages) => t('pdfPageOf', { page, pages }),
      }
      const { generateExpensePdf } = await import('@/lib/noteSpesePdf')
      const { blob, missingPhotos } = await generateExpensePdf({ report, items: withUrls, labels, locale })
      downloadBlob(`${fileSlug(report.title)}.pdf`, blob)
      // Foto non scaricate (rete): il PDF esce lo stesso, ma bisogna saperlo
      if (missingPhotos > 0) setNotice(t.has('pdfPhotosMissing') ? t('pdfPhotosMissing', { n: missingPhotos }) : t('error_pdf'))
    } catch (e) {
      console.error('[NoteSpese] pdf', e)
      setNotice(t('error_pdf'))
    }
    setExporting(false)
  }

  const removeReport = async () => {
    if (!(await askConfirm(t('reportDeleteConfirm', { title: report.title })))) return
    const result = await deleteReport(report.id).catch(() => null)
    if (!result?.success) {
      setNotice(t('error_saveError'))
      return
    }
    setReports((list) => list.filter((r) => r.id !== report.id))
    setDetail(null)
  }

  const onQuickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setSheet({ kind: 'item', item: null, file })
  }

  // Voci raggruppate per giorno
  const days: { day: string; items: ExpenseItem[] }[] = []
  for (const it of items) {
    const last = days[days.length - 1]
    if (last && last.day === it.spent_on) last.items.push(it)
    else days.push({ day: it.spent_on, items: [it] })
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={closeReport} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)] hover:text-[var(--gold)]">
        <ArrowLeft className="h-4 w-4" /> {t('allReports')}
      </button>

      {/* Intestazione della nota */}
      <section className={card}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-bold text-[var(--ink)] sm:text-2xl">{report.title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{[periodText(report), report.recipient, report.employee_name].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={() => setSheet({ kind: 'report', report })} className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label={t('reportEdit')}>
            <Pencil className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[report.status]}`}>{statusText(report)}</span>
          {report.status === 'open' && (
            <button type="button" onClick={() => setSheet({ kind: 'status', status: 'submitted' })} className={`${secondary} py-1.5`}>
              <Send className="h-4 w-4" /> {t('markSubmitted')}
            </button>
          )}
          {report.status === 'submitted' && (
            <button type="button" onClick={() => setSheet({ kind: 'status', status: 'reimbursed' })} className={`${secondary} py-1.5`}>
              <CircleCheck className="h-4 w-4" /> {t('markReimbursed')}
            </button>
          )}
          {report.status !== 'open' && (
            <button type="button" onClick={() => setSheet({ kind: 'status', status: 'open' })} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
              <RotateCcw className="h-3.5 w-3.5" /> {t('reopen')}
            </button>
          )}
        </div>
      </section>

      {/* Aggiunta veloce: foto dello scontrino o spesa a mano */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => quickPhotoRef.current?.click()} className={`${primary} flex-col gap-1 py-4 text-base`}>
          <Camera className="h-6 w-6" /> {t('quickPhoto')}
        </button>
        <button
          type="button"
          onClick={() => setSheet({ kind: 'item', item: null, file: null })}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-[var(--gold)]/50 bg-white px-4 py-4 text-base font-bold text-[var(--ink)]"
        >
          <Plus className="h-6 w-6 text-[var(--gold)]" /> {t('addExpense')}
        </button>
        <input ref={quickPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onQuickPhoto} />
      </div>

      {/* Totali */}
      <section className="rounded-2xl bg-[var(--ink)] p-4 text-white shadow-[0_10px_30px_rgba(23,23,23,0.2)] sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--gold-bright)]">{totals.dueCents >= 0 ? t('due') : t('dueBack')}</p>
            <p className="mt-1 text-3xl font-bold">{money(Math.abs(totals.dueCents))}</p>
          </div>
          <div className="text-sm text-white/70 sm:text-right">
            <p>
              {t('totalExpenses')}: <span className="font-semibold text-white">{money(totals.totalCents)}</span>
            </p>
            {totals.advanceCents > 0 && (
              <p>
                {t('advance')}: <span className="font-semibold text-white">− {money(totals.advanceCents)}</span>
              </p>
            )}
            {totals.totalKm > 0 && (
              <p>
                {t('totalKm')}: <span className="font-semibold text-white">{formatKm(totals.totalKm, locale)} km</span>
              </p>
            )}
          </div>
        </div>
        {totals.byCategory.length > 0 && (
          <ul className="mt-4 grid grid-cols-1 gap-1.5 border-t border-white/10 pt-3 text-sm sm:grid-cols-2">
            {totals.byCategory.map((c) => (
              <li key={c.category} className="flex items-center gap-2">
                <CategoryIcon category={c.category} className="h-4 w-4 shrink-0 text-[var(--gold-bright)]" />
                <span className="min-w-0 flex-1 truncate text-white/80">
                  {t(`cat_${c.category}`)} <span className="text-white/50">({c.count})</span>
                </span>
                <span className="font-semibold">{money(c.cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {notice && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{notice}</p>}

      {/* Voci */}
      {items.length === 0 ? (
        <p className={`${card} text-center text-sm text-[var(--muted)]`}>{t('noItemsHint')}</p>
      ) : (
        <div className="space-y-3">
          {days.map((group) => (
            <section key={group.day}>
              <h3 className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{formatDay(group.day, locale, 'long')}</h3>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-[var(--gold)]/20 bg-white">
                {group.items.map((it) => (
                  <li key={it.id}>
                    <button type="button" onClick={() => setSheet({ kind: 'item', item: it, file: null })} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-[var(--gold-pale)]/40">
                      {it.receipt_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.receipt_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)] text-[var(--gold)]">
                          <CategoryIcon category={it.category} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[var(--ink)]">
                          {it.category === 'mileage' ? routeText(it) || it.description || t('cat_mileage') : it.description || t(`cat_${it.category}`)}
                        </span>
                        <span className="flex items-center gap-1 truncate text-xs text-[var(--muted)]">
                          {it.receipt_path && <Paperclip className="h-3 w-3 shrink-0" aria-label={t('fieldReceipt')} />}
                          {it.category === 'mileage'
                            ? `${formatKm(itemKm(it), locale)} km${it.round_trip ? ` (${t('roundTripShort')})` : ''} × ${formatRate(it.km_rate ?? 0, locale)} ${t('perKm')}`
                            : t(`cat_${it.category}`)}
                        </span>
                      </span>
                      <span className="shrink-0 font-bold text-[var(--ink)]">{money(it.amount_cents)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Documenti e altre azioni */}
      <section className={`${card} space-y-3`}>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={exportPdf} disabled={exporting} className={secondary}>
            {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} {t('downloadPdf')}
          </button>
          <button type="button" onClick={exportCsv} disabled={!items.length} className={secondary}>
            <FileSpreadsheet className="h-4 w-4" /> {t('downloadCsv')}
          </button>
          <button type="button" onClick={() => setSheet({ kind: 'duplicate' })} className={secondary}>
            <Copy className="h-4 w-4" /> {t('duplicate')}
          </button>
          <button type="button" onClick={removeReport} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> {t('reportDelete')}
          </button>
        </div>
        {totals.receipts > 0 && <p className="text-xs text-[var(--muted)]">{t('pdfHint', { n: totals.receipts })}</p>}
      </section>

      {sheet?.kind === 'item' && (
        <ItemSheet
          key={sheet.item?.id ?? 'new'}
          reportId={report.id}
          item={sheet.item}
          initialFile={sheet.file}
          reportKmRate={report.km_rate}
          defaults={lastUsed ?? { spentOn: defaultDay(report), category: 'meals' }}
          onClose={() => setSheet(null)}
          onSaved={(item, kmRate, isNew) => {
            setDetail((d) => (d ? { report: { ...d.report, km_rate: kmRate }, items: isNew ? [...d.items, item] : d.items.map((x) => (x.id === item.id ? item : x)) } : d))
            if (isNew) setLastUsed({ spentOn: item.spent_on, category: item.category })
            setSheet(null)
          }}
          onDeleted={(id) => {
            setDetail((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== id) } : d))
            setSheet(null)
          }}
        />
      )}
      {sheet?.kind === 'report' && <ReportSheet report={report} suggestion={suggestion} onClose={() => setSheet(null)} onSaved={updateReport} />}
      {sheet?.kind === 'status' && <StatusSheet report={report} status={sheet.status} onClose={() => setSheet(null)} onSaved={updateReport} />}
      {sheet?.kind === 'duplicate' && (
        <DuplicateSheet
          report={report}
          onClose={() => setSheet(null)}
          onSaved={(copy) => {
            setSheet(null)
            void refreshList()
            void openReport(copy.id)
          }}
        />
      )}
    </div>
  )
}
