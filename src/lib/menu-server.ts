import type { SupabaseClient } from '@supabase/supabase-js'
import { isMenuTemplate } from '@/lib/menuThemes'
import { isMenuLocale, MENU_ALLERGENS, MENU_DIET_TAGS, type MenuAllergen, type MenuData, type MenuDietTag, type MenuLocale } from '@/lib/menu'

// Menù completo dell'utente (letto con il suo client: RLS = solo i propri dati).
export async function loadMenuData(supabase: SupabaseClient, userId: string): Promise<MenuData> {
  const { data: menu } = await supabase
    .from('menus')
    .select('id, restaurant_name, tagline, review_url, template, token, default_locale, languages, is_active')
    .eq('owner_id', userId)
    .maybeSingle()
  if (!menu) return { menu: null, categories: [], items: [] }

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('menu_categories').select('id, position, names').eq('menu_id', menu.id).order('position').order('created_at'),
    supabase
      .from('menu_items')
      .select('id, category_id, position, name, names, descriptions, price, diet_tags, allergens, photo_path, available, is_daily_special, inventory_product_id')
      .eq('menu_id', menu.id)
      .order('position')
      .order('created_at'),
  ])

  const languages = ((menu.languages as string[]) ?? []).filter(isMenuLocale) as MenuLocale[]
  return {
    menu: {
      ...menu,
      default_locale: isMenuLocale(menu.default_locale) ? menu.default_locale : 'it',
      template: isMenuTemplate(menu.template) ? menu.template : 'elegante',
      languages: languages.length ? languages : ['it'],
    },
    categories: categories ?? [],
    items: (items ?? []).map((item) => ({
      ...item,
      price: item.price === null ? null : Number(item.price),
      diet_tags: ((item.diet_tags as string[]) ?? []).filter((tag): tag is MenuDietTag => (MENU_DIET_TAGS as readonly string[]).includes(tag)),
      allergens: ((item.allergens as string[]) ?? []).filter((a): a is MenuAllergen => (MENU_ALLERGENS as readonly string[]).includes(a)),
    })),
  }
}
