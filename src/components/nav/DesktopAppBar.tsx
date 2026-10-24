'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { barePathOf, inMemberArea } from '@/components/nav/AppNav'

// Dal computer, la barra dell'app (Home Kumani, preferiti, lingua, calendario,
// avvisi, profilo, documenti, Wallet, Admin, esci) anche dentro i servizi,
// sopra la loro intestazione: si vede sempre cosa si può fare. Sul telefono no
// (resta com'è). Si nasconde da sola dove la pagina ha già la sua (globals.css:
// [data-app-header]) e per gli ospiti in prova (data-guest-hide).
// Pagine che hanno già la barra (AppHeader): qui non si monta una seconda
// volta (eviterebbe anche due finestre «Profilo» aperte insieme)
const OWN_HEADER = ['/dashboard', '/servizi', '/community', '/wallet', '/documenti', '/avvisi', '/catalogo', '/donazioni', '/recensioni', '/scheda-attivita', '/app/preferiti']

export default function DesktopAppBar({ children }: { children: ReactNode }) {
  const path = barePathOf(usePathname())
  if (!inMemberArea(path) || OWN_HEADER.some((p) => path === p || path.startsWith(`${p}/`))) return null
  return (
    <div data-desktop-appbar data-guest-hide className="hidden lg:block print:hidden">
      {children}
    </div>
  )
}
