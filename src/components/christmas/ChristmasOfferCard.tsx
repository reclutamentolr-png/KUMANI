'use client'

import { useState } from 'react'
import { Gift, TreePine, X } from 'lucide-react'
import NextLink from 'next/link'
import Link from '@/components/LocalizedLink'

type Texts = { title: string; gift: string | null; self: string | null; until: string; giftCta: string; selfCta: string; close: string }

// Riquadro dell'offerta di Natale (vedi ChristmasOfferBanner): «Regala» porta
// ai Regali, «Per me» all'abbonamento (/billing, fuori dalle lingue) con lo
// sconto già applicato al pagamento
export default function ChristmasOfferCard({ today, cookieName, texts }: { today: string; cookieName: string; texts: Texts }) {
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  const hide = () => {
    document.cookie = `${cookieName}=${today}; path=/; max-age=${60 * 60 * 36}; samesite=lax`
    setHidden(true)
  }
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-r from-[#5c0c18] via-[#7a1022] to-[var(--ink)] p-4 text-white shadow-md sm:p-5">
      <TreePine aria-hidden className="pointer-events-none absolute -bottom-4 right-10 h-28 w-28 text-emerald-400/10 sm:right-24" />
      <button type="button" onClick={hide} aria-label={texts.close} title={texts.close} className="absolute right-2 top-2 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-3 pr-6 sm:flex-row sm:items-center sm:gap-5">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[var(--gold-bright)] sm:flex">
          <Gift className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold-bright)]">{texts.title}</p>
          {texts.gift && <p className="mt-1 text-lg font-extrabold leading-snug">{texts.gift}</p>}
          {texts.self && <p className={texts.gift ? 'text-sm text-white/85' : 'mt-1 text-lg font-extrabold leading-snug'}>{texts.self}</p>}
          <p className="mt-1 text-xs text-white/60">{texts.until}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {texts.gift && (
            <Link href="/regali" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2 text-sm font-bold text-[var(--ink)] shadow hover:brightness-105">
              <Gift className="h-4 w-4" /> {texts.giftCta}
            </Link>
          )}
          {texts.self && (
            <NextLink href="/billing" className="inline-flex items-center rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              {texts.selfCta}
            </NextLink>
          )}
        </div>
      </div>
    </section>
  )
}
