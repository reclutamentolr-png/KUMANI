// Magazzino PRO: tipi, costanti e utilità condivise (pagina, azioni, export).

export const INVENTORY_UNITS = ['pz', 'kg', 'g', 'l', 'ml', 'm', 'conf', 'box'] as const
export type InventoryUnit = (typeof INVENTORY_UNITS)[number]

export type MovementType = 'load' | 'unload' | 'adjust'
export type MovementReason = 'purchase' | 'sale' | 'return' | 'gift' | 'waste' | 'inventory' | 'other'

// Causali ammesse per tipo di movimento (le stesse della funzione SQL)
export const REASONS_BY_TYPE: Record<MovementType, MovementReason[]> = {
  load: ['purchase', 'return', 'inventory', 'other'],
  unload: ['sale', 'gift', 'waste', 'return', 'other'],
  adjust: ['inventory'],
}

export type InventoryProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  category: string | null
  unit: InventoryUnit
  purchase_price: number
  sale_price: number
  stock: number
  min_stock: number
  supplier: string | null
  notes: string | null
  is_active: boolean
  updated_at: string
}

export type InventoryMovement = {
  id: string
  product_id: string
  product_name: string
  product_unit: InventoryUnit
  type: MovementType
  quantity: number
  stock_after: number
  unit_cost: number | null
  unit_price: number | null
  reason: MovementReason
  notes: string | null
  created_at: string
}

export type InventoryDashboard = {
  products: number
  stock_value: number
  sale_value: number
  below_min: number
  movements_month: number
  avg_margin: number | null
  reorder: { id: string; name: string; stock: number; min_stock: number; unit: InventoryUnit; supplier: string | null }[]
  top: { id: string; name: string; unit: InventoryUnit; moves: number; out: number }[]
  daily: { day: string; loads: number; unloads: number }[]
}

// Tetto dell'export movimenti (oltre si chiede di restringere il periodo)
export const MOVEMENTS_EXPORT_MAX = 50000

export const isBelowMin = (p: Pick<InventoryProduct, 'stock' | 'min_stock'>) => Number(p.min_stock) > 0 && Number(p.stock) <= Number(p.min_stock)

export function formatQty(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(Number(value))
}

export function formatMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(value))
}

// CSV per il commercialista: separatore ";" e decimali con la virgola
// (si apre direttamente in Excel italiano), BOM UTF-8 per gli accenti.
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return ''
    // Testo che inizia con = + - @ (o tab/a capo) diventerebbe una formula in Excel
    const text = typeof value === 'number' ? String(value).replace('.', ',') : /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return '﻿' + rows.map((row) => row.map(cell).join(';')).join('\r\n')
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
