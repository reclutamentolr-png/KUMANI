'use server'

import { createClient } from '@/lib/supabase/server'
import type { Permission } from '@/lib/admin-permissions'
import { loadBaseMessages, serviceClient } from '@/lib/translationOverrides'
import { invalidateTranslations } from '@/lib/translationCache'
import { checkTranslation, flattenMessages, hashText, isTranslatorLocale, type TranslationCheck, type TranslatorLocale } from '@/lib/translationKeys'

// ── Controlli di accesso ────────────────────────────────────────────────

// Stessa regola di verifyAdmin in actions/admin.ts: profiles.is_admin,
// oppure un ruolo con il permesso richiesto (o '*').
async function verifyAdmin(requiredPermission: Permission) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (profile?.is_admin) return user
  const { data: adminRecord } = await supabase.from('admin_users').select('admin_roles(permissions)').eq('user_id', user.id).maybeSingle()
  const roles = adminRecord?.admin_roles as { permissions?: string[] } | { permissions?: string[] }[] | null | undefined
  const permissions = Array.isArray(roles) ? (roles[0]?.permissions ?? []) : (roles?.permissions ?? [])
  return permissions.includes('*') || permissions.includes(requiredPermission) ? user : null
}

export type TranslatorAccount = { id: string; name: string; locales: TranslatorLocale[] }

// Traduttore attivo della sessione (ruolo nell'account + riga attiva)
async function currentTranslator(): Promise<TranslatorAccount | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || (user.app_metadata as { role?: string } | undefined)?.role !== 'translator') return null
  const { data } = await serviceClient().from('translators').select('display_name, locales, is_active').eq('user_id', user.id).maybeSingle()
  if (!data?.is_active) return null
  return { id: user.id, name: data.display_name as string, locales: ((data.locales as string[]) ?? []).filter(isTranslatorLocale) }
}

export async function getCurrentTranslator(): Promise<TranslatorAccount | null> {
  return currentTranslator()
}

// ── Testi e stato ───────────────────────────────────────────────────────

// done: controllato dal traduttore; stale: l'italiano è cambiato dopo;
// missing: probabilmente non tradotto (uguale all'italiano); base: testo
// del sito non ancora controllato
export type TranslationStatus = 'done' | 'stale' | 'missing' | 'base'

export type TranslationItem = {
  key: string
  italian: string
  base: string
  value: string
  status: TranslationStatus
  updatedAt: string | null
}

type OverrideRow = { key: string; value: string; source_hash: string; updated_at: string }

async function loadOverrideRows(locale: TranslatorLocale, prefix?: string): Promise<Map<string, OverrideRow>> {
  let query = serviceClient().from('translation_overrides').select('key, value, source_hash, updated_at').eq('locale', locale)
  if (prefix) query = query.like('key', `${prefix}.%`)
  const { data } = await query
  return new Map(((data ?? []) as OverrideRow[]).map((row) => [row.key, row]))
}

function statusOf(italian: string, base: string, override: OverrideRow | undefined): TranslationStatus {
  if (override) return override.source_hash === hashText(italian) ? 'done' : 'stale'
  // Uguale all'italiano e con lettere: quasi certamente non tradotto
  return base === italian && /\p{L}{3,}/u.test(italian) ? 'missing' : 'base'
}

async function flatBoth(locale: TranslatorLocale) {
  const [it, target] = await Promise.all([loadBaseMessages('it'), loadBaseMessages(locale)])
  return { it: flattenMessages(it), target: flattenMessages(target) }
}

export type SectionSummary = { id: string; total: number; done: number; stale: number; missing: number }

export async function getTranslationSummary(locale: string): Promise<{ sections: SectionSummary[] } | { error: string }> {
  const me = await currentTranslator()
  if (!me || !isTranslatorLocale(locale) || !me.locales.includes(locale)) return { error: 'not_allowed' }
  const [{ it, target }, overrides] = await Promise.all([flatBoth(locale), loadOverrideRows(locale)])
  const bySection = new Map<string, SectionSummary>()
  for (const [key, italian] of Object.entries(it)) {
    const id = key.split('.')[0]
    const s = bySection.get(id) ?? { id, total: 0, done: 0, stale: 0, missing: 0 }
    const status = statusOf(italian, target[key] ?? italian, overrides.get(key))
    s.total++
    if (status === 'done') s.done++
    else if (status === 'stale') s.stale++
    else if (status === 'missing') s.missing++
    bySection.set(id, s)
  }
  return { sections: [...bySection.values()] }
}

export async function loadTranslationSection(locale: string, section: string): Promise<{ items: TranslationItem[] } | { error: string }> {
  const me = await currentTranslator()
  if (!me || !isTranslatorLocale(locale) || !me.locales.includes(locale)) return { error: 'not_allowed' }
  if (!/^[A-Za-z0-9_]{1,60}$/.test(section)) return { error: 'invalid' }
  const [{ it, target }, overrides] = await Promise.all([flatBoth(locale), loadOverrideRows(locale, section)])
  const items: TranslationItem[] = []
  for (const [key, italian] of Object.entries(it)) {
    if (!key.startsWith(`${section}.`)) continue
    const base = target[key] ?? italian
    const override = overrides.get(key)
    items.push({
      key,
      italian,
      base,
      value: override?.value ?? base,
      status: statusOf(italian, base, override),
      updatedAt: override?.updated_at ?? null,
    })
  }
  return { items }
}

// Ricerca in tutte le sezioni (italiano o lingua tradotta), max 100 risultati
export async function searchTranslations(locale: string, query: string): Promise<{ items: TranslationItem[] } | { error: string }> {
  const me = await currentTranslator()
  if (!me || !isTranslatorLocale(locale) || !me.locales.includes(locale)) return { error: 'not_allowed' }
  const q = query.trim().toLowerCase().slice(0, 100)
  if (q.length < 2) return { items: [] }
  const [{ it, target }, overrides] = await Promise.all([flatBoth(locale), loadOverrideRows(locale)])
  const items: TranslationItem[] = []
  for (const [key, italian] of Object.entries(it)) {
    const base = target[key] ?? italian
    const override = overrides.get(key)
    const value = override?.value ?? base
    if (!italian.toLowerCase().includes(q) && !value.toLowerCase().includes(q) && !key.toLowerCase().includes(q)) continue
    items.push({ key, italian, base, value, status: statusOf(italian, base, override), updatedAt: override?.updated_at ?? null })
    if (items.length >= 100) break
  }
  return { items }
}

export type SaveResult = { success: true; item: TranslationItem } | { success: false; error: string; check?: TranslationCheck }

async function writeOverride(me: TranslatorAccount | { id: string }, locale: TranslatorLocale, key: string, value: string | null): Promise<SaveResult> {
  const { it, target } = await flatBoth(locale)
  const italian = it[key]
  if (italian === undefined) return { success: false, error: 'not_found' }
  const base = target[key] ?? italian
  const db = serviceClient()
  const { data: previous } = await db.from('translation_overrides').select('value').eq('locale', locale).eq('key', key).maybeSingle()
  const oldValue = (previous?.value as string | undefined) ?? null

  if (value === null) {
    const { error } = await db.from('translation_overrides').delete().eq('locale', locale).eq('key', key)
    if (error) return { success: false, error: 'save_failed' }
  } else {
    const check = checkTranslation(italian, value)
    if (!check.ok) return { success: false, error: 'invalid', check }
    const { error } = await db.from('translation_overrides').upsert({
      locale,
      key,
      value,
      source_hash: hashText(italian),
      updated_by: me.id,
      updated_at: new Date().toISOString(),
    })
    if (error) return { success: false, error: 'save_failed' }
  }
  await db.from('translation_history').insert({ locale, key, old_value: oldValue, new_value: value, changed_by: me.id })
  invalidateTranslations()

  const now = value === null ? undefined : { key, value, source_hash: hashText(italian), updated_at: new Date().toISOString() }
  return {
    success: true,
    item: { key, italian, base, value: value ?? base, status: statusOf(italian, base, now), updatedAt: now?.updated_at ?? null },
  }
}

// Salva (o conferma "va bene così") un testo nella propria lingua
export async function saveTranslation(locale: string, key: string, value: string): Promise<SaveResult> {
  const me = await currentTranslator()
  if (!me || !isTranslatorLocale(locale) || !me.locales.includes(locale)) return { success: false, error: 'not_allowed' }
  return writeOverride(me, locale, key, value.replace(/\r\n/g, '\n'))
}

// Torna al testo di base del sito (toglie la correzione)
export async function resetTranslation(locale: string, key: string): Promise<SaveResult> {
  const me = await currentTranslator()
  if (!me || !isTranslatorLocale(locale) || !me.locales.includes(locale)) return { success: false, error: 'not_allowed' }
  return writeOverride(me, locale, key, null)
}

// ── Admin: gestione dei traduttori ──────────────────────────────────────

export type AdminTranslator = {
  id: string
  name: string
  email: string | null
  locales: TranslatorLocale[]
  isActive: boolean
  createdAt: string
  changes: number
}

export async function adminListTranslators(): Promise<{ translators: AdminTranslator[] } | { error: string }> {
  if (!(await verifyAdmin('users.write'))) return { error: 'Non autorizzato' }
  const db = serviceClient()
  const { data, error } = await db.from('translators').select('user_id, display_name, locales, is_active, created_at').order('created_at', { ascending: false })
  if (error) return { error: error.message }
  const rows = data ?? []
  const translators = await Promise.all(
    rows.map(async (row) => {
      const [{ data: auth }, { count }] = await Promise.all([
        db.auth.admin.getUserById(row.user_id as string),
        db.from('translation_history').select('id', { count: 'exact', head: true }).eq('changed_by', row.user_id),
      ])
      return {
        id: row.user_id as string,
        name: row.display_name as string,
        email: auth?.user?.email ?? null,
        locales: ((row.locales as string[]) ?? []).filter(isTranslatorLocale),
        isActive: row.is_active as boolean,
        createdAt: row.created_at as string,
        changes: count ?? 0,
      }
    })
  )
  return { translators }
}

function cleanLocales(locales: string[]): TranslatorLocale[] {
  return [...new Set(locales)].filter(isTranslatorLocale)
}

// Nuovo traduttore: account nuovo (mai un Kumano esistente), password
// scelta dall'Admin, ruolo scritto dal server nell'account
export async function adminCreateTranslator(input: { name: string; email: string; password: string; locales: string[] }) {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false as const, error: 'Non autorizzato' }
  const name = input.name.trim().slice(0, 80)
  const email = input.email.trim().toLowerCase()
  const locales = cleanLocales(input.locales)
  if (!name) return { success: false as const, error: 'Inserisci il nome' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false as const, error: 'Email non valida' }
  if (input.password.length < 10) return { success: false as const, error: 'La password deve avere almeno 10 caratteri' }
  if (locales.length === 0) return { success: false as const, error: 'Scegli almeno una lingua' }

  const db = serviceClient()
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: 'translator' },
    user_metadata: { display_name: name },
  })
  if (error || !created.user) {
    const exists = /already|registered|exists/i.test(error?.message ?? '')
    return { success: false as const, error: exists ? 'Esiste già un account con questa email' : error?.message || 'Creazione non riuscita' }
  }
  const { error: rowError } = await db.from('translators').insert({ user_id: created.user.id, display_name: name, locales, created_by: admin.id })
  if (rowError) {
    await db.auth.admin.deleteUser(created.user.id)
    return { success: false as const, error: 'Creazione non riuscita (esegui la migrazione delle traduzioni?)' }
  }
  return { success: true as const }
}

async function isTranslatorAccount(id: string) {
  const { data } = await serviceClient().from('translators').select('user_id').eq('user_id', id).maybeSingle()
  return !!data
}

export async function adminUpdateTranslator(id: string, input: { name?: string; locales?: string[]; isActive?: boolean }) {
  if (!(await verifyAdmin('users.write'))) return { success: false as const, error: 'Non autorizzato' }
  if (!(await isTranslatorAccount(id))) return { success: false as const, error: 'Traduttore non trovato' }
  const db = serviceClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) {
    const name = input.name.trim().slice(0, 80)
    if (!name) return { success: false as const, error: 'Inserisci il nome' }
    update.display_name = name
  }
  if (input.locales !== undefined) {
    const locales = cleanLocales(input.locales)
    if (locales.length === 0) return { success: false as const, error: 'Scegli almeno una lingua' }
    update.locales = locales
  }
  if (input.isActive !== undefined) {
    update.is_active = input.isActive
    // Sospeso: non può più entrare (e le sue azioni vengono rifiutate subito)
    const { error: banError } = await db.auth.admin.updateUserById(id, { ban_duration: input.isActive ? 'none' : '876000h' })
    if (banError) return { success: false as const, error: banError.message }
  }
  const { error } = await db.from('translators').update(update).eq('user_id', id)
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

export async function adminSetTranslatorPassword(id: string, password: string) {
  if (!(await verifyAdmin('users.write'))) return { success: false as const, error: 'Non autorizzato' }
  if (password.length < 10) return { success: false as const, error: 'La password deve avere almeno 10 caratteri' }
  if (!(await isTranslatorAccount(id))) return { success: false as const, error: 'Traduttore non trovato' }
  const { error } = await serviceClient().auth.admin.updateUserById(id, { password })
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

// Elimina l'account del traduttore (le sue correzioni restano nel sito)
export async function adminDeleteTranslator(id: string) {
  if (!(await verifyAdmin('users.write'))) return { success: false as const, error: 'Non autorizzato' }
  if (!(await isTranslatorAccount(id))) return { success: false as const, error: 'Traduttore non trovato' }
  const { error } = await serviceClient().auth.admin.deleteUser(id)
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

export type TranslationChange = {
  id: string
  locale: string
  key: string
  oldValue: string | null
  newValue: string | null
  changedBy: string
  changedAt: string
}

export async function adminListTranslationChanges(limit = 100): Promise<{ changes: TranslationChange[] } | { error: string }> {
  if (!(await verifyAdmin('users.write'))) return { error: 'Non autorizzato' }
  const db = serviceClient()
  const { data, error } = await db
    .from('translation_history')
    .select('id, locale, key, old_value, new_value, changed_by, changed_at')
    .order('changed_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 300))
  if (error) return { error: error.message }
  const ids = [...new Set((data ?? []).map((r) => r.changed_by as string | null).filter((v): v is string => !!v))]
  const { data: names } = ids.length ? await db.from('translators').select('user_id, display_name').in('user_id', ids) : { data: [] }
  const nameOf = new Map((names ?? []).map((n) => [n.user_id as string, n.display_name as string]))
  return {
    changes: (data ?? []).map((r) => ({
      id: r.id as string,
      locale: r.locale as string,
      key: r.key as string,
      oldValue: (r.old_value as string | null) ?? null,
      newValue: (r.new_value as string | null) ?? null,
      changedBy: nameOf.get(r.changed_by as string) ?? 'Staff',
      changedAt: r.changed_at as string,
    })),
  }
}

// Ripristina il valore che il testo aveva prima di una modifica
export async function adminRevertTranslationChange(historyId: string) {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false as const, error: 'Non autorizzato' }
  const db = serviceClient()
  const { data: change } = await db.from('translation_history').select('locale, key, old_value').eq('id', historyId).maybeSingle()
  if (!change || !isTranslatorLocale(change.locale as string)) return { success: false as const, error: 'Modifica non trovata' }
  const result = await writeOverride({ id: admin.id }, change.locale as TranslatorLocale, change.key as string, (change.old_value as string | null) ?? null)
  if (!result.success) return { success: false as const, error: result.error === 'invalid' ? 'Il testo precedente non è più valido' : 'Ripristino non riuscito' }
  return { success: true as const }
}
