'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { defaultLocale } from '../../i18n'

// Come useRouter, ma push/replace verso un percorso interno restano nella
// lingua corrente (come LocalizedLink): senza, da /de si tornava in italiano.
export function useLocalizedRouter() {
  const router = useRouter()
  const locale = useLocale()
  return useMemo(() => {
    const localize = (href: string) => (href.startsWith('/') && locale !== defaultLocale ? `/${locale}${href}` : href)
    return {
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localize(href), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(localize(href), options),
    }
  }, [router, locale])
}
