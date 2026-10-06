'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getMaintenanceGate } from '@/app/actions/system'
import MaintenanceScreen from './MaintenanceScreen'

// La manutenzione la applica già il proxy a ogni richiesta al server: qui
// basta un controllo all'apertura della pagina, ripetuto cambiando pagina
// solo se l'ultimo ha più di 5 minuti (pagine già in memoria nel browser,
// che non ripassano dal server). Prima si chiedeva a ogni cambio pagina.
const RECHECK_MS = 5 * 60 * 1000
type GateStatus = { enabled: boolean; message: string }
// Ultimo esito, anche per i gate montati dopo (es. pagina di accesso)
let lastCheck: { at: number; status: GateStatus } | null = null

type MaintenanceGateProps = {
  children: React.ReactNode
}

export default function MaintenanceGate({ children }: MaintenanceGateProps) {
  const pathname = usePathname()
  const [status, setStatus] = useState<GateStatus | null>(() => lastCheck?.status ?? null)
  const checking = useRef(false)

  // Route sempre accessibili: admin, callback auth e le pagine di accesso
  // (con o senza prefisso lingua), così un admin può entrare anche durante
  // la manutenzione.
  const isExempt =
    pathname?.includes('/admin') ||
    pathname?.includes('/auth/') ||
    /^(\/[a-z]{2})?\/(login|forgot-password|reset-password)(\/|$)/.test(pathname ?? '')

  useEffect(() => {
    // Pagine sempre accessibili: nessun controllo (si mostrano subito, sotto)
    if (isExempt || checking.current) return
    if (lastCheck && Date.now() - lastCheck.at < RECHECK_MS) return

    checking.current = true
    getMaintenanceGate()
      .then((s) => {
        const next = { enabled: s.enabled, message: s.message }
        lastCheck = { at: Date.now(), status: next }
        setStatus(next)
      })
      .catch((err) => {
        console.error('[MaintenanceGate] Errore chiamata:', err)
        setStatus({ enabled: false, message: '' })
      })
      .finally(() => {
        checking.current = false
      })
  }, [isExempt, pathname])

  // Pagine sempre accessibili, o controllo in corso: contenuto normale
  // (evita flash)
  if (isExempt || status === null) {
    return <>{children}</>
  }

  if (status.enabled && !isExempt) {
    return <MaintenanceScreen message={status.message} />
  }

  return <>{children}</>
}
