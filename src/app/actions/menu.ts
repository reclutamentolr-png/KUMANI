'use server'

import { randomBytes } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isGuestRequest } from '@/lib/guestServer'
import { isMenuTemplate, type MenuTemplate } from '@/lib/menuThemes'
import { getAnthropicClient, MissingApiKeyError } from '@/lib/anthropic'
import { ANTHROPIC_MODEL } from '@/lib/offermaker'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { loadMenuData } from '@/lib/menu-server'
import {
  cleanLocalized,
  isMenuLocale,
  MENU_ALLERGENS,
  MENU_DIET_TAGS,
  MENU_LOCALES,
  type LocalizedText,
  type MenuAllergen,
  type MenuData,
  type MenuDietTag,
  type MenuLocale,
} from '@/lib/menu'
import { limitError, logAiLimit } from '@/lib/appLimits'

type MenuResult = { success: true; data: MenuData } | { success: false; message: string }

const getServiceClient = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Foto non più usate: si cancellano dal bucket (errori ignorati).
async function removePhotos(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p)
  if (list.length) await getServiceClient().storage.from('menu-photos').remove(list)
}

// Ogni azione: utente collegato + strumento "menu" utilizzabile (piano Pro).
async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'menu'))) return { ok: false as const, message: 'proRequired' }
  return { ok: true as const, supabase, userId: user.id }
}

async function myMenuId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase.from('menus').select('id').eq('owner_id', userId).maybeSingle()
  return data?.id ?? null
}

async function done(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<MenuResult> {
  await awardToolPoint('menu')
  return { success: true, data: await loadMenuData(supabase, userId) }
}

export async function saveMenuSettings(input: {
  restaurantName: string
  tagline: string
  reviewUrl: string
  template: MenuTemplate
  defaultLocale: MenuLocale
  languages: MenuLocale[]
  isActive: boolean
}): Promise<MenuResult> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }

  const restaurantName = input.restaurantName.trim().slice(0, 80)
  if (!restaurantName) return { success: false, message: 'nameRequired' }
  const defaultLocale = isMenuLocale(input.defaultLocale) ? input.defaultLocale : 'it'
  const languages = MENU_LOCALES.filter((l) => l === defaultLocale || input.languages.includes(l))
  const fields = {
    restaurant_name: restaurantName,
    tagline: input.tagline.trim().slice(0, 140) || null,
    default_locale: defaultLocale,
    languages,
  }

  const reviewUrl = input.reviewUrl.trim().slice(0, 500)
  if (reviewUrl && !/^https?:\/\/\S+$/i.test(reviewUrl)) return { success: false, message: 'invalidUrl' }

  const template = isMenuTemplate(input.template) ? input.template : 'elegante'
  const update = { ...fields, template, review_url: reviewUrl || null, updated_at: new Date().toISOString() }

  const menuId = await myMenuId(g.supabase, g.userId)
  if (menuId) {
    const { error } = await g.supabase
      .from('menus')
      .update({ ...update, is_active: !!input.isActive })
      .eq('id', menuId)
    if (error) return { success: false, message: 'saveError' }
  } else {
    // Creazione: solo le colonne ammesse in inserimento, poi stile e link.
    const { error } = await g.supabase.from('menus').insert({ ...fields, owner_id: g.userId })
    if (error) return { success: false, message: 'saveError' }
    await g.supabase.from('menus').update(update).eq('owner_id', g.userId)
  }
  return done(g.supabase, g.userId)
}

export async function saveMenuCategory(input: { id?: string; names: LocalizedText }): Promise<MenuResult> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const menuId = await myMenuId(g.supabase, g.userId)
  if (!menuId) return { success: false, message: 'saveError' }

  const names = cleanLocalized(input.names, 60)
  if (!Object.keys(names).length) return { success: false, message: 'nameRequired' }

  if (input.id) {
    const { error } = await g.supabase.from('menu_categories').update({ names }).eq('id', input.id).eq('menu_id', menuId)
    if (error) return { success: false, message: 'saveError' }
  } else {
    const { count } = await g.supabase.from('menu_categories').select('id', { count: 'exact', head: true }).eq('menu_id', menuId)
    const { error } = await g.supabase.from('menu_categories').insert({ menu_id: menuId, names, position: count ?? 0 })
    if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  }
  return done(g.supabase, g.userId)
}

export async function deleteMenuCategory(id: string): Promise<MenuResult> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { data: photos } = await g.supabase.from('menu_items').select('photo_path').eq('category_id', id)
  const { error } = await g.supabase.from('menu_categories').delete().eq('id', id)
  if (error) return { success: false, message: 'saveError' }
  await removePhotos((photos ?? []).map((row) => row.photo_path))
  return done(g.supabase, g.userId)
}

export async function saveMenuItem(input: {
  id?: string
  categoryId: string
  name: string
  names: LocalizedText
  descriptions: LocalizedText
  price: number | null
  dietTags: MenuDietTag[]
  allergens: MenuAllergen[]
  photoPath: string | null
  available: boolean
  isDailySpecial: boolean
  inventoryProductId?: string | null
}): Promise<MenuResult> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const menuId = await myMenuId(g.supabase, g.userId)
  if (!menuId) return { success: false, message: 'saveError' }

  const name = input.name.trim().slice(0, 120)
  if (!name) return { success: false, message: 'nameRequired' }
  // La foto deve essere nella cartella dell'utente (caricata con uploadMenuPhoto).
  const photoPath = input.photoPath && input.photoPath.startsWith(`${g.userId}/`) ? input.photoPath : null
  const price = input.price === null || Number.isNaN(Number(input.price)) ? null : Math.round(Math.max(0, Number(input.price)) * 100) / 100
  const fields = {
    category_id: input.categoryId,
    name,
    names: cleanLocalized(input.names, 120),
    descriptions: cleanLocalized(input.descriptions, 400),
    price,
    diet_tags: MENU_DIET_TAGS.filter((tag) => input.dietTags.includes(tag)),
    allergens: MENU_ALLERGENS.filter((a) => (input.allergens ?? []).includes(a)),
    photo_path: photoPath,
    available: !!input.available,
    is_daily_special: !!input.isDailySpecial,
    // Il trigger accetta solo prodotti dello stesso titolare del menu
    inventory_product_id:
      typeof input.inventoryProductId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.inventoryProductId)
        ? input.inventoryProductId
        : null,
  }

  if (input.id) {
    const { data: previous } = await g.supabase.from('menu_items').select('photo_path').eq('id', input.id).maybeSingle()
    const { error } = await g.supabase
      .from('menu_items')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', input.id)
      .eq('menu_id', menuId)
    if (error) return { success: false, message: 'saveError' }
    if (previous?.photo_path && previous.photo_path !== photoPath) await removePhotos([previous.photo_path])
  } else {
    const { count: inCategory } = await g.supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', input.categoryId)
    const { error } = await g.supabase.from('menu_items').insert({ ...fields, menu_id: menuId, position: inCategory ?? 0 })
    if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  }
  return done(g.supabase, g.userId)
}

export async function deleteMenuItem(id: string): Promise<MenuResult> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { data: previous } = await g.supabase.from('menu_items').select('photo_path').eq('id', id).maybeSingle()
  const { error } = await g.supabase.from('menu_items').delete().eq('id', id)
  if (error) return { success: false, message: 'saveError' }
  await removePhotos([previous?.photo_path])
  return done(g.supabase, g.userId)
}

// Esaurito / piatto del giorno con un tocco.
export async function setMenuItemFlag(id: string, flag: 'available' | 'is_daily_special', value: boolean): Promise<MenuResult> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (flag !== 'available' && flag !== 'is_daily_special') return { success: false, message: 'saveError' }
  const { error } = await g.supabase
    .from('menu_items')
    .update({ [flag]: !!value, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { success: false, message: 'saveError' }
  return done(g.supabase, g.userId)
}

// Sposta su/giù una categoria o un piatto (riscrive le posizioni in ordine).
export async function moveMenuEntry(kind: 'category' | 'item', id: string, direction: -1 | 1): Promise<MenuResult> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const data = await loadMenuData(g.supabase, g.userId)
  if (!data.menu) return { success: false, message: 'saveError' }

  const list =
    kind === 'category'
      ? data.categories.map((c) => c.id)
      : (() => {
          const item = data.items.find((i) => i.id === id)
          return item ? data.items.filter((i) => i.category_id === item.category_id).map((i) => i.id) : []
        })()
  const index = list.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= list.length) return { success: true, data }
  ;[list[index], list[target]] = [list[target], list[index]]

  const table = kind === 'category' ? 'menu_categories' : 'menu_items'
  await Promise.all(list.map((entryId, position) => g.supabase.from(table).update({ position }).eq('id', entryId)))
  return { success: true, data: await loadMenuData(g.supabase, g.userId) }
}

// Foto di un piatto: il browser la ridimensiona, qui si ricontrollano tipo e
// peso e si carica nella cartella dell'utente. Restituisce il percorso da
// salvare con il piatto.
export async function uploadMenuPhoto(formData: FormData): Promise<{ success: true; path: string } | { success: false; message: string }> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const file = formData.get('file')
  if (!(file instanceof File)) return { success: false, message: 'photoError' }
  const allowed: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = allowed[file.type]
  if (!ext || file.size > 2 * 1024 * 1024) return { success: false, message: 'photoError' }

  const path = `${g.userId}/${randomBytes(10).toString('hex')}.${ext}`
  const { error } = await getServiceClient()
    .storage.from('menu-photos')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) return { success: false, message: 'photoError' }
  return { success: true, path }
}

// ------------------------------------------------------------------
// Traduzione AI: riempie SOLO i testi mancanti nelle lingue attive
// (categorie, descrizioni e, se il ristoratore lo ha scelto, nomi dei
// piatti). Quello scritto a mano non viene mai sovrascritto e tutto resta
// modificabile. Numero di traduzioni al giorno limitato (costo AI).
// ------------------------------------------------------------------

const LANGUAGE_NAMES: Record<MenuLocale, string> = {
  it: 'Italian',
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese (European)',
  de: 'German',
  ru: 'Russian',
}

type TranslationEntry = { key: string; kind: 'category' | 'description' | 'dish name'; text: string; languages: MenuLocale[] }

async function translateChunk(entries: TranslationEntry[], source: MenuLocale): Promise<Map<string, LocalizedText>> {
  const client = getAnthropicClient()
  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 8000,
    tools: [
      {
        name: 'emit_translations',
        description: 'Returns the translations of the menu texts.',
        input_schema: {
          type: 'object',
          properties: {
            translations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  texts: {
                    type: 'object',
                    description: 'Language code -> translated text, only for the requested languages',
                    additionalProperties: { type: 'string' },
                  },
                },
                required: ['key', 'texts'],
              },
            },
          },
          required: ['translations'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'emit_translations' },
    messages: [
      {
        role: 'user',
        content: [
          `You translate a restaurant menu written in ${LANGUAGE_NAMES[source]}.`,
          'Rules:',
          `- Translate each entry only into the languages listed for it (codes: ${MENU_LOCALES.map((l) => `${l} = ${LANGUAGE_NAMES[l]}`).join(', ')}).`,
          '- Culinary accuracy: use the natural terms a local restaurant would use. Keep Italian or regional product names (for example nduja, burrata, guanciale) untranslated.',
          '- Do not add ingredients, claims or information that are not in the source. Keep the same tone and roughly the same length.',
          '- "category" entries are menu sections (for example Antipasti -> Starters). "dish name" entries are dish names the owner explicitly wants translated.',
          '- Return every key exactly as given.',
          '',
          'Entries (JSON):',
          JSON.stringify(entries),
        ].join('\n'),
      },
    ],
  })
  const toolUse = message.content.find((block): block is Extract<typeof block, { type: 'tool_use' }> => block.type === 'tool_use')
  const result = new Map<string, LocalizedText>()
  const list = (toolUse?.input as { translations?: { key: string; texts: Record<string, string> }[] } | undefined)?.translations ?? []
  for (const row of list) {
    const wanted = entries.find((entry) => entry.key === row.key)
    if (!wanted || !row.texts) continue
    const texts: LocalizedText = {}
    for (const l of wanted.languages) {
      const value = row.texts[l]
      if (typeof value === 'string' && value.trim()) texts[l] = value.trim()
    }
    result.set(row.key, texts)
  }
  return result
}

export async function translateMenuMissing(): Promise<
  { success: true; data: MenuData; translated: number } | { success: false; message: string }
> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  // In prova (ospite) niente AI
  if (await isGuestRequest()) return { success: false, message: 'aiUnavailable' }
  const data = await loadMenuData(g.supabase, g.userId)
  if (!data.menu) return { success: false, message: 'saveError' }

  const source = data.menu.default_locale
  const targets = data.menu.languages.filter((l) => l !== source)
  if (!targets.length) return { success: false, message: 'noLanguages' }

  const missing = (texts: LocalizedText) => targets.filter((l) => !texts[l]?.trim())
  const entries: TranslationEntry[] = []
  for (const category of data.categories) {
    const text = category.names[source]?.trim()
    const languages = missing(category.names)
    if (text && languages.length) entries.push({ key: `c:${category.id}`, kind: 'category', text, languages })
  }
  for (const item of data.items) {
    const description = item.descriptions[source]?.trim()
    const descLanguages = missing(item.descriptions)
    if (description && descLanguages.length) entries.push({ key: `d:${item.id}`, kind: 'description', text: description, languages: descLanguages })
    // Nome tradotto solo se il ristoratore ha scelto "Traduci anche il nome".
    if (Object.keys(item.names).length) {
      const nameLanguages = missing(item.names)
      if (nameLanguages.length) entries.push({ key: `n:${item.id}`, kind: 'dish name', text: item.name, languages: nameLanguages })
    }
  }
  if (!entries.length) return { success: false, message: 'nothingToTranslate' }

  // Senza chiave API non si consuma la quota giornaliera.
  try {
    getAnthropicClient()
  } catch (err) {
    if (err instanceof MissingApiKeyError) return { success: false, message: 'aiUnavailable' }
    throw err
  }

  // Limite giornaliero (contato prima della chiamata, anche se poi fallisce).
  const service = getServiceClient()
  const { data: limitRow } = await service.from('system_settings').select('value').eq('key', 'menu_ai_daily_runs').maybeSingle()
  const limit = Number(String(limitRow?.value ?? '5').replace(/"/g, '')) || 5
  // Contatore atomico: richieste in parallelo non superano il limite
  const { data: taken } = await service.rpc('ai_quota_take', { p_kind: 'menu', p_user: g.userId, p_limit: limit })
  if (taken === null || taken === undefined) {
    await logAiLimit(g.userId, 'menu')
    return { success: false, message: 'aiLimitReached' }
  }

  const results = new Map<string, LocalizedText>()
  try {
    const chunks: TranslationEntry[][] = []
    for (let i = 0; i < entries.length; i += 20) chunks.push(entries.slice(i, i + 20))
    for (let i = 0; i < chunks.length; i += 4) {
      const batch = await Promise.all(chunks.slice(i, i + 4).map((chunk) => translateChunk(chunk, source)))
      for (const map of batch) for (const [key, value] of map) results.set(key, value)
    }
  } catch (err) {
    console.error('[Menu] translateMenuMissing failed:', err)
    if (err instanceof MissingApiKeyError) return { success: false, message: 'aiUnavailable' }
    return { success: false, message: 'aiError' }
  }

  // Si uniscono le traduzioni ai testi esistenti (mai sovrascritti).
  let translated = 0
  const merge = (current: LocalizedText, extra: LocalizedText | undefined) => {
    const next = { ...current }
    for (const [l, value] of Object.entries(extra ?? {}) as [MenuLocale, string][]) {
      if (!next[l]?.trim()) {
        next[l] = value.slice(0, 400)
        translated++
      }
    }
    return next
  }
  const updates: PromiseLike<unknown>[] = []
  for (const category of data.categories) {
    const extra = results.get(`c:${category.id}`)
    if (extra) updates.push(g.supabase.from('menu_categories').update({ names: merge(category.names, extra) }).eq('id', category.id))
  }
  for (const item of data.items) {
    const desc = results.get(`d:${item.id}`)
    const name = results.get(`n:${item.id}`)
    if (desc || name) {
      updates.push(
        g.supabase
          .from('menu_items')
          .update({ descriptions: merge(item.descriptions, desc), names: merge(item.names, name), updated_at: new Date().toISOString() })
          .eq('id', item.id)
      )
    }
  }
  await Promise.all(updates)
  await awardToolPoint('menu')
  return { success: true, data: await loadMenuData(g.supabase, g.userId), translated }
}

// Elimina il menù con categorie, piatti e foto. Il QR smette di funzionare:
// un nuovo menù avrà un nuovo QR.
export async function deleteMenu(): Promise<MenuResult> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const menuId = await myMenuId(g.supabase, g.userId)
  if (!menuId) return { success: true, data: { menu: null, categories: [], items: [] } }
  const { data: photos } = await g.supabase.from('menu_items').select('photo_path').eq('menu_id', menuId)
  const { error } = await g.supabase.from('menus').delete().eq('id', menuId)
  if (error) return { success: false, message: 'saveError' }
  await removePhotos((photos ?? []).map((row) => row.photo_path))
  return { success: true, data: { menu: null, categories: [], items: [] } }
}
