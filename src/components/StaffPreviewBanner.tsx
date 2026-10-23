'use client'

import { usePathname } from 'next/navigation'
import { EyeOff } from 'lucide-react'
import { locales } from '../../i18n'

// Fascia in cima ai servizi «Solo Staff» (spenti per gli iscritti, aperti
// allo Staff per provarli): ricorda che gli iscritti non li vedono ancora.
export default function StaffPreviewBanner({ hrefs, label }: { hrefs: string[]; label: string }) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && locales.includes(segments[0])) segments.shift()
  const path = `/${segments.join('/')}`
  if (!hrefs.some((href) => path === href || path.startsWith(`${href}/`))) return null
  return (
    <div role="status" className="relative z-30 flex items-center justify-center gap-2 bg-[#7c3aed] px-4 py-1.5 text-center text-xs font-bold text-white print:hidden">
      <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </div>
  )
}
