'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { rememberRecentTool } from '@/lib/recentTools'
import { barePathOf } from './AppNav'

// Servizi usati di recente (per la Home): quando si apre un servizio se ne
// annota il nome in questo browser. Solo una comodità: senza memoria del
// browser la Home mostra semplicemente meno cose.
const TOOL_PATHS = getMarketplaceTools((key) => key).map(({ toolName, href }) => ({ toolName, href }))

export default function RecentToolTracker() {
  const pathname = usePathname()
  useEffect(() => {
    const path = barePathOf(pathname)
    const tool = TOOL_PATHS.find(({ href }) => path === href || path.startsWith(`${href}/`))
    if (tool) rememberRecentTool(tool.toolName)
  }, [pathname])
  return null
}
