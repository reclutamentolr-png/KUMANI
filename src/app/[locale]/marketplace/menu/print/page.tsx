import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import PrintButton from '@/components/admin/PrintButton'
import { createClient } from '@/lib/supabase/server'
import { loadMenuData } from '@/lib/menu-server'
import { allergenNumber, formatMenuPrice, isMenuLocale, MENU_ALLERGENS, MENU_LOCALE_NAMES, pickText, type MenuLocale } from '@/lib/menu'

// Menù stampabile / PDF: pagina A4 pulita, stampata dal browser ("Salva come
// PDF"). Il browser usa i suoi font, quindi anche il cirillico esce perfetto.
export default async function MenuPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ lang?: string }>
}) {
  const { locale } = await params
  const { lang: langParam } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { menu, categories, items } = await loadMenuData(supabase, user.id)
  if (!menu) redirect(`/${locale}/marketplace/menu`)

  const fallback = menu.default_locale
  const lang: MenuLocale = isMenuLocale(langParam) && menu.languages.includes(langParam) ? langParam : fallback
  const tb = await getTranslations('menuBuilder')
  const t = await getTranslations({ locale: lang, namespace: 'menuPublic' })

  const sections = categories
    .map((category) => ({ category, items: items.filter((item) => item.category_id === category.id && item.available) }))
    .filter((section) => section.items.length > 0)
  const usedAllergens = MENU_ALLERGENS.filter((a) => items.some((item) => item.allergens.includes(a)))

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-4 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white px-4 py-4 shadow-sm print:hidden">
        <Link href="/marketplace/menu" className="text-sm font-semibold text-[var(--ink)] transition-colors hover:text-[var(--gold)]">
          ← {tb('backToBuilder')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {menu.languages.map((l) => (
            <a
              key={l}
              href={`?lang=${l}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${l === lang ? 'bg-[var(--ink)] text-white' : 'border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]'}`}
            >
              {MENU_LOCALE_NAMES[l]}
            </a>
          ))}
          <PrintButton label={tb('print')} />
        </div>
        <p className="w-full text-xs text-[var(--muted)]">{tb('printPdfHint')}</p>
      </div>

      <article lang={lang} className="mx-auto max-w-[210mm] bg-white px-[16mm] py-[14mm] font-serif text-gray-900 shadow print:shadow-none">
        <header className="mb-8 border-b-2 border-gray-900 pb-5 text-center">
          <h1 className="text-4xl font-bold">{menu.restaurant_name}</h1>
          {menu.tagline && <p className="mt-2 italic text-gray-600">{menu.tagline}</p>}
        </header>

        {sections.map(({ category, items: sectionItems }) => (
          <section key={category.id} className="mb-7 break-inside-avoid-page">
            <h2 className="mb-3 text-center text-xl font-bold uppercase tracking-[0.15em]">{pickText(category.names, lang, fallback)}</h2>
            <ul className="space-y-3">
              {sectionItems.map((item) => {
                const name = item.names[lang]?.trim() || item.name
                const description = pickText(item.descriptions, lang, fallback)
                return (
                  <li key={item.id} className="break-inside-avoid">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">
                        {name}
                        {item.allergens.length > 0 && (
                          <sup className="ml-1 font-sans text-[9px] font-normal text-gray-500">{item.allergens.map((a) => allergenNumber(a)).join(',')}</sup>
                        )}
                      </span>
                      <span className="flex-1 border-b border-dotted border-gray-400" />
                      <span className="font-semibold">{formatMenuPrice(item.price, lang)}</span>
                    </div>
                    {name !== item.name && <p className="text-xs italic text-gray-500">{item.name}</p>}
                    {description && <p className="text-sm leading-5 text-gray-600">{description}</p>}
                    {item.diet_tags.length > 0 && (
                      <p className="font-sans text-[10px] uppercase tracking-wider text-gray-500">{item.diet_tags.map((tag) => t(`tag_${tag}`)).join(' · ')}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        <footer className="mt-10 break-inside-avoid border-t border-gray-300 pt-4 font-sans text-[10px] leading-4 text-gray-600">
          {usedAllergens.length > 0 && (
            <>
              <p className="mb-1 font-semibold uppercase tracking-wider">{t('legendTitle')}</p>
              <p>{MENU_ALLERGENS.map((a) => `${allergenNumber(a)}. ${t(`allergen_${a}`)}`).join(' · ')}</p>
            </>
          )}
          <p className="mt-2">{t('allergenNotice')}</p>
        </footer>
      </article>
    </div>
  )
}
