import Link from '@/components/LocalizedLink'
import type { ComponentProps, ReactNode } from 'react'

// Pulsante «Torna ai servizi» in cima agli strumenti: si torna sempre alla
// pagina Servizi, da dove si sceglie un altro servizio (anche passando da una
// sottopagina all'altra). `children` (la vecchia etichetta «Torna
// all'Ecosistema») resta accettato solo per compatibilità.
export default function ToolBackLink({
  label,
  className = '',
  ...props
}: Omit<ComponentProps<typeof Link>, 'href' | 'children'> & {
  children?: ReactNode
  label: ReactNode
}) {
  // shrink-0: sul telefono non si schiaccia contro il titolo dello strumento
  return (
    <Link href="/servizi" className={`shrink-0 ${className}`} {...props}>
      {label}
    </Link>
  )
}
