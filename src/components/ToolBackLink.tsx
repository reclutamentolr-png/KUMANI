'use client'

import { useSyncExternalStore, type ComponentProps, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { FROM_ICONS_KEY, FROM_SERVICES, HOME_VIEW_COOKIE } from '@/lib/homeView'

// Pulsante «Torna ai servizi» in cima agli strumenti: si torna alla pagina
// Servizi, da dove si sceglie un altro servizio. Con la Home a icone (cookie
// della vista, vedi lib/homeView) diventa «‹ Home» e riporta alle icone,
// come in un'app. `children` (la vecchia etichetta «Torna all'Ecosistema»)
// resta accettato solo per compatibilità.
const subscribe = () => () => {}
const readIconsView = () => {
  try {
    // Aperto dalla pagina Servizi: si torna lì
    const from = sessionStorage.getItem(FROM_ICONS_KEY)
    if (from === FROM_SERVICES) return false
    if (from === '1') return true
    return document.cookie.split(';').some((c) => c.trim() === `${HOME_VIEW_COOKIE}=icons`)
  } catch {
    return false
  }
}

export default function ToolBackLink({
  label,
  className = '',
  ...props
}: Omit<ComponentProps<typeof Link>, 'href' | 'children'> & {
  children?: ReactNode
  label: ReactNode
}) {
  const t = useTranslations('hub')
  // Sul server (e al primo disegno) sempre «Torna ai servizi»
  const icons = useSyncExternalStore(subscribe, readIconsView, () => false)
  // shrink-0: sul telefono non si schiaccia contro il titolo dello strumento
  return (
    <Link href={icons ? '/dashboard' : '/servizi'} className={`shrink-0 ${className}`} {...props}>
      {icons ? (
        <span className="inline-flex items-center gap-0.5">
          <ChevronLeft className="h-5 w-5" aria-hidden /> {t('nav_home')}
        </span>
      ) : (
        label
      )}
    </Link>
  )
}
