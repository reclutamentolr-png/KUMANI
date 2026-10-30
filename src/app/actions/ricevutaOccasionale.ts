'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { validateIban } from '@/lib/iban'
import {
  RECEIPT_COLUMNS,
  RO_LIMITS,
  RO_MAX_AMOUNT_CENTS,
  calcReceipt,
  checkClientTaxId,
  checkCodiceFiscale,
  cleanClientTaxId,
  isIsoDate,
  normalizeTaxId,
  type ClientForm,
  type ClientKind,
  type IssuerProfile,
  type OccasionalReceipt,
  type ProfileForm,
  type ReceiptClient,
  type ReceiptForm,
} from '@/lib/ricevutaOccasionale'

// Ricevuta per prestazione occasionale: proprietario e piano li controlla
// anche il database (RLS), i conti anche i vincoli della tabella. Qui
// validazione dei campi e calcolo degli importi (non si fida del browser).

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }

const TOOL = 'ricevuta-occasionale'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const orNull = (value: string) => value || null

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!(await hasActiveToolAccess(supabase, user.id, TOOL))) return null
  return { supabase, userId: user.id }
}

function dbError(scope: string, error: { message?: string; code?: string }): { success: false; message: string } {
  const msg = error.message ?? ''
  if (msg.includes('ro_limit')) return { success: false, message: 'limit' }
  if (msg.includes('ro_year_change')) return { success: false, message: 'yearChange' }
  console.error(`[RicevutaOccasionale] ${scope} failed:`, error)
  return { success: false, message: 'saveError' }
}

const toReceipt = (row: Record<string, unknown>): OccasionalReceipt => row as unknown as OccasionalReceipt

// ─── Dati di chi rilascia la ricevuta ─────────────────────────────────────

export async function getProfile(): Promise<IssuerProfile | null> {
  const g = await gate()
  if (!g) return null
  const { data } = await g.supabase
    .from('occasional_receipt_profiles')
    .select('full_name, tax_code, address, city, iban, default_place')
    .eq('user_id', g.userId)
    .maybeSingle()
  return (data as IssuerProfile | null) ?? null
}

export async function saveProfile(form: ProfileForm): Promise<ActionResult<IssuerProfile>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const fullName = clip(form.fullName, RO_LIMITS.name)
  const taxCode = normalizeTaxId(clip(form.taxCode, 40))
  if (!fullName) return { success: false, message: 'nameRequired' }
  const cfError = checkCodiceFiscale(taxCode)
  if (cfError) return { success: false, message: cfError === 'format' ? 'taxCodeFormat' : 'taxCodeChecksum' }
  let iban: string | null = null
  if (clip(form.iban, 60)) {
    const result = validateIban(clip(form.iban, 60))
    if (!result.valid) return { success: false, message: 'ibanInvalid' }
    iban = result.normalized
  }
  const row: IssuerProfile = {
    full_name: fullName,
    tax_code: taxCode,
    address: orNull(clip(form.address, RO_LIMITS.address)),
    city: orNull(clip(form.city, RO_LIMITS.city)),
    iban,
    default_place: orNull(clip(form.defaultPlace, RO_LIMITS.place)),
  }
  const { error } = await g.supabase
    .from('occasional_receipt_profiles')
    .upsert({ user_id: g.userId, ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) return dbError('saveProfile', error)
  return { success: true, data: row }
}

// ─── Clienti ──────────────────────────────────────────────────────────────

const CLIENT_COLUMNS = 'id, name, tax_id, address, city, kind'

export async function listClients(): Promise<ReceiptClient[]> {
  const g = await gate()
  if (!g) return []
  const { data, error } = await g.supabase.from('occasional_receipt_clients').select(CLIENT_COLUMNS).eq('user_id', g.userId).order('name').limit(1000)
  if (error) {
    console.error('[RicevutaOccasionale] listClients failed:', error)
    return []
  }
  return (data ?? []) as ReceiptClient[]
}

type CleanClient = { name: string; tax_id: string | null; address: string | null; city: string | null; kind: ClientKind }

function cleanClient(form: ClientForm): { ok: true; row: CleanClient } | { ok: false; message: string } {
  const name = clip(form.name, RO_LIMITS.name)
  if (!name) return { ok: false, message: 'clientNameRequired' }
  const kind: ClientKind = form.kind === 'withholding' ? 'withholding' : 'private'
  const taxId = cleanClientTaxId(clip(form.taxId, 40))
  if (taxId) {
    const err = checkClientTaxId(taxId)
    if (err) return { ok: false, message: err === 'format' ? 'clientTaxIdFormat' : 'clientTaxIdChecksum' }
  } else if (kind === 'withholding') {
    // Il sostituto d'imposta deve indicare chi ha pagato: serve il suo codice
    return { ok: false, message: 'clientTaxIdRequired' }
  }
  return {
    ok: true,
    row: { name, tax_id: taxId || null, address: orNull(clip(form.address, RO_LIMITS.address)), city: orNull(clip(form.city, RO_LIMITS.city)), kind },
  }
}

export async function saveClient(id: string | null, form: ClientForm): Promise<ActionResult<ReceiptClient>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const clean = cleanClient(form)
  if (!clean.ok) return { success: false, message: clean.message }
  if (id) {
    if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
    const { data, error } = await g.supabase
      .from('occasional_receipt_clients')
      .update(clean.row)
      .eq('id', id)
      .eq('user_id', g.userId)
      .select(CLIENT_COLUMNS)
      .single()
    if (error || !data) return dbError('updateClient', error ?? {})
    return { success: true, data: data as ReceiptClient }
  }
  const { data, error } = await g.supabase
    .from('occasional_receipt_clients')
    .insert({ user_id: g.userId, ...clean.row })
    .select(CLIENT_COLUMNS)
    .single()
  if (error || !data) return dbError('createClient', error ?? {})
  return { success: true, data: data as ReceiptClient }
}

export async function deleteClient(id: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  if (!UUID_RE.test(id)) return { success: false, message: 'deleteError' }
  // Le ricevute già fatte restano: hanno la loro copia dei dati del cliente
  const { error } = await g.supabase.from('occasional_receipt_clients').delete().eq('id', id).eq('user_id', g.userId)
  if (error) {
    console.error('[RicevutaOccasionale] deleteClient failed:', error)
    return { success: false, message: 'deleteError' }
  }
  return { success: true, data: null }
}

// ─── Ricevute ─────────────────────────────────────────────────────────────

/** Ricevute di un anno, dalla più recente. */
export async function listReceipts(year: number): Promise<OccasionalReceipt[]> {
  const g = await gate()
  if (!g || !Number.isInteger(year) || year < 2000 || year > 2100) return []
  const { data, error } = await g.supabase
    .from('occasional_receipts')
    .select(RECEIPT_COLUMNS)
    .eq('user_id', g.userId)
    .eq('year', year)
    .order('number', { ascending: false })
    .limit(5000)
  if (error) {
    console.error('[RicevutaOccasionale] listReceipts failed:', error)
    return []
  }
  return (data ?? []).map((r) => toReceipt(r as Record<string, unknown>))
}

/** Primo anno con una ricevuta (per l'elenco degli anni). */
export async function firstReceiptYear(): Promise<number | null> {
  const g = await gate()
  if (!g) return null
  const { data } = await g.supabase.from('occasional_receipts').select('year').eq('user_id', g.userId).order('year').limit(1).maybeSingle()
  return data ? Number(data.year) : null
}

type ReceiptRow = Omit<OccasionalReceipt, 'id' | 'year' | 'number' | 'cancelled_at'>

async function buildReceiptRow(
  g: NonNullable<Awaited<ReturnType<typeof gate>>>,
  form: ReceiptForm,
): Promise<{ ok: true; row: ReceiptRow; newClient: CleanClient | null } | { ok: false; message: string }> {
  // Dati di chi rilascia: dal profilo salvato
  const { data: profile } = await g.supabase
    .from('occasional_receipt_profiles')
    .select('full_name, tax_code, address, city, iban, default_place')
    .eq('user_id', g.userId)
    .maybeSingle()
  if (!profile) return { ok: false, message: 'profileMissing' }

  const issueDate = clip(form.issueDate, 10)
  if (!isIsoDate(issueDate)) return { ok: false, message: 'dateInvalid' }
  const periodFrom = clip(form.periodFrom, 10)
  const periodTo = clip(form.periodTo, 10)
  if ((periodFrom && !isIsoDate(periodFrom)) || (periodTo && !isIsoDate(periodTo))) return { ok: false, message: 'dateInvalid' }
  if (periodFrom && periodTo && periodTo < periodFrom) return { ok: false, message: 'periodInvalid' }
  const paidOn = clip(form.paidOn, 10)
  if (paidOn && !isIsoDate(paidOn)) return { ok: false, message: 'dateInvalid' }

  const description = clip(form.description, RO_LIMITS.description)
  if (!description) return { ok: false, message: 'descriptionRequired' }

  const gross = Number(form.grossCents)
  const expenses = Number(form.expensesCents) || 0
  if (!Number.isSafeInteger(gross) || gross < 1 || gross > RO_MAX_AMOUNT_CENTS) return { ok: false, message: 'grossInvalid' }
  if (!Number.isSafeInteger(expenses) || expenses < 0 || expenses > RO_MAX_AMOUNT_CENTS) return { ok: false, message: 'expensesInvalid' }

  const stampId = clip(form.stampId, RO_LIMITS.stampId).replace(/\s+/g, '')
  if (stampId && !/^\d{1,20}$/.test(stampId)) return { ok: false, message: 'stampIdInvalid' }

  // Cliente: uno salvato (deve essere suo) oppure scritto qui
  let client: CleanClient
  let newClient: CleanClient | null = null
  if (form.clientId) {
    if (!UUID_RE.test(form.clientId)) return { ok: false, message: 'clientMissing' }
    const { data } = await g.supabase
      .from('occasional_receipt_clients')
      .select('name, tax_id, address, city, kind')
      .eq('id', form.clientId)
      .eq('user_id', g.userId)
      .maybeSingle()
    if (!data) return { ok: false, message: 'clientMissing' }
    client = data as CleanClient
  } else {
    const clean = cleanClient(form.client)
    if (!clean.ok) return { ok: false, message: clean.message }
    client = clean.row
    if (form.saveClient) newClient = clean.row
  }

  const withholding = client.kind === 'withholding'
  const stampCharge = form.stampCharge === 'issuer' ? 'issuer' : 'client'
  // Spese fuori dalla ritenuta: ha senso solo se la ritenuta c'è
  const onBehalf = !!form.expensesOnBehalf && withholding && expenses > 0
  const calc = calcReceipt({ grossCents: gross, expensesCents: expenses, expensesOnBehalf: onBehalf, withholding, stampCharge })

  return {
    ok: true,
    newClient,
    row: {
      issue_date: issueDate,
      place: orNull(clip(form.place, RO_LIMITS.place)),
      client_id: form.clientId || null,
      client_name: client.name,
      client_tax_id: client.tax_id,
      client_address: client.address,
      client_city: client.city,
      client_kind: client.kind,
      issuer_name: profile.full_name,
      issuer_tax_code: profile.tax_code,
      issuer_address: profile.address,
      issuer_city: profile.city,
      issuer_iban: profile.iban,
      description,
      period_from: periodFrom || null,
      period_to: periodTo || null,
      gross_cents: calc.grossCents,
      expenses_cents: calc.expensesCents,
      expenses_on_behalf: onBehalf,
      withholding,
      withholding_cents: calc.withholdingCents,
      stamp_required: calc.stampRequired,
      stamp_charge: stampCharge,
      stamp_cents: calc.stampCents,
      stamp_id: calc.stampRequired ? stampId || null : null,
      total_cents: calc.totalCents,
      net_cents: calc.netCents,
      paid_on: paidOn || null,
      note: orNull(clip(form.note, RO_LIMITS.note)),
    },
  }
}

export async function createReceipt(form: ReceiptForm): Promise<ActionResult<{ receipt: OccasionalReceipt; client: ReceiptClient | null }>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const built = await buildReceiptRow(g, form)
  if (!built.ok) return { success: false, message: built.message }

  // Cliente nuovo da ricordare: si salva prima, così la ricevuta lo collega
  let savedClient: ReceiptClient | null = null
  if (built.newClient) {
    const { data } = await g.supabase
      .from('occasional_receipt_clients')
      .insert({ user_id: g.userId, ...built.newClient })
      .select(CLIENT_COLUMNS)
      .single()
    // Se non si riesce (es. troppi clienti) la ricevuta si fa lo stesso
    if (data) savedClient = data as ReceiptClient
  }

  // Numero e anno li assegna il database (occasional_receipts_number)
  const { data, error } = await g.supabase
    .from('occasional_receipts')
    .insert({ user_id: g.userId, year: Number(built.row.issue_date.slice(0, 4)), number: 1, ...built.row, client_id: savedClient?.id ?? built.row.client_id })
    .select(RECEIPT_COLUMNS)
    .single()
  if (error || !data) return dbError('createReceipt', error ?? {})
  await awardToolPoint(TOOL)
  return { success: true, data: { receipt: toReceipt(data as Record<string, unknown>), client: savedClient } }
}

export async function updateReceipt(id: string, form: ReceiptForm): Promise<ActionResult<{ receipt: OccasionalReceipt; client: ReceiptClient | null }>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const built = await buildReceiptRow(g, form)
  if (!built.ok) return { success: false, message: built.message }

  // L'anno della data non può cambiare: il numero è di quell'anno
  const { data: before } = await g.supabase.from('occasional_receipts').select('year').eq('id', id).eq('user_id', g.userId).maybeSingle()
  if (!before) return { success: false, message: 'saveError' }
  if (Number(built.row.issue_date.slice(0, 4)) !== Number(before.year)) return { success: false, message: 'yearChange' }

  let savedClient: ReceiptClient | null = null
  if (built.newClient) {
    const { data } = await g.supabase
      .from('occasional_receipt_clients')
      .insert({ user_id: g.userId, ...built.newClient })
      .select(CLIENT_COLUMNS)
      .single()
    if (data) savedClient = data as ReceiptClient
  }

  const { data, error } = await g.supabase
    .from('occasional_receipts')
    .update({ ...built.row, client_id: savedClient?.id ?? built.row.client_id })
    .eq('id', id)
    .eq('user_id', g.userId)
    .select(RECEIPT_COLUMNS)
    .single()
  if (error || !data) return dbError('updateReceipt', error ?? {})
  return { success: true, data: { receipt: toReceipt(data as Record<string, unknown>), client: savedClient } }
}

/** Pagata (con la data) o di nuovo da pagare. */
export async function setReceiptPaid(id: string, paidOn: string | null): Promise<ActionResult<OccasionalReceipt>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  if (!UUID_RE.test(id) || (paidOn !== null && !isIsoDate(paidOn))) return { success: false, message: 'dateInvalid' }
  const { data, error } = await g.supabase
    .from('occasional_receipts')
    .update({ paid_on: paidOn })
    .eq('id', id)
    .eq('user_id', g.userId)
    .select(RECEIPT_COLUMNS)
    .single()
  if (error || !data) return dbError('setReceiptPaid', error ?? {})
  return { success: true, data: toReceipt(data as Record<string, unknown>) }
}

/** Annullata (resta nell'elenco con il suo numero, fuori dai totali) o ripristinata. */
export async function setReceiptCancelled(id: string, cancelled: boolean): Promise<ActionResult<OccasionalReceipt>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const { data, error } = await g.supabase
    .from('occasional_receipts')
    .update({ cancelled_at: cancelled ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('user_id', g.userId)
    .select(RECEIPT_COLUMNS)
    .single()
  if (error || !data) return dbError('setReceiptCancelled', error ?? {})
  return { success: true, data: toReceipt(data as Record<string, unknown>) }
}

/** Solo l'ultima ricevuta dell'anno (la numerazione resta senza buchi). */
export async function deleteReceipt(id: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  if (!UUID_RE.test(id)) return { success: false, message: 'deleteError' }
  const { data: row } = await g.supabase.from('occasional_receipts').select('year, number').eq('id', id).eq('user_id', g.userId).maybeSingle()
  if (!row) return { success: false, message: 'deleteError' }
  const { count } = await g.supabase
    .from('occasional_receipts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', g.userId)
    .eq('year', row.year)
    .gt('number', row.number)
  if (count) return { success: false, message: 'notLast' }
  const { data, error } = await g.supabase.from('occasional_receipts').delete().eq('id', id).eq('user_id', g.userId).select('id')
  if (error) {
    console.error('[RicevutaOccasionale] deleteReceipt failed:', error)
    return { success: false, message: 'deleteError' }
  }
  // Nessuna riga eliminata: nel frattempo ne è stata fatta un'altra
  if (!data?.length) return { success: false, message: 'notLast' }
  return { success: true, data: null }
}
