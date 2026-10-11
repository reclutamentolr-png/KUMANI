'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle, Palette } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { setBrandFollow } from '@/app/actions/brand'
import type { BrandColors, BrandService } from '@/lib/brand'

// Nei servizi: segue i colori del brand? Se no, «Usa i colori del brand»
export default function BrandFollowNotice({
  service,
  brand,
  following,
  onFollow,
}: {
  service: BrandService
  brand: BrandColors | null
  following: boolean
  onFollow: () => void
}) {
  const t = useTranslations('brand')
  const [busy, setBusy] = useState(false)
  if (!brand) {
    return (
      <Link href="/scheda-attivita/colori" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8a6a1f] hover:text-[var(--ink)]">
        <Palette className="h-4 w-4" aria-hidden="true" />
        {t('notice.choose')}
      </Link>
    )
  }
  const swatches = (
    <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
      {[brand.primary, brand.accent, brand.background, brand.text].map((c, i) => (
        <span key={i} className="h-5 w-5 rounded-full border-2 border-white" style={{ background: c }} />
      ))}
    </span>
  )
  if (following) {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-[#e7f4ea] px-3 py-2 text-sm text-[#14532d]">
        {swatches}
        <span className="font-semibold">{t('notice.following')}</span>
        <Link href="/scheda-attivita/colori" className="font-bold underline-offset-2 hover:underline">
          {t('notice.change')}
        </Link>
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 px-3 py-2 text-sm text-[var(--ink)]">
      {swatches}
      <span>{t('notice.notFollowing')}</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const result = await setBrandFollow(service, true)
          setBusy(false)
          if (result.success) onFollow()
        }}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-60"
      >
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {t('notice.use')}
      </button>
    </div>
  )
}
