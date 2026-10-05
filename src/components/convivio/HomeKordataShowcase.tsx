import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, BadgeCheck, CalendarClock, HandPlatter, Laptop, MapPin, Package, Plane, Users, UtensilsCrossed, Zap, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { ProgressBar } from '@/components/convivio/ConvivioCardItem'
import { convivioPhotoUrl, formatEuro, savingPercent } from '@/lib/convivio'
import { getKordataShowcase } from '@/lib/kordataShowcase'

// Senza foto: illustrazione della categoria
const CATEGORY_ART: Record<string, { Icon: LucideIcon; bg: string }> = {
  food: { Icon: UtensilsCrossed, bg: 'from-[#3a2a12] via-[#1f1a10] to-[#0c0d0c]' },
  tech: { Icon: Laptop, bg: 'from-[#14263a] via-[#111a24] to-[#0c0d0c]' },
  travel: { Icon: Plane, bg: 'from-[#123a33] via-[#10201d] to-[#0c0d0c]' },
  energy: { Icon: Zap, bg: 'from-[#3a3512] via-[#201e10] to-[#0c0d0c]' },
  other: { Icon: Package, bg: 'from-[#2c2620] via-[#1a1714] to-[#0c0d0c]' },
}

// Fascia "Kordata in corso" della homepage: fino a 3 acquisti di gruppo
// proposti da capocordata o fornitore e approvati dallo Staff, ancora aperti
// e sotto il minimo. Nessun dato dei partecipanti, solo quanti sono.
export default async function HomeKordataShowcase() {
  const cards = await getKordataShowcase()
  if (!cards.length) return null
  const t = await getTranslations('kordataShowcase')
  const tc = await getTranslations('convivio')
  const locale = await getLocale()
  const dateFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' })

  return (
    <section className="py-10 sm:py-14 border-t border-[var(--gold)]/10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
              <HandPlatter className="w-4 h-4" />
              {t('eyebrow')}
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white">{t('title')}</h2>
            <p className="mt-1 max-w-2xl text-sm sm:text-base text-gray-400">{t('subtitle')}</p>
          </div>
          <Link href="/marketplace/convivio" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold-bright)] hover:text-white transition-colors">
            {t('seeAll')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const saving = savingPercent(card)
            const photo = convivioPhotoUrl(card.photo_path)
            const art = CATEGORY_ART[card.category] ?? CATEGORY_ART.other
            const missing = Math.max(0, card.min_participants - card.people)
            return (
              <Link
                key={card.id}
                href={`/convivio/${card.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-white/[0.03] transition-colors hover:border-[var(--gold)]/60 hover:bg-white/[0.06]"
              >
                <div className={`relative aspect-[2/1] overflow-hidden bg-gradient-to-br sm:aspect-[16/10] ${art.bg}`}>
                  {photo ? (
                    // Foto caricata dal capocordata o dal fornitore (già ridotta)
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <art.Icon aria-hidden className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-[var(--gold-bright)]/70" strokeWidth={1.4} />
                  )}
                  <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">{tc(`category_${card.category}`)}</span>
                  {saving ? <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white shadow">-{saving}%</span> : null}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base sm:text-lg font-bold leading-snug text-white line-clamp-2">{card.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--gold-bright)]" />
                    <span className="truncate">
                      {card.supplier_name} · {card.vat_valid ? t('vatVerified') : t('supplierKumani')}
                    </span>
                  </p>

                  <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-2xl font-bold text-[var(--gold-bright)]">{formatEuro(card.group_price, locale)}</span>
                    {card.unit_label && <span className="text-xs text-gray-400">/ {card.unit_label}</span>}
                    {card.retail_price && saving ? <span className="text-sm text-gray-500 line-through">{formatEuro(card.retail_price, locale)}</span> : null}
                  </div>
                  {card.retail_price && saving ? <p className="text-[11px] text-gray-500">{t('retailNote')}</p> : null}

                  <div className="mt-4">
                    <ProgressBar people={card.people} min={card.min_participants} max={card.max_participants} />
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {tc('peopleOfMin', { people: card.people, min: card.min_participants })}
                      </span>
                      <span className="font-semibold text-[var(--gold-pale)]">{t('missing', { count: missing })}</span>
                    </div>
                  </div>

                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" /> {t('closes', { date: dateFormat.format(new Date(card.expires_at)) })}
                    </span>
                    {card.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {card.city}
                      </span>
                    )}
                  </p>

                  <span className="mt-auto pt-4">
                    <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] transition-transform group-hover:scale-[1.01]">
                      {t('join')} <ArrowRight className="h-4 w-4" />
                    </span>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
        <p className="mt-4 text-xs leading-5 text-gray-500">{t('footnote')}</p>
      </div>
    </section>
  )
}
