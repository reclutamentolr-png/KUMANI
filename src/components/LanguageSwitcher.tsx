'use client'

import { Languages } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { defaultLocale } from '../../i18n'
import { useEnabledLocales } from '@/components/EnabledLocalesProvider'

const locales = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' },
]

export default function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const locale = pathname.match(/^\/(it|en|fr|es|pt|de|ru)(?=\/|$)/)?.[1] ?? defaultLocale
  // Solo le lingue attive (Admin → Lingue del sito); quella aperta resta
  // visibile anche se spenta (anteprima dello Staff), con la dicitura
  const enabled = useEnabledLocales()
  const options = locales.filter((item) => !enabled || enabled.includes(item.code) || item.code === locale)

  const changeLocale = (nextLocale: string) => {
    const pathWithoutLocale = pathname.replace(/^\/(it|en|fr|es|pt|de|ru)(?=\/|$)/, '') || '/'
    // The default locale is never prefixed (localePrefix: 'as-needed'), so
    // pushing `/it/...` would bounce through a middleware redirect back to
    // the unprefixed path — that extra round trip is what left the <select>
    // showing the previous locale. Build the final URL directly instead.
    const target = nextLocale === defaultLocale ? pathWithoutLocale : `/${nextLocale}${pathWithoutLocale}`
    // When the target URL has no locale prefix (switching back to the
    // default locale), next-intl's middleware can't read the locale from
    // the URL, so it falls back to the NEXT_LOCALE cookie — left over from
    // the previous locale — and silently redirects right back to it. Write
    // the cookie ourselves first so the fallback already matches.
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`
    router.push(target)
    router.refresh()
  }

  return (
    <label className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${dark ? 'border-white/20 bg-white/10 text-white' : 'border-gray-200 bg-white text-gray-700'}`}>
      <Languages className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Cambia lingua</span>
      <select key={locale} value={locale} onChange={(event) => changeLocale(event.target.value)} className="bg-transparent text-inherit outline-none" aria-label="Cambia lingua">
        {options.map((item) => (
          <option key={item.code} value={item.code} className="text-gray-900">
            {item.label}
            {enabled && !enabled.includes(item.code) ? ' (nascosta)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}