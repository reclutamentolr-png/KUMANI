import { getRequestConfig } from 'next-intl/server';
import { applyOverrides, getTranslationOverrides } from './src/lib/translationOverrides';

export const locales = ['it', 'fr', 'en', 'es', 'pt', 'de', 'ru'];
export const defaultLocale = 'it';

function mergeMessages<T extends Record<string, unknown>>(fallback: T, messages: T): T {
  const merged: Record<string, unknown> = { ...fallback, ...messages }

  for (const key of Object.keys(fallback)) {
    const fallbackValue = fallback[key]
    const messageValue = messages[key]
    if (fallbackValue && messageValue && typeof fallbackValue === 'object' && typeof messageValue === 'object' && !Array.isArray(fallbackValue) && !Array.isArray(messageValue)) {
      merged[key] = mergeMessages(fallbackValue as Record<string, unknown>, messageValue as Record<string, unknown>)
    }
  }

  return merged as T
}

const mergedCache = new Map<string, { key: string; messages: Record<string, unknown> }>()

export default getRequestConfig(async ({ requestLocale }) => {
  // 1. Ottieni la locale dalla richiesta (è una Promise in Next.js 15 / next-intl v4)
  let locale = await requestLocale;

  // 2. Assicurati che sia una locale valida, altrimenti usa quella di default
  if (!locale || !locales.includes(locale)) {
    locale = defaultLocale;
  }

  // 3. Restituisci OBBLIGATORIAMENTE sia 'locale' che 'messages'
  const messages = (await import(`./messages/${locale}.json`)).default
  const fallbackMessages = locale === defaultLocale
    ? messages
    : (await import(`./messages/${defaultLocale}.json`)).default

  // 4. Correzioni dei traduttori (Area Traduttori), sopra ai file; mai
  //    sull'italiano, che è la base
  const overrides = locale === defaultLocale ? {} : await getTranslationOverrides(locale)

  // Testi uniti tenuti in memoria per lingua (prima si rifaceva l'unione di
  // circa 600 KB a ogni richiesta); si rifanno se cambiano le correzioni
  const overridesKey = JSON.stringify(overrides)
  const cached = mergedCache.get(locale)
  if (cached && cached.key === overridesKey) return { locale, messages: cached.messages }
  const merged = applyOverrides(mergeMessages(fallbackMessages, messages), overrides)
  mergedCache.set(locale, { key: overridesKey, messages: merged })
  return {
    locale,
    messages: merged
  };
});