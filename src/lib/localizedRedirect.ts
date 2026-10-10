import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { defaultLocale } from '../../i18n'

// redirect() verso un percorso interno nella lingua della pagina
export async function localizedRedirect(path: string): Promise<never> {
  const locale = await getLocale()
  redirect(locale === defaultLocale ? path : `/${locale}${path}`)
}
