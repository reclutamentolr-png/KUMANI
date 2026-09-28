'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import {
  INVENTORY_UNITS,
  MOVEMENTS_EXPORT_MAX,
  REASONS_BY_TYPE,
  type InventoryDashboard,
  type InventoryMovement,
  type InventoryProduct,
  type MovementType,
} from '@/lib/magazzino'

// Magazzino PRO: le regole (piano, proprietario, giacenza, costo medio) sono
// nelle funzioni SQL inventory_*; qui validazione e passaggio dei dati.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const num = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
// Mezzanotte italiana (con ora legale) del giorno indicato, più eventuali giorni:
// i filtri per data seguono il calendario dell'utente, non quello UTC del server
function romeMidnight(date: string, addDays = 0): string {
  const day = new Date(`${date}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() + addDays)
  const offset =
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
      .formatToParts(day)
      .find((part) => part.type === 'timeZoneName')
      ?.value.replace('GMT', '') || '+00:00'
  return `${day.toISOString().slice(0, 10)}T00:00:00${offset}`
}

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'magazzino'))) return null
  return { supabase, user }
}

// Supabase restituisce al massimo 1000 righe per richiesta: gli elenchi
// lunghi si leggono a blocchi fino al tetto indicato
const PAGE = 1000
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>, max: number): Promise<T[]> {
  const rows: T[] = []
  while (rows.length < max) {
    const { data } = await page(rows.length, Math.min(rows.length + PAGE, max) - 1)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

export async function listProducts(includeArchived = false): Promise<InventoryProduct[]> {
  const g = await gate()
  if (!g) return []
  const data = await readAll<InventoryProduct>((from, to) => {
    let query = g.supabase
      .from('inventory_products')
      .select('id, name, sku, barcode, category, unit, purchase_price, sale_price, stock, min_stock, supplier, notes, is_active, updated_at')
      .eq('owner_id', g.user.id)
      .order('name')
      .order('id')
      .range(from, to)
    if (!includeArchived) query = query.eq('is_active', true)
    return query.returns<InventoryProduct[]>()
  }, 3000)
  return data.map((p) => ({
    ...p,
    purchase_price: Number(p.purchase_price),
    sale_price: Number(p.sale_price),
    stock: Number(p.stock),
    min_stock: Number(p.min_stock),
  }))
}

export type ProductInput = {
  name: string
  sku: string
  barcode: string
  category: string
  unit: string
  purchasePrice: string
  salePrice: string
  minStock: string
  initialStock: string
  supplier: string
  notes: string
}

// Con sku_archived / barcode_archived arriva anche il prodotto archiviato che
// usa già quel codice, così si può ripristinare o eliminare
export type SaveProductResult = { id?: string; error?: string; product_id?: string; product_name?: string }

export async function saveProduct(productId: string | null, input: ProductInput): Promise<SaveProductResult> {
  if (productId && !UUID_RE.test(productId)) return { error: 'invalid' }
  if (!(INVENTORY_UNITS as readonly string[]).includes(input.unit) || !clean(input.name, 120)) return { error: 'invalid' }
  const prices = [num(input.purchasePrice), num(input.salePrice), num(input.minStock), num(input.initialStock)]
  if (prices.some((v) => v !== null && (Number.isNaN(v) || v < 0 || v > 1_000_000))) return { error: 'number' }
  const g = await gate()
  if (!g) return { error: 'not_allowed' }
  const { data, error } = await g.supabase.rpc('inventory_product_save', {
    p_id: productId,
    p: {
      name: clean(input.name, 120),
      sku: clean(input.sku, 60),
      barcode: clean(input.barcode, 64),
      category: clean(input.category, 60),
      unit: input.unit,
      purchase_price: prices[0] ?? 0,
      sale_price: prices[1] ?? 0,
      min_stock: prices[2] ?? 0,
      initial_stock: productId ? 0 : (prices[3] ?? 0),
      supplier: clean(input.supplier, 120),
      notes: clean(input.notes, 500),
    },
  })
  if (error) return { error: 'saveError' }
  const result = data as SaveProductResult
  if (result.id && !productId) await awardToolPoint('magazzino')
  return result
}

// Eliminazione definitiva di un prodotto archiviato, con tutti i suoi movimenti
export async function deleteProductForever(productId: string): Promise<string> {
  if (!UUID_RE.test(productId)) return 'invalid'
  const g = await gate()
  if (!g) return 'not_allowed'
  const { data, error } = await g.supabase.rpc('inventory_product_purge', { p_id: productId })
  return error ? 'saveError' : (data as string)
}

export async function removeProduct(productId: string): Promise<string> {
  if (!UUID_RE.test(productId)) return 'invalid'
  const g = await gate()
  if (!g) return 'not_allowed'
  const { data, error } = await g.supabase.rpc('inventory_product_remove', { p_id: productId })
  return error ? 'saveError' : (data as string)
}

export async function restoreProduct(productId: string): Promise<string> {
  if (!UUID_RE.test(productId)) return 'invalid'
  const g = await gate()
  if (!g) return 'not_allowed'
  const { data, error } = await g.supabase.rpc('inventory_product_restore', { p_id: productId })
  return error ? 'saveError' : (data as string)
}

export async function moveStock(input: {
  productId: string
  type: MovementType
  quantity: string
  reason: string
  unitCost: string
  unitPrice: string
  notes: string
}): Promise<{ stock?: number; error?: string }> {
  if (!UUID_RE.test(input.productId) || !['load', 'unload', 'adjust'].includes(input.type)) return { error: 'invalid' }
  if (!(REASONS_BY_TYPE[input.type] as string[]).includes(input.reason)) return { error: 'invalid' }
  const quantity = num(input.quantity)
  const unitCost = num(input.unitCost)
  const unitPrice = num(input.unitPrice)
  if (quantity === null || Number.isNaN(quantity)) return { error: 'quantity' }
  if ([unitCost, unitPrice].some((v) => v !== null && (Number.isNaN(v) || v < 0 || v > 1_000_000))) return { error: 'number' }
  const g = await gate()
  if (!g) return { error: 'not_allowed' }
  const { data, error } = await g.supabase.rpc('inventory_move', {
    p_product: input.productId,
    p_type: input.type,
    p_quantity: quantity,
    p_reason: input.reason,
    p_unit_cost: unitCost,
    p_unit_price: unitPrice,
    p_notes: clean(input.notes, 300),
  })
  if (error) return { error: 'saveError' }
  return data as { stock?: number; error?: string }
}

// A schermo gli ultimi 500 movimenti; per l'export CSV tutto il periodo
// (fino a MOVEMENTS_EXPORT_MAX: oltre si chiede di restringere le date)
const MOVEMENTS_SCREEN = 500
export async function listMovements(
  filters: { from?: string; to?: string; productId?: string; type?: string },
  forExport = false,
): Promise<InventoryMovement[]> {
  const g = await gate()
  if (!g) return []
  const data = await readAll<unknown>((from, to) => {
    let query = g.supabase
      .from('inventory_movements')
      .select('id, product_id, type, quantity, stock_after, unit_cost, unit_price, reason, notes, created_at, product:inventory_products(name, unit)')
      .eq('owner_id', g.user.id)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
    if (filters.from && DATE_RE.test(filters.from)) query = query.gte('created_at', romeMidnight(filters.from))
    if (filters.to && DATE_RE.test(filters.to)) query = query.lt('created_at', romeMidnight(filters.to, 1))
    if (filters.productId && UUID_RE.test(filters.productId)) query = query.eq('product_id', filters.productId)
    if (filters.type && ['load', 'unload', 'adjust'].includes(filters.type)) query = query.eq('type', filters.type)
    return query
  }, forExport ? MOVEMENTS_EXPORT_MAX : MOVEMENTS_SCREEN)
  return (data as (Omit<InventoryMovement, 'product_name' | 'product_unit'> & { product: { name: string; unit: InventoryMovement['product_unit'] } | null })[]).map(
    ({ product, ...m }) => ({
      ...m,
      quantity: Number(m.quantity),
      stock_after: Number(m.stock_after),
      unit_cost: m.unit_cost === null ? null : Number(m.unit_cost),
      unit_price: m.unit_price === null ? null : Number(m.unit_price),
      product_name: product?.name ?? '—',
      product_unit: product?.unit ?? 'pz',
    }),
  )
}

export async function getDashboard(): Promise<InventoryDashboard | null> {
  const g = await gate()
  if (!g) return null
  const { data } = await g.supabase.rpc('inventory_dashboard')
  return (data as InventoryDashboard) ?? null
}

export async function listCategories(): Promise<string[]> {
  const g = await gate()
  if (!g) return []
  const { data } = await g.supabase.from('inventory_categories').select('name').eq('owner_id', g.user.id).order('name').limit(200)
  return (data ?? []).map((row) => row.name as string)
}

// Nuova categoria (dal "+" nel prodotto). Se esiste già, restituisce quella.
export async function createCategory(name: string): Promise<{ name?: string; error?: string }> {
  const text = clean(name, 60)
  if (!text) return { error: 'invalid' }
  const g = await gate()
  if (!g) return { error: 'not_allowed' }
  const { data, error } = await g.supabase.rpc('inventory_category_create', { p_name: text })
  if (error) return { error: 'saveError' }
  return data as { name?: string; error?: string }
}
