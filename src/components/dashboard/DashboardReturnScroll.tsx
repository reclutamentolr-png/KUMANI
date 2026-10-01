'use client'

import { useEffect } from 'react'
import { clearDashboardReturn, readDashboardReturn } from '@/lib/dashboardReturn'

// Riporta la dashboard al punto da cui si era aperto un servizio (vedi
// lib/dashboardReturn.ts). Aspetta che la categoria riaperta abbia allungato
// la pagina, poi scorre e cancella il promemoria.
export default function DashboardReturnScroll() {
  useEffect(() => {
    const target = readDashboardReturn()
    if (!target) return
    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= target.scrollY
      if (reachable || tries >= 20) {
        window.clearInterval(timer)
        window.scrollTo({ top: target.scrollY, behavior: 'auto' })
        clearDashboardReturn()
      }
    }, 50)
    return () => window.clearInterval(timer)
  }, [])
  return null
}
