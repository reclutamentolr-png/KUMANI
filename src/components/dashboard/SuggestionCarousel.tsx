'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, ChevronLeft, ChevronRight, Smartphone } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { serviceHref } from '@/components/services/ServicesBrowser'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { GROUP_STYLE } from '@/lib/serviceGroups'
import type { ServiceItem } from '@/lib/servicesCatalog'

const MAX_SLIDES = 8
const INTERVAL_MS = 6000

// "Ti potrebbe servire": servizi che l'utente può già usare ma non ha mai
// aperto, a rotazione ogni 6 secondi (ogni giorno si parte da uno diverso).
// Si ferma con il mouse o il dito sopra; si scorre con il dito, le frecce o
// i puntini. Con "riduci movimento" attivo non gira da sola.
export default function SuggestionCarousel({ items, day }: { items: ServiceItem[]; day: number }) {
  const t = useTranslations('hub')
  const start = items.length > 0 ? day % items.length : 0
  const slides = [...items.slice(start), ...items.slice(0, start)].slice(0, MAX_SLIDES)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const count = slides.length

  useEffect(() => {
    if (count < 2 || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [count, paused])

  if (count === 0) return null
  const go = (next: number) => setIndex((next + count) % count)

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('suggestionTitle')}
      className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(event) => {
        setPaused(true)
        touchX.current = event.touches[0].clientX
      }}
      onTouchEnd={(event) => {
        const startX = touchX.current
        touchX.current = null
        if (startX !== null) {
          const delta = event.changedTouches[0].clientX - startX
          if (Math.abs(delta) > 40) go(index + (delta < 0 ? 1 : -1))
        }
        setPaused(false)
      }}
    >
      <div className="flex transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((item, i) => {
          const Icon = marketplaceIconMap[item.iconName] || Smartphone
          return (
            <Link
              key={item.toolName}
              href={serviceHref(item)}
              aria-hidden={i !== index}
              tabIndex={i === index ? 0 : -1}
              className="group flex w-full shrink-0 items-center gap-4 p-4 sm:px-14"
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${GROUP_STYLE[item.group].tile}`}>
                <Icon className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('suggestionTitle')}</span>
                <span className="block truncate font-bold text-[var(--ink)]">{item.title}</span>
                <span className="line-clamp-3 block min-h-[3.75rem] text-sm sm:line-clamp-2 sm:min-h-10 text-[var(--ink)]/75">{item.description}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-bold text-white">
                {t('suggestionCta')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          )
        })}
      </div>

      {count > 1 && (
        <>
          {/* Frecce: solo sul computer (sul telefono si scorre con il dito) */}
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={t('carouselPrev')}
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[var(--ink)] shadow hover:bg-white sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={t('carouselNext')}
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[var(--ink)] shadow hover:bg-white sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="flex justify-center gap-1.5 pb-3">
            {slides.map((item, i) => (
              <button
                key={item.toolName}
                type="button"
                onClick={() => go(i)}
                aria-label={t('carouselGoTo', { name: item.title })}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-[var(--gold)]' : 'w-2 bg-[var(--ink)]/20 hover:bg-[var(--ink)]/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
