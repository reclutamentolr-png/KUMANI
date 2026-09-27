'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getMaintenanceGate } from '@/app/actions/system'
import MaintenanceScreen from './MaintenanceScreen'

type MaintenanceGateProps = {
  children: React.ReactNode
}

export default function MaintenanceGate({ children }: MaintenanceGateProps) {
  const pathname = usePathname()
  const [status, setStatus] = useState<{ enabled: boolean; message: string } | null>(null)

  // Route sempre accessibili: admin, callback auth e le pagine di accesso
  // (con o senza prefisso lingua), così un admin può entrare anche durante
  // la manutenzione.
  const isExempt =
    pathname?.includes('/admin') ||
    pathname?.includes('/auth/') ||
    /^(\/[a-z]{2})?\/(login|forgot-password|reset-password)(\/|$)/.test(pathname ?? '')

  useEffect(() => {
    if (isExempt) {
      setStatus({ enabled: false, message: '' })
      return
    }

    getMaintenanceGate()
      .then((s) => {
        setStatus({ enabled: s.enabled, message: s.message })
      })
      .catch((err) => {
        console.error('[MaintenanceGate] Errore chiamata:', err)
        setStatus({ enabled: false, message: '' })
      })
  }, [isExempt, pathname])

  // Durante il caricamento, mostra il contenuto normale (evita flash)
  if (status === null) {
    return <>{children}</>
  }

  if (status.enabled && !isExempt) {
    return <MaintenanceScreen message={status.message} />
  }

  return <>{children}</>
}
