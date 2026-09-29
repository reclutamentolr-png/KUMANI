import Link from '@/components/LocalizedLink'
import type { ComponentProps, ReactNode } from 'react'

// Pulsante "Torna alla Dashboard" in cima agli strumenti. La dashboard è
// l'unico punto di partenza (la vecchia griglia /marketplace del Tipo 1 non
// c'è più), quindi si torna sempre lì, anche se il ?from=dashboard si perde
// passando da una sottopagina all'altra. `children` (la vecchia etichetta
// "Torna all'Ecosistema") resta accettato solo per compatibilità.
export default function ToolBackLink({
  dashboardLabel,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href' | 'children'> & {
  children?: ReactNode
  dashboardLabel: ReactNode
}) {
  return (
    <Link href="/dashboard" {...props}>
      {dashboardLabel}
    </Link>
  )
}
