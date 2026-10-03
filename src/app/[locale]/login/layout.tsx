import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo'

// Titolo e descrizione della pagina di accesso (la pagina è un componente client)
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo')
  return pageMetadata('/login', { title: t('loginTitle'), description: t('loginDescription') })
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
