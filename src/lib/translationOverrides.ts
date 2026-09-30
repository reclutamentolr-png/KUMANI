import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Testi corretti dai traduttori (tabella translation_overrides): si
// sovrappongono ai file delle lingue senza ripubblicare il sito. Tenuti in
// memoria per lingua e svuotati a ogni correzione (invalidateTranslations,
// in translationCache.ts: qui non si può, questo file lo usa anche i18n.ts).
export const TRANSLATIONS_CACHE_TAG = 'translations'

export function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const fetchOverrides = unstable_cache(
  async (locale: string): Promise<Record<string, string>> => {
    const { data, error } = await serviceClient().from('translation_overrides').select('key, value').eq('locale', locale)
    // Tabella non ancora creata o database non raggiungibile: si usano i file
    if (error || !data) return {}
    return Object.fromEntries(data.map((row) => [row.key as string, row.value as string]))
  },
  ['translation-overrides'],
  { revalidate: 600, tags: [TRANSLATIONS_CACHE_TAG] }
)

export async function getTranslationOverrides(locale: string): Promise<Record<string, string>> {
  try {
    return await fetchOverrides(locale)
  } catch {
    return {}
  }
}

type MessageTree = { [key: string]: string | MessageTree }

// Applica le correzioni solo a testi che esistono già (mai chiavi nuove)
export function applyOverrides<T extends MessageTree>(messages: T, overrides: Record<string, string>): T {
  const entries = Object.entries(overrides)
  if (entries.length === 0) return messages
  const copy = structuredClone(messages) as MessageTree
  for (const [key, value] of entries) {
    const parts = key.split('.')
    let node: MessageTree | string | undefined = copy
    for (let i = 0; i < parts.length - 1 && node && typeof node === 'object'; i++) node = node[parts[i]]
    const last = parts[parts.length - 1]
    if (node && typeof node === 'object' && typeof node[last] === 'string') node[last] = value
  }
  return copy as T
}

// File delle lingue così come sono nel sito (base su cui si correggono)
export async function loadBaseMessages(locale: string): Promise<MessageTree> {
  return (await import(`../../messages/${locale}.json`)).default as MessageTree
}
