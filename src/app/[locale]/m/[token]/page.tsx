import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { Globe, MessageSquareHeart, Stamp } from 'lucide-react'
import PublicMenuView, { type PublicCategory, type PublicMenuLabels } from '@/components/menu/PublicMenuView'
import { createClient } from '@/lib/supabase/server'
import { isMenuTemplate, MENU_THEMES, menuThemeStyle } from '@/lib/menuThemes'
import { detectMenuLocale, isMenuLocale, MENU_ALLERGENS, MENU_DIET_TAGS, MENU_LOCALE_NAMES, type MenuLocale } from '@/lib/menu'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

type PublicMenu = {
  restaurant_name: string
  tagline: string | null
  template?: string
  currency: string
  default_locale: string
  languages: string[]
  review_url?: string | null
  fidelity?: { prize: string; stamps_needed: number } | null
  categories: PublicCategory[]
}

async function loadMenu(token: string): Promise<PublicMenu | null> {
  if (!/^[a-z0-9]{6,16}$/i.test(token)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_public_menu', { p_token: token })
  const menu = (data as PublicMenu | null) ?? null
  if (!menu) return null
  // Compatibilità: prima della Fase 2 i piatti non avevano "allergens".
  menu.categories = menu.categories.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, allergens: i.allergens ?? [] })) }))
  return menu
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const menu = await loadMenu(token)
  return { title: menu ? `${menu.restaurant_name} · Menu` : 'Menu' }
}

// Menù pubblico del QR al tavolo (/m/<token>): lingua scelta dal cliente
// (?lang=) o presa dal telefono, tra quelle attivate dal ristoratore.
export default async function PublicMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ lang?: string }>
}) {
  const { token } = await params
  const { lang: langParam } = await searchParams
  const menu = await loadMenu(token)

  if (!menu) {
    const t = await getTranslations({ locale: 'it', namespace: 'menuPublic' })
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ink)] px-6 text-center text-white">
        <p className="max-w-sm text-white/80">{t('notAvailable')}</p>
      </div>
    )
  }

  const fallback: MenuLocale = isMenuLocale(menu.default_locale) ? menu.default_locale : 'it'
  const available = (menu.languages ?? []).filter(isMenuLocale) as MenuLocale[]
  if (!available.includes(fallback)) available.unshift(fallback)
  const lang: MenuLocale =
    isMenuLocale(langParam) && available.includes(langParam)
      ? langParam
      : detectMenuLocale((await headers()).get('accept-language'), available, fallback)

  const t = await getTranslations({ locale: lang, namespace: 'menuPublic' })
  const template = isMenuTemplate(menu.template) ? menu.template : 'elegante'
  const theme = MENU_THEMES[template]
  const labels: PublicMenuLabels = {
    dailySpecial: t('dailySpecial'),
    soldOut: t('soldOut'),
    empty: t('empty'),
    allergensLabel: t('allergensLabel'),
    legendTitle: t('legendTitle'),
    filterTitle: t('filterTitle'),
    filterDiet: t('filterDiet'),
    filterExclude: t('filterExclude'),
    clearFilters: t('clearFilters'),
    noResults: t('noResults'),
    filterDisclaimer: t('filterDisclaimer'),
    tags: Object.fromEntries(MENU_DIET_TAGS.map((tag) => [tag, t(`tag_${tag}`)])),
    allergens: Object.fromEntries(MENU_ALLERGENS.map((a) => [a, t(`allergen_${a}`)])),
  }

  return (
    <div lang={lang} style={menuThemeStyle(template)} className={`min-h-screen bg-[var(--m-bg)] text-[var(--m-text)] ${theme.bodyFont}`}>
      <header className="border-b border-[var(--m-line)]/30 px-5 pb-8 pt-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--m-accent)]">Menu</p>
        <h1 className={`mt-3 ${theme.headingFont} text-4xl font-bold leading-tight sm:text-5xl`}>{menu.restaurant_name}</h1>
        {menu.tagline && <p className={`mx-auto mt-3 max-w-md ${theme.headingFont} italic text-[var(--m-text)]/70`}>{menu.tagline}</p>}

        {available.length > 1 && (
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label={t('language')}>
            <Globe className="mr-1 h-4 w-4 text-[var(--m-accent)]" />
            {available.map((l) => (
              <a
                key={l}
                href={`?lang=${l}`}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  l === lang ? 'bg-[var(--m-accent)] text-[var(--m-accent-ink)]' : 'border border-[var(--m-line)]/40 text-[var(--m-text)]/80'
                }`}
              >
                {MENU_LOCALE_NAMES[l]}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        <PublicMenuView
          categories={menu.categories}
          lang={lang}
          fallback={fallback}
          currency={menu.currency}
          labels={labels}
          headingFont={theme.headingFont}
        />

        {(menu.review_url || menu.fidelity) && (
          <section className="mt-10 space-y-3">
            {menu.review_url && (
              <a
                href={menu.review_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--m-accent)] px-5 py-3.5 font-bold text-[var(--m-accent-ink)]"
              >
                <MessageSquareHeart className="h-5 w-5" /> {t('reviewCta')}
              </a>
            )}
            {menu.fidelity && (
              <p className="flex items-center justify-center gap-2 rounded-xl border border-[var(--m-line)]/40 px-5 py-3 text-center text-sm text-[var(--m-text)]/85">
                <Stamp className="h-5 w-5 shrink-0 text-[var(--m-accent)]" />
                {t('fidelityCta', { prize: menu.fidelity.prize, stamps: menu.fidelity.stamps_needed })}
              </p>
            )}
          </section>
        )}
      </main>

      <footer className="border-t border-[var(--m-line)]/20 px-5 py-6 text-center text-xs text-[var(--m-text)]/45">
        {t('allergenNotice')}
        <p className="mt-3 tracking-[0.25em] text-[var(--m-accent)]/70">KUMANI MENU</p>
      </footer>
    </div>
  )
}
