'use client'

import { useCallback, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ClipboardCheck,
  Download,
  LoaderCircle,
  Minus,
  Pencil,
  Plus,
  ScanBarcode,
  Search,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import BarcodeScanner from './BarcodeScanner'
import {
  createCategory,
  deleteProductForever,
  getDashboard,
  listCategories,
  listMovements,
  listProducts,
  moveStock,
  removeProduct,
  restoreProduct,
  saveProduct,
  type ProductInput,
} from '@/app/actions/magazzino'
import {
  INVENTORY_UNITS,
  MOVEMENTS_EXPORT_MAX,
  REASONS_BY_TYPE,
  downloadCsv,
  formatMoney,
  formatQty,
  isBelowMin,
  toCsv,
  type InventoryDashboard,
  type InventoryMovement,
  type InventoryProduct,
  type MovementType,
} from '@/lib/magazzino'

const input =
  'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'
const primary =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-60'

type SheetState =
  | { kind: 'product'; product: InventoryProduct | null; barcode?: string }
  | { kind: 'move'; product: InventoryProduct; type: MovementType }
  | { kind: 'scan' }
  | { kind: 'found'; product: InventoryProduct }
  | null

type Tab = 'products' | 'movements' | 'dashboard'

export default function MagazzinoApp({
  initialProducts,
  initialDashboard,
  initialCategories,
}: {
  initialProducts: InventoryProduct[]
  initialDashboard: InventoryDashboard | null
  initialCategories: string[]
}) {
  const t = useTranslations('magazzino')
  const locale = useLocale()
  const [tab, setTab] = useState<Tab>('products')
  const [products, setProducts] = useState(initialProducts)
  const [dashboard, setDashboard] = useState(initialDashboard)
  const [savedCategories, setSavedCategories] = useState(initialCategories)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[] | null>(null)
  const [moveFilters, setMoveFilters] = useState({ from: '', to: '', productId: '', type: '' })
  const [loadingMoves, setLoadingMoves] = useState(false)
  const [exporting, setExporting] = useState(false)

  const money = (v: number) => formatMoney(v, locale)
  const qty = (v: number) => formatQty(v, locale)
  const errorText = (code?: string) => (code && t.has(`error_${code}`) ? t(`error_${code}`) : t('error_saveError'))

  const refresh = useCallback(async () => {
    const [list, dash, cats] = await Promise.all([listProducts(true), getDashboard(), listCategories()])
    setProducts(list)
    setDashboard(dash)
    setSavedCategories(cats)
  }, [])

  const loadMovements = useCallback(async (filters = moveFilters) => {
    setLoadingMoves(true)
    setMovements(await listMovements(filters))
    setLoadingMoves(false)
  }, [moveFilters])

  // Categorie create + quelle scritte nei prodotti
  const categories = useMemo(
    () =>
      [...new Set([...savedCategories, ...products.map((p) => p.category).filter((c): c is string => !!c)])].sort((a, b) => a.localeCompare(b)),
    [products, savedCategories],
  )
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter(
      (p) =>
        (showArchived || p.is_active) &&
        (!category || p.category === category) &&
        (!onlyLow || isBelowMin(p)) &&
        (!q || [p.name, p.sku, p.barcode, p.supplier].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [products, query, category, onlyLow, showArchived])
  const lowCount = products.filter((p) => p.is_active && isBelowMin(p)).length

  const onScan = useCallback(
    (code: string) => {
      const found = products.find((p) => p.barcode === code || p.sku?.toLowerCase() === code.toLowerCase())
      setSheet(found ? { kind: 'found', product: found } : { kind: 'product', product: null, barcode: code })
    },
    [products],
  )

  const exportProducts = () => {
    const rows: (string | number | null)[][] = [
      [t('colName'), t('colSku'), t('colBarcode'), t('colCategory'), t('colUnit'), t('colStock'), t('colMinStock'), t('colCost'), t('colSale'), t('colValue'), t('colSupplier'), t('colStatus')],
      ...products.map((p) => [
        p.name, p.sku, p.barcode, p.category, t(`unit_${p.unit}`), p.stock, p.min_stock, p.purchase_price, p.sale_price,
        Math.round(p.stock * p.purchase_price * 100) / 100, p.supplier, p.is_active ? t('statusActive') : t('statusArchived'),
      ]),
    ]
    downloadCsv(`magazzino-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
  }

  // Il CSV contiene tutti i movimenti del periodo, non solo quelli a schermo
  const exportMovements = async () => {
    setExporting(true)
    const all = await listMovements(moveFilters, true)
    setExporting(false)
    if (all.length >= MOVEMENTS_EXPORT_MAX) {
      setNotice(t('exportTooMany', { max: qty(MOVEMENTS_EXPORT_MAX) }))
      return
    }
    const rows: (string | number | null)[][] = [
      [t('colDate'), t('colName'), t('colType'), t('colReason'), t('colQuantity'), t('colUnit'), t('colStockAfter'), t('colUnitCost'), t('colUnitPrice'), t('colNotes')],
      ...all.map((m) => [
        new Date(m.created_at).toLocaleString('it-IT'), m.product_name, t(`type_${m.type}`), t(`reason_${m.reason}`), m.quantity,
        t(`unit_${m.product_unit}`), m.stock_after, m.unit_cost, m.unit_price, m.notes,
      ]),
    ]
    downloadCsv(`movimenti-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
  }

  return (
    <div className="space-y-6">
      {/* Numeri chiave */}
      {dashboard && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [t('kpiValue'), money(dashboard.stock_value), 'text-[var(--ink)]'],
            [t('kpiLow'), String(dashboard.below_min), dashboard.below_min > 0 ? 'text-red-600' : 'text-emerald-700'],
            [t('kpiMonth'), String(dashboard.movements_month), 'text-[var(--ink)]'],
            [t('kpiMargin'), dashboard.avg_margin === null ? '—' : `${formatQty(dashboard.avg_margin, locale)}%`, 'text-[var(--ink)]'],
          ].map(([title, value, color]) => (
            <div key={title} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</p>
              <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {notice && (
        <p className="rounded-xl bg-[var(--gold-pale)]/60 px-4 py-3 text-sm font-semibold text-[var(--ink)]" role="status">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {([
          ['products', t('tabProducts')],
          ['movements', t('tabMovements')],
          ['dashboard', t('tabDashboard')],
        ] as [Tab, string][]).map(([key, text]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key)
              if (key === 'movements' && movements === null) loadMovements()
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-[var(--ink)] text-white' : 'border border-gray-200 bg-white text-gray-700'}`}
          >
            {text}
            {key === 'products' && lowCount > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">{lowCount}</span>}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSheet({ kind: 'product', product: null })} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)]">
              <Plus className="h-4 w-4" /> {t('newProduct')}
            </button>
            <button type="button" onClick={() => setSheet({ kind: 'scan' })} className="inline-flex items-center gap-2 rounded-xl border border-[var(--ink)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)]">
              <ScanBarcode className="h-4 w-4" /> {t('scan')}
            </button>
            <button type="button" data-guest-hide onClick={exportProducts} disabled={products.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">
              <Download className="h-4 w-4" /> {t('exportProducts')}
            </button>
          </div>

          <div className="grid gap-2 rounded-2xl border border-gray-200 bg-white p-3 sm:grid-cols-[1fr_200px_auto_auto] sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input className={`${input} pl-9`} value={query} placeholder={t('searchPlaceholder')} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t('allCategories')}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 accent-red-600" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> {t('onlyLow')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> {t('showArchived')}
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-8 text-center text-sm text-[var(--muted)]">
              {products.length === 0 ? t('emptyProducts') : t('noResults')}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((p) => {
                const low = isBelowMin(p)
                return (
                  <div
                    key={p.id}
                    className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4 ${low ? 'border-red-300 bg-red-50/40' : 'border-gray-200'} ${p.is_active ? '' : 'opacity-60'}`}
                  >
                    <div className="min-w-[180px] flex-1">
                      <p className="font-bold text-[var(--ink)]">
                        {p.name} {!p.is_active && <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{t('statusArchived')}</span>}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{[p.sku, p.barcode, p.category, p.supplier].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${low ? 'text-red-600' : 'text-[var(--ink)]'}`}>
                        {qty(p.stock)} <span className="text-sm font-semibold">{t(`unit_${p.unit}`)}</span>
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {low && <AlertTriangle className="mr-0.5 inline h-3 w-3 text-red-500" />}
                        {t('minLabel', { min: qty(p.min_stock) })}
                      </p>
                    </div>
                    <div className="w-32 text-right text-xs text-gray-600">
                      <p>{t('costShort', { value: money(p.purchase_price) })}</p>
                      <p>{t('saleShort', { value: money(p.sale_price) })}</p>
                      <p className="font-semibold text-[var(--ink)]">{t('valueShort', { value: money(p.stock * p.purchase_price) })}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.is_active ? (
                        <>
                          <IconButton title={t('load')} onClick={() => setSheet({ kind: 'move', product: p, type: 'load' })} className="bg-emerald-600 text-white">
                            <Plus className="h-4 w-4" />
                          </IconButton>
                          <IconButton title={t('unload')} onClick={() => setSheet({ kind: 'move', product: p, type: 'unload' })} className="bg-[var(--ink)] text-white">
                            <Minus className="h-4 w-4" />
                          </IconButton>
                          <IconButton title={t('adjust')} onClick={() => setSheet({ kind: 'move', product: p, type: 'adjust' })} className="border border-gray-300 text-gray-700">
                            <ClipboardCheck className="h-4 w-4" />
                          </IconButton>
                          <IconButton title={t('edit')} onClick={() => setSheet({ kind: 'product', product: p })} className="border border-gray-300 text-gray-700">
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            title={t('remove')}
                            onClick={async () => {
                              if (!confirm(t('removeConfirm', { name: p.name }))) return
                              const result = await removeProduct(p.id)
                              setNotice(result === 'archived' ? t('archived') : result === 'deleted' ? t('deleted') : errorText(result))
                              await refresh()
                            }}
                            className="border border-gray-300 text-gray-500"
                          >
                            <Archive className="h-4 w-4" />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <IconButton
                            title={t('restore')}
                            onClick={async () => {
                              const result = await restoreProduct(p.id)
                              setNotice(result === 'ok' ? t('restored') : errorText(result))
                              await refresh()
                            }}
                            className="border border-gray-300 text-gray-700"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            title={t('deleteForever')}
                            onClick={async () => {
                              if (!confirm(t('deleteForeverConfirm', { name: p.name }))) return
                              const result = await deleteProductForever(p.id)
                              setNotice(result === 'deleted' ? t('deleted') : errorText(result))
                              await refresh()
                              if (movements !== null) loadMovements()
                            }}
                            className="border border-red-200 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'movements' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              loadMovements()
            }}
            className="grid gap-2 rounded-2xl border border-gray-200 bg-white p-3 sm:grid-cols-5"
          >
            <input type="date" className={input} value={moveFilters.from} onChange={(e) => setMoveFilters({ ...moveFilters, from: e.target.value })} aria-label={t('filterFrom')} />
            <input type="date" className={input} value={moveFilters.to} onChange={(e) => setMoveFilters({ ...moveFilters, to: e.target.value })} aria-label={t('filterTo')} />
            <select className={input} value={moveFilters.productId} onChange={(e) => setMoveFilters({ ...moveFilters, productId: e.target.value })}>
              <option value="">{t('allProducts')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select className={input} value={moveFilters.type} onChange={(e) => setMoveFilters({ ...moveFilters, type: e.target.value })}>
              <option value="">{t('allTypes')}</option>
              {(['load', 'unload', 'adjust'] as const).map((type) => (
                <option key={type} value={type}>
                  {t(`type_${type}`)}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[var(--ink)] px-3 text-sm font-semibold text-white">
                {loadingMoves ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} {t('filter')}
              </button>
              <button type="button" data-guest-hide onClick={exportMovements} disabled={!movements?.length || exporting} className="rounded-xl border border-gray-200 px-3 text-gray-700 disabled:opacity-50" aria-label={t('exportMovements')}>
                <Download className="h-4 w-4" />
              </button>
            </div>
          </form>
          <p className="text-xs text-[var(--muted)]">{t('exportHint')}</p>

          {movements === null ? (
            <div className="flex justify-center py-8">
              <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" />
            </div>
          ) : movements.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-[var(--muted)]">{t('emptyMovements')}</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">{t('colDate')}</th>
                    <th className="px-3 py-2">{t('colName')}</th>
                    <th className="px-3 py-2">{t('colReason')}</th>
                    <th className="px-3 py-2 text-right">{t('colQuantity')}</th>
                    <th className="px-3 py-2 text-right">{t('colStockAfter')}</th>
                    <th className="px-3 py-2">{t('colNotes')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m) => {
                    const sign = m.type === 'unload' ? -1 : m.type === 'adjust' ? Math.sign(m.quantity) : 1
                    return (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{new Date(m.created_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-3 py-2 font-medium text-[var(--ink)]">{m.product_name}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {t(`type_${m.type}`)} · {t(`reason_${m.reason}`)}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right font-bold ${sign < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {sign < 0 ? '−' : '+'}
                          {qty(Math.abs(m.quantity))} {t(`unit_${m.product_unit}`)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-gray-700">{qty(m.stock_after)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {[m.unit_cost !== null ? t('costShort', { value: money(m.unit_cost) }) : null, m.unit_price !== null ? t('saleShort', { value: money(m.unit_price) }) : null, m.notes]
                            .filter(Boolean)
                            .join(' · ')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {movements.length >= 500 && <p className="border-t border-gray-100 px-3 py-2 text-xs text-[var(--muted)]">{t('movementsScreenLimit')}</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'dashboard' && dashboard && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="font-bold text-[var(--ink)]">{t('valuesTitle')}</p>
            <p className="mt-2 text-sm text-gray-700">{t('valueAtCost', { value: money(dashboard.stock_value) })}</p>
            <p className="text-sm text-gray-700">{t('valueAtSale', { value: money(dashboard.sale_value) })}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">{t('valuesHint')}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-white p-5">
            <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
              <AlertTriangle className="h-5 w-5 text-red-500" /> {t('reorderTitle')}
            </p>
            {dashboard.reorder.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-700">{t('reorderNone')}</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 text-sm">
                {dashboard.reorder.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3 py-2">
                    <span>
                      <span className="font-semibold text-[var(--ink)]">{r.name}</span>
                      {r.supplier && <span className="block text-xs text-[var(--muted)]">{r.supplier}</span>}
                    </span>
                    <span className="whitespace-nowrap font-bold text-red-600">
                      {qty(r.stock)} / {qty(r.min_stock)} {t(`unit_${r.unit}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
              <TrendingUp className="h-5 w-5 text-[var(--gold)]" /> {t('topTitle')}
            </p>
            {dashboard.top.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">{t('noData')}</p>
            ) : (
              <ol className="mt-2 space-y-1.5 text-sm">
                {dashboard.top.map((item, i) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span>
                      {i + 1}. {item.name}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {t('topMoves', { count: item.moves })} · {t('topOut', { qty: qty(item.out), unit: t(`unit_${item.unit}`) })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="font-bold text-[var(--ink)]">{t('dailyTitle')}</p>
            <DailyChart daily={dashboard.daily} />
            <p className="mt-2 flex gap-4 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('type_load')}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[var(--ink)]" /> {t('type_unload')}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Finestre */}
      {sheet?.kind === 'product' && (
        <Sheet title={sheet.product ? t('editProduct') : t('newProduct')} onClose={() => setSheet(null)}>
          <ProductForm
            product={sheet.product}
            barcode={sheet.barcode}
            categories={categories}
            onCategoryCreated={(name) => setSavedCategories((list) => (list.includes(name) ? list : [...list, name]))}
            onSaved={async (created) => {
              setSheet(null)
              setNotice(created ? t('productCreated') : t('productSaved'))
              await refresh()
            }}
            onRestored={async () => {
              setSheet(null)
              setNotice(t('restored'))
              await refresh()
            }}
            errorText={errorText}
          />
        </Sheet>
      )}
      {sheet?.kind === 'move' && (
        <Sheet title={`${t(`type_${sheet.type}`)} · ${sheet.product.name}`} onClose={() => setSheet(null)}>
          <MoveForm
            product={sheet.product}
            type={sheet.type}
            errorText={errorText}
            onSaved={async (stock) => {
              setSheet(null)
              setNotice(t('moveSaved', { stock: qty(stock), unit: t(`unit_${sheet.product.unit}`) }))
              await refresh()
              if (movements !== null) loadMovements()
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === 'scan' && (
        <Sheet title={t('scan')} onClose={() => setSheet(null)}>
          <BarcodeScanner onResult={onScan} />
        </Sheet>
      )}
      {sheet?.kind === 'found' && (
        <Sheet title={sheet.product.name} onClose={() => setSheet(null)}>
          <p className="mb-4 text-sm text-gray-700">
            {t('foundStock', { stock: qty(sheet.product.stock), unit: t(`unit_${sheet.product.unit}`) })}
          </p>
          {!sheet.product.is_active ? (
            <div className="space-y-3">
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t('error_archived')}</p>
              <button
                type="button"
                onClick={async () => {
                  const result = await restoreProduct(sheet.product.id)
                  setNotice(result === 'ok' ? t('restored') : errorText(result))
                  setSheet(null)
                  await refresh()
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-3 py-3 text-sm font-bold text-white"
              >
                <ArchiveRestore className="h-4 w-4" /> {t('restore')}
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-2">
            {(['load', 'unload', 'adjust'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSheet({ kind: 'move', product: sheet.product, type })}
                className="rounded-xl border border-gray-200 px-3 py-3 text-sm font-bold text-[var(--ink)] hover:border-[var(--gold)]"
              >
                {t(`type_${type}`)}
              </button>
            ))}
          </div>
          )}
        </Sheet>
      )}
    </div>
  )
}

function IconButton({ title, onClick, className, children }: { title: string; onClick: () => void; className: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={`flex h-9 w-9 items-center justify-center rounded-lg ${className}`}>
      {children}
    </button>
  )
}

function DailyChart({ daily }: { daily: InventoryDashboard['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => Math.max(d.loads, d.unloads)))
  return (
    <div className="mt-3 flex h-32 items-end gap-[3px]" aria-hidden="true">
      {daily.map((d) => (
        <div key={d.day} className="flex h-full flex-1 items-end gap-px" title={`${d.day}: +${d.loads} / −${d.unloads}`}>
          <div className="w-1/2 rounded-t bg-emerald-500" style={{ height: `${(d.loads / max) * 100}%` }} />
          <div className="w-1/2 rounded-t bg-[var(--ink)]" style={{ height: `${(d.unloads / max) * 100}%` }} />
        </div>
      ))}
    </div>
  )
}

function ProductForm({
  product,
  barcode,
  categories,
  onCategoryCreated,
  onSaved,
  onRestored,
  errorText,
}: {
  product: InventoryProduct | null
  barcode?: string
  categories: string[]
  onCategoryCreated: (name: string) => void
  onSaved: (created: boolean) => void
  onRestored: () => void
  errorText: (code?: string) => string
}) {
  const t = useTranslations('magazzino')
  const [form, setForm] = useState<ProductInput>({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? barcode ?? '',
    category: product?.category ?? '',
    unit: product?.unit ?? 'pz',
    purchasePrice: product ? String(product.purchase_price) : '',
    salePrice: product ? String(product.sale_price) : '',
    minStock: product ? String(product.min_stock) : '',
    initialStock: '',
    supplier: product?.supplier ?? '',
    notes: product?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{ id: string; name: string; field: 'sku' | 'barcode' } | null>(null)
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const set = (key: keyof ProductInput, value: string) => setForm((f) => ({ ...f, [key]: value }))
  // Elenco con l'eventuale categoria del prodotto non ancora in lista
  const options = form.category && !categories.includes(form.category) ? [...categories, form.category] : categories

  const addCategory = async () => {
    if (!newCategory?.trim()) return
    setCategoryBusy(true)
    setCategoryError(null)
    const result = await createCategory(newCategory)
    setCategoryBusy(false)
    if (!result.name) return setCategoryError(errorText(result.error))
    onCategoryCreated(result.name)
    set('category', result.name)
    setNewCategory(null)
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    setConflict(null)
    const result = await saveProduct(product?.id ?? null, form)
    setBusy(false)
    if (result.id) return onSaved(!product)
    // Codice già usato da un prodotto archiviato: si ripristina o si elimina
    if ((result.error === 'sku_archived' || result.error === 'barcode_archived') && result.product_id) {
      return setConflict({ id: result.product_id, name: result.product_name ?? '', field: result.error === 'sku_archived' ? 'sku' : 'barcode' })
    }
    setError(errorText(result.error))
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={label}>{t('fieldName')}</label>
        <input className={input} required maxLength={120} value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t('fieldSku')}</label>
          <input className={input} maxLength={60} value={form.sku} onChange={(e) => set('sku', e.target.value)} />
        </div>
        <div>
          <label className={label}>{t('fieldBarcode')}</label>
          <input className={`${input} font-mono`} maxLength={64} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
        </div>
        <div>
          <label className={label}>{t('fieldCategory')}</label>
          <div className="flex gap-2">
            <select className={input} value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">{t('noCategory')}</option>
              {options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setCategoryError(null)
                setNewCategory('')
              }}
              title={t('addCategory')}
              aria-label={t('addCategory')}
              className="flex h-[46px] w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div>
          <label className={label}>{t('fieldUnit')}</label>
          <select className={input} value={form.unit} onChange={(e) => set('unit', e.target.value)}>
            {INVENTORY_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`unit_${u}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{t('fieldCost')}</label>
          <input className={input} inputMode="decimal" value={form.purchasePrice} placeholder="0,00" onChange={(e) => set('purchasePrice', e.target.value)} />
        </div>
        <div>
          <label className={label}>{t('fieldSale')}</label>
          <input className={input} inputMode="decimal" value={form.salePrice} placeholder="0,00" onChange={(e) => set('salePrice', e.target.value)} />
        </div>
        <div>
          <label className={label}>{t('fieldMinStock')}</label>
          <input className={input} inputMode="decimal" value={form.minStock} placeholder="0" onChange={(e) => set('minStock', e.target.value)} />
        </div>
        {!product && (
          <div>
            <label className={label}>{t('fieldInitialStock')}</label>
            <input className={input} inputMode="decimal" value={form.initialStock} placeholder="0" onChange={(e) => set('initialStock', e.target.value)} />
          </div>
        )}
      </div>
      <p className="text-xs text-[var(--muted)]">{product ? t('editStockHint') : t('pricesHint')}</p>
      <div>
        <label className={label}>{t('fieldSupplier')}</label>
        <input className={input} maxLength={120} value={form.supplier} onChange={(e) => set('supplier', e.target.value)} />
      </div>
      <div>
        <label className={label}>{t('fieldNotes')}</label>
        <textarea className={input} rows={2} maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      {conflict && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">
            {t(conflict.field === 'sku' ? 'skuArchivedConflict' : 'barcodeArchivedConflict', { name: conflict.name })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const result = await restoreProduct(conflict.id)
                setBusy(false)
                if (result === 'ok') return onRestored()
                setError(errorText(result))
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              <ArchiveRestore className="h-4 w-4" /> {t('restore')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!confirm(t('deleteForeverConfirm', { name: conflict.name }))) return
                setBusy(true)
                const result = await deleteProductForever(conflict.id)
                setBusy(false)
                if (result !== 'deleted') return setError(errorText(result))
                await save()
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> {t('deleteForever')}
            </button>
          </div>
        </div>
      )}
      <button type="submit" disabled={busy} className={primary}>
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {product ? t('saveProduct') : t('createProduct')}
      </button>

      {newCategory !== null && (
        <Sheet title={t('newCategoryTitle')} onClose={() => setNewCategory(null)}>
          <div className="space-y-3">
            <label className={label}>{t('fieldCategoryName')}</label>
            <input
              className={input}
              autoFocus
              maxLength={60}
              value={newCategory}
              placeholder={t('categoryPlaceholder')}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                // Invio crea la categoria senza inviare il modulo del prodotto
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCategory()
                }
              }}
            />
            {categoryError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{categoryError}</p>}
            <button type="button" disabled={categoryBusy || !newCategory.trim()} onClick={addCategory} className={primary}>
              {categoryBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t('createCategory')}
            </button>
          </div>
        </Sheet>
      )}
    </form>
  )
}

function MoveForm({
  product,
  type,
  onSaved,
  errorText,
}: {
  product: InventoryProduct
  type: MovementType
  onSaved: (stock: number) => void
  errorText: (code?: string) => string
}) {
  const t = useTranslations('magazzino')
  const locale = useLocale()
  const reasons = REASONS_BY_TYPE[type]
  const [reason, setReason] = useState<string>(reasons[0])
  const [quantity, setQuantity] = useState(type === 'adjust' ? String(product.stock) : '')
  const [unitCost, setUnitCost] = useState(product.purchase_price ? String(product.purchase_price) : '')
  const [unitPrice, setUnitPrice] = useState(product.sale_price ? String(product.sale_price) : '')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unit = t(`unit_${product.unit}`)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await moveStock({
      productId: product.id,
      type,
      quantity,
      reason,
      unitCost: type === 'load' && (reason === 'purchase' || reason === 'inventory') ? unitCost : '',
      unitPrice: type === 'unload' && reason === 'sale' ? unitPrice : '',
      notes,
    })
    setBusy(false)
    if (result.error || result.stock === undefined) {
      return setError(
        result.error === 'insufficient' ? t('error_insufficient', { stock: formatQty(product.stock, locale), unit }) : errorText(result.error),
      )
    }
    onSaved(Number(result.stock))
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">{t('currentStock', { stock: formatQty(product.stock, locale), unit })}</p>
      {type !== 'adjust' && (
        <div>
          <label className={label}>{t('fieldReason')}</label>
          <select className={input} value={reason} onChange={(e) => setReason(e.target.value)}>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {t(`reason_${r}`)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={label}>{type === 'adjust' ? t('fieldCounted', { unit }) : t('fieldQuantity', { unit })}</label>
        <input className={input} inputMode="decimal" required value={quantity} autoFocus onChange={(e) => setQuantity(e.target.value)} />
        {type === 'adjust' && <p className="mt-1 text-xs text-[var(--muted)]">{t('adjustHint')}</p>}
      </div>
      {type === 'load' && (reason === 'purchase' || reason === 'inventory') && (
        <div>
          <label className={label}>{t('fieldUnitCost')}</label>
          <input className={input} inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          <p className="mt-1 text-xs text-[var(--muted)]">{t('avgCostHint')}</p>
        </div>
      )}
      {type === 'unload' && reason === 'sale' && (
        <div>
          <label className={label}>{t('fieldUnitPrice')}</label>
          <input className={input} inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </div>
      )}
      <div>
        <label className={label}>{t('fieldMoveNotes')}</label>
        <input className={input} maxLength={300} value={notes} placeholder={t('fieldMoveNotesPlaceholder')} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className={primary}>
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t(`confirm_${type}`)}
      </button>
    </form>
  )
}
