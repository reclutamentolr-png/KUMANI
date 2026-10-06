'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Camera,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { MENU_TEMPLATES, MENU_THEMES, type MenuTemplate } from '@/lib/menuThemes'
import { resizeImageFile } from '@/lib/resizeImage'
import {
  deleteMenu,
  deleteMenuCategory,
  deleteMenuItem,
  moveMenuEntry,
  saveMenuCategory,
  saveMenuItem,
  saveMenuSettings,
  setMenuItemFlag,
  translateMenuMissing,
  uploadMenuPhoto,
} from '@/app/actions/menu'
import {
  allergenNumber,
  formatMenuPrice,
  MENU_ALLERGENS,
  MENU_DIET_TAGS,
  MENU_LOCALE_NAMES,
  MENU_LOCALES,
  menuPhotoUrl,
  pickText,
  type LocalizedText,
  type MenuAllergen,
  type MenuCategory,
  type MenuData,
  type MenuDietTag,
  type MenuItem,
  type MenuLocale,
} from '@/lib/menu'
import BusinessProfileImport from '@/components/businessProfile/BusinessProfileImport'
import type { BusinessProfile } from '@/lib/businessProfile'

export type MenuInventoryProduct = { id: string; name: string; stock: number; unit: string }

type Result = { success: true; data: MenuData } | { success: false; message: string }

type ItemDraft = {
  id?: string
  categoryId: string
  name: string
  names: LocalizedText
  descriptions: LocalizedText
  price: string
  dietTags: MenuDietTag[]
  allergens: MenuAllergen[]
  photoPath: string | null
  available: boolean
  isDailySpecial: boolean
  translateName: boolean
  inventoryProductId: string | null
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'

export default function MenuBuilder({
  initial,
  siteUrl,
  locale,
  businessProfile = null,
  inventoryProducts = [],
}: {
  initial: MenuData
  siteUrl: string
  locale: string
  businessProfile?: BusinessProfile | null
  inventoryProducts?: MenuInventoryProduct[]
}) {
  const t = useTranslations('menuBuilder')
  const te = useTranslations('ecosystem')
  const productName = (id: string | null | undefined) => (id ? inventoryProducts.find((p) => p.id === id)?.name ?? null : null)
  const tp = useTranslations('menuPublic')
  const [data, setData] = useState<MenuData>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(!initial.menu)
  const [categoryDraft, setCategoryDraft] = useState<{ id?: string; names: LocalizedText } | null>(null)
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const menu = data.menu
  const lang = menu?.default_locale ?? 'it'
  const languages = menu?.languages ?? ['it']
  const publicUrl = menu ? `${siteUrl}/m/${menu.token}` : ''
  const menuBasePath = `/${locale}/marketplace/menu`

  // Primo avvio (menu non ancora creato): si parte dai dati della Scheda attività
  const fromProfile = !initial.menu && businessProfile ? businessProfile : null
  const [settings, setSettings] = useState({
    restaurantName: initial.menu?.restaurant_name ?? (fromProfile?.companyName ?? '').slice(0, 80),
    tagline: initial.menu?.tagline ?? (fromProfile?.tagline ?? '').slice(0, 140),
    reviewUrl: initial.menu?.review_url ?? (fromProfile?.reviewUrl ?? '').slice(0, 500),
    template: (initial.menu?.template ?? 'elegante') as MenuTemplate,
    defaultLocale: (initial.menu?.default_locale ?? 'it') as MenuLocale,
    languages: (initial.menu?.languages ?? ['it']) as MenuLocale[],
    isActive: initial.menu?.is_active ?? true,
  })

  useEffect(() => {
    if (!publicUrl) return
    // qrcode caricato solo quando serve, fuori dal bundle iniziale
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(publicUrl, { width: 720, margin: 2 }))
      .then(setQr)
      .catch(() => setQr(null))
  }, [publicUrl])

  const run = async (action: () => Promise<Result>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      if (result.success) {
        setData(result.data)
        after?.()
      } else {
        setError(t(`error_${result.message}`))
      }
    } catch {
      setError(t('error_saveError'))
    } finally {
      setBusy(false)
    }
  }

  const saveSettings = () =>
    run(() => saveMenuSettings(settings), () => setShowSettings(false))

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Appunti non disponibili.
    }
  }

  const openItem = (categoryId: string, item?: MenuItem) =>
    setItemDraft(
      item
        ? {
            id: item.id,
            categoryId,
            name: item.name,
            names: item.names,
            descriptions: item.descriptions,
            price: item.price === null ? '' : String(item.price),
            dietTags: item.diet_tags,
            allergens: item.allergens,
            photoPath: item.photo_path,
            available: item.available,
            isDailySpecial: item.is_daily_special,
            translateName: Object.keys(item.names).length > 0,
            inventoryProductId: item.inventory_product_id ?? null,
          }
        : {
            categoryId,
            name: '',
            names: {},
            descriptions: {},
            price: '',
            dietTags: [],
            allergens: [],
            photoPath: null,
            available: true,
            isDailySpecial: false,
            translateName: false,
            inventoryProductId: null,
          }
    )

  const choosePhoto = async (file: File | undefined) => {
    if (!file || !itemDraft) return
    setUploadingPhoto(true)
    setError(null)
    try {
      const resized = await resizeImageFile(file)
      if (!resized) throw new Error('resize')
      const form = new FormData()
      form.append('file', resized)
      const result = await uploadMenuPhoto(form)
      if (!result.success) throw new Error(result.message)
      setItemDraft((draft) => (draft ? { ...draft, photoPath: result.path } : draft))
    } catch {
      setError(t('error_photoError'))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const translateWithAi = async () => {
    if (!confirm(t('aiConfirm'))) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await translateMenuMissing()
      if (result.success) {
        setData(result.data)
        setNotice(t('aiDone', { count: result.translated }))
      } else {
        setError(t(`error_${result.message}`))
      }
    } catch {
      setError(t('error_aiError'))
    } finally {
      setBusy(false)
    }
  }

  const saveItem = () => {
    if (!itemDraft) return
    const price = itemDraft.price.trim() === '' ? null : Number(itemDraft.price.replace(',', '.'))
    run(
      () =>
        saveMenuItem({
          id: itemDraft.id,
          categoryId: itemDraft.categoryId,
          name: itemDraft.name,
          names: itemDraft.translateName ? itemDraft.names : {},
          descriptions: itemDraft.descriptions,
          price: price !== null && Number.isNaN(price) ? null : price,
          dietTags: itemDraft.dietTags,
          allergens: itemDraft.allergens,
          photoPath: itemDraft.photoPath,
          available: itemDraft.available,
          isDailySpecial: itemDraft.isDailySpecial,
          inventoryProductId: itemDraft.inventoryProductId,
        }),
      () => setItemDraft(null)
    )
  }

  // «Usa i dati della Scheda attività»: solo i campi che la Scheda ha
  const importBusinessProfile = (p: BusinessProfile) =>
    setSettings((s) => ({
      ...s,
      restaurantName: p.companyName ? p.companyName.slice(0, 80) : s.restaurantName,
      tagline: p.tagline ? p.tagline.slice(0, 140) : s.tagline,
      reviewUrl: p.reviewUrl ? p.reviewUrl.slice(0, 500) : s.reviewUrl,
    }))

  // Impostazioni (anche primo avvio)
  const settingsForm = (
    <div className="space-y-4">
      <BusinessProfileImport profile={businessProfile} onImport={importBusinessProfile} />
      <div>
        <label className="mb-1 block text-sm font-semibold text-gray-700">{t('restaurantName')}</label>
        <input className={inputClass} value={settings.restaurantName} maxLength={80} onChange={(e) => setSettings({ ...settings, restaurantName: e.target.value })} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-gray-700">{t('tagline')}</label>
        <input
          className={inputClass}
          value={settings.tagline}
          maxLength={140}
          placeholder={t('taglinePlaceholder')}
          onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-700">{t('template')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MENU_TEMPLATES.map((template) => {
            const [bg, accent] = MENU_THEMES[template].swatch
            const on = settings.template === template
            return (
              <button
                key={template}
                type="button"
                onClick={() => setSettings({ ...settings, template })}
                className={`rounded-xl border-2 p-2 text-left ${on ? 'border-[var(--gold)]' : 'border-gray-200'}`}
              >
                <span className="flex h-10 items-center justify-center rounded-lg border border-gray-200" style={{ background: bg }}>
                  <span className="h-2 w-10 rounded-full" style={{ background: accent }} />
                </span>
                <span className="mt-1.5 block text-xs font-bold text-gray-800">{t(`template_${template}`)}</span>
                <span className="block text-[10px] leading-4 text-gray-500">{t(`template_${template}_hint`)}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-gray-700">{t('reviewUrl')}</label>
        <input
          className={inputClass}
          value={settings.reviewUrl}
          maxLength={500}
          inputMode="url"
          placeholder="https://g.page/r/..."
          onChange={(e) => setSettings({ ...settings, reviewUrl: e.target.value })}
        />
        <p className="mt-1 text-xs text-gray-500">{t('reviewUrlHint')}</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-gray-700">{t('defaultLanguage')}</label>
        <select
          className={inputClass}
          value={settings.defaultLocale}
          onChange={(e) => setSettings({ ...settings, defaultLocale: e.target.value as MenuLocale })}
        >
          {MENU_LOCALES.map((l) => (
            <option key={l} value={l}>
              {MENU_LOCALE_NAMES[l]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold text-gray-700">{t('languages')}</p>
        <p className="mb-2 text-xs text-gray-500">{t('languagesHint')}</p>
        <div className="flex flex-wrap gap-2">
          {MENU_LOCALES.map((l) => {
            const on = l === settings.defaultLocale || settings.languages.includes(l)
            return (
              <button
                key={l}
                type="button"
                disabled={l === settings.defaultLocale}
                onClick={() =>
                  setSettings({ ...settings, languages: on ? settings.languages.filter((x) => x !== l) : [...settings.languages, l] })
                }
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                  on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-300 bg-white text-gray-600'
                }`}
              >
                {MENU_LOCALE_NAMES[l]}
              </button>
            )
          })}
        </div>
      </div>
      {menu && (
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" checked={settings.isActive} onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })} className="h-4 w-4 accent-[var(--gold)]" />
          {t('menuOnline')}
        </label>
      )}
      <button
        type="button"
        onClick={saveSettings}
        disabled={busy || !settings.restaurantName.trim()}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-white disabled:opacity-50"
      >
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {menu ? t('saveSettings') : t('createMenu')}
      </button>
      {menu && (
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              confirm(t('deleteMenuConfirm')) &&
              run(deleteMenu, () => {
                setShowSettings(true)
                setSettings((current) => ({ ...current, isActive: true }))
              })
            }
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> {t('deleteMenu')}
          </button>
          <p className="mt-1.5 text-xs text-gray-500">{t('deleteMenuHint')}</p>
        </div>
      )}
    </div>
  )

  const errorBox = error && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{error}</p>

  if (!menu) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[var(--ink)]">{t('setupTitle')}</h2>
        <p className="text-sm text-gray-600">{t('setupBody')}</p>
        {errorBox}
        {settingsForm}
      </div>
    )
  }

  const itemsOf = (category: MenuCategory) => data.items.filter((item) => item.category_id === category.id)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Link pubblico e QR */}
      <div className="grid gap-5 rounded-2xl border border-[var(--gold)]/30 bg-[var(--ink)] p-5 text-white sm:grid-cols-[1fr_auto] sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('yourMenuOnline')}</p>
          <h2 className="mt-1 truncate text-2xl font-bold">{menu.restaurant_name}</h2>
          <p className={`mt-1 text-sm font-semibold ${menu.is_active ? 'text-emerald-300' : 'text-amber-300'}`}>
            {menu.is_active ? t('statusOnline') : t('statusOffline')}
          </p>
          <p className="mt-3 truncate font-mono text-xs text-white/60">{publicUrl}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-3 py-2 text-sm font-bold text-[var(--ink)]"
            >
              <ExternalLink className="h-4 w-4" /> {t('openMenu')}
            </a>
            <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t('copied') : t('copyLink')}
            </button>
            {qr && (
              <a href={qr} download={`menu-qr-${menu.token}.png`} className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold">
                <Download className="h-4 w-4" /> {t('downloadQr')}
              </a>
            )}
            <a
              href={`${menuBasePath}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold"
            >
              <Printer className="h-4 w-4" /> {t('printMenu')}
            </a>
            <a
              href={`${menuBasePath}/tent`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold"
            >
              <Printer className="h-4 w-4" /> {t('printTent')}
            </a>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold"
            >
              <Settings2 className="h-4 w-4" /> {t('settings')}
            </button>
          </div>
        </div>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR" className="mx-auto h-36 w-36 rounded-xl bg-white p-2 sm:h-40 sm:w-40" />
        )}
      </div>

      {showSettings && <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-6 shadow-sm">{settingsForm}</div>}

      {errorBox}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}

      {languages.length > 1 && data.categories.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
              <Sparkles className="h-4 w-4 text-[var(--gold)]" /> {t('aiTitle')}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">{t('aiBody')}</p>
          </div>
          <button
            type="button"
            onClick={translateWithAi}
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[var(--gold-bright)]" />} {t('aiButton')}
          </button>
        </div>
      )}

      {/* Categorie e piatti */}
      {data.categories.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500">{t('noCategories')}</p>}

      {data.categories.map((category, ci) => (
        <div key={category.id} className="overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-[var(--gold-pale)]/50 px-4 py-3">
            <h3 className="truncate text-lg font-bold text-[var(--ink)]">{pickText(category.names, lang, lang)}</h3>
            <div className="flex shrink-0 items-center gap-1 text-gray-500">
              <IconButton label={t('moveUp')} disabled={busy || ci === 0} onClick={() => run(() => moveMenuEntry('category', category.id, -1))}>
                <ArrowUp className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={t('moveDown')}
                disabled={busy || ci === data.categories.length - 1}
                onClick={() => run(() => moveMenuEntry('category', category.id, 1))}
              >
                <ArrowDown className="h-4 w-4" />
              </IconButton>
              <IconButton label={t('edit')} disabled={busy} onClick={() => setCategoryDraft({ id: category.id, names: category.names })}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={t('delete')}
                disabled={busy}
                danger
                onClick={() => confirm(t('deleteCategoryConfirm')) && run(() => deleteMenuCategory(category.id))}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          <ul className="divide-y divide-gray-100">
            {itemsOf(category).map((item, ii, list) => (
              <li key={item.id} className={`px-4 py-3 ${item.available ? '' : 'bg-gray-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  {item.photo_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={menuPhotoUrl(item.photo_path) ?? ''} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${item.available ? 'text-[var(--ink)]' : 'text-gray-400 line-through'}`}>
                      {item.is_daily_special && <Star className="mr-1 inline h-4 w-4 fill-[var(--gold)] text-[var(--gold)]" />}
                      {item.name}
                    </p>
                    {pickText(item.descriptions, lang, lang) && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{pickText(item.descriptions, lang, lang)}</p>}
                    {item.allergens.length > 0 && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        {tp('allergensLabel')}: {item.allergens.map((a) => tp(`allergen_${a}`)).join(', ')}
                      </p>
                    )}
                    {productName(item.inventory_product_id) && (
                      <p className="mt-1">
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                          {te('menuInventoryLinked', { name: productName(item.inventory_product_id) ?? '' })}
                        </span>
                      </p>
                    )}
                    {item.diet_tags.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {item.diet_tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                            {tp(`tag_${tag}`)}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-bold text-[var(--ink)]">{formatMenuPrice(item.price, lang)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => setMenuItemFlag(item.id, 'available', !item.available))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${item.available ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}
                  >
                    {item.available ? t('available') : t('soldOut')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => setMenuItemFlag(item.id, 'is_daily_special', !item.is_daily_special))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.is_daily_special ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {t('dailySpecial')}
                  </button>
                  <span className="ml-auto flex items-center gap-1 text-gray-500">
                    <IconButton label={t('moveUp')} disabled={busy || ii === 0} onClick={() => run(() => moveMenuEntry('item', item.id, -1))}>
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t('moveDown')} disabled={busy || ii === list.length - 1} onClick={() => run(() => moveMenuEntry('item', item.id, 1))}>
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t('edit')} disabled={busy} onClick={() => openItem(category.id, item)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t('delete')} disabled={busy} danger onClick={() => confirm(t('deleteItemConfirm')) && run(() => deleteMenuItem(item.id))}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => openItem(category.id)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-gray-100 px-4 py-3 text-sm font-semibold text-[var(--gold)] hover:bg-[var(--gold-pale)]/40"
          >
            <Plus className="h-4 w-4" /> {t('addItem')}
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setCategoryDraft({ names: {} })}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--gold)]/50 bg-white/60 px-4 py-4 font-bold text-[var(--ink)] hover:border-[var(--gold)]"
      >
        <Plus className="h-5 w-5" /> {t('addCategory')}
      </button>

      {/* Modale categoria */}
      {categoryDraft && (
        <Modal title={categoryDraft.id ? t('editCategory') : t('addCategory')} onClose={() => setCategoryDraft(null)}>
          <p className="mb-3 text-xs text-gray-500">{t('categoryHint')}</p>
          <div className="space-y-3">
            {orderedLanguages(languages, lang).map((l) => (
              <div key={l}>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  {MENU_LOCALE_NAMES[l]} {l === lang && '*'}
                </label>
                <input
                  className={inputClass}
                  maxLength={60}
                  value={categoryDraft.names[l] ?? ''}
                  onChange={(e) => setCategoryDraft({ ...categoryDraft, names: { ...categoryDraft.names, [l]: e.target.value } })}
                />
              </div>
            ))}
          </div>
          {errorBox}
          <ModalActions
            busy={busy}
            disabled={!categoryDraft.names[lang]?.trim()}
            saveLabel={t('save')}
            cancelLabel={t('cancel')}
            onCancel={() => setCategoryDraft(null)}
            onSave={() => run(() => saveMenuCategory(categoryDraft), () => setCategoryDraft(null))}
          />
        </Modal>
      )}

      {/* Modale piatto */}
      {itemDraft && (
        <Modal title={itemDraft.id ? t('editItem') : t('addItem')} onClose={() => setItemDraft(null)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">{t('itemName')} *</label>
              <input className={inputClass} maxLength={120} value={itemDraft.name} onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })} />
              <p className="mt-1 text-xs text-gray-500">{t('itemNameHint')}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">{t('price')}</label>
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="12,50"
                value={itemDraft.price}
                onChange={(e) => setItemDraft({ ...itemDraft, price: e.target.value })}
              />
            </div>
            {/* Collegamento al Magazzino: giacenza zero = piatto esaurito */}
            {inventoryProducts.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{te('menuInventoryLabel')}</label>
                <select
                  className={inputClass}
                  value={itemDraft.inventoryProductId ?? ''}
                  onChange={(e) => setItemDraft({ ...itemDraft, inventoryProductId: e.target.value || null })}
                >
                  <option value="">{te('menuInventoryNone')}</option>
                  {inventoryProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.stock.toLocaleString(locale)}
                      {p.unit ? ` ${p.unit}` : ''})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">{te('menuInventoryHint')}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">{t('photo')}</p>
              <div className="flex items-center gap-3">
                {itemDraft.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={menuPhotoUrl(itemDraft.photoPath) ?? ''} alt="" className="h-20 w-20 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-gray-400">
                    <Camera className="h-6 w-6" />
                  </span>
                )}
                <div className="flex flex-col items-start gap-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    {uploadingPhoto ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    {itemDraft.photoPath ? t('changePhoto') : t('addPhoto')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPhoto}
                      onChange={(e) => {
                        choosePhoto(e.target.files?.[0])
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {itemDraft.photoPath && (
                    <button type="button" onClick={() => setItemDraft({ ...itemDraft, photoPath: null })} className="text-xs font-semibold text-red-500">
                      {t('removePhoto')}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">{t('descriptions')}</p>
              <div className="space-y-2">
                {orderedLanguages(languages, lang).map((l) => (
                  <div key={l}>
                    <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">{MENU_LOCALE_NAMES[l]}</label>
                    <textarea
                      className={inputClass}
                      rows={2}
                      maxLength={400}
                      value={itemDraft.descriptions[l] ?? ''}
                      onChange={(e) => setItemDraft({ ...itemDraft, descriptions: { ...itemDraft.descriptions, [l]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </div>
            {languages.length > 1 && (
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--gold)]"
                    checked={itemDraft.translateName}
                    onChange={(e) => setItemDraft({ ...itemDraft, translateName: e.target.checked })}
                  />
                  {t('translateName')}
                </label>
                {itemDraft.translateName && (
                  <div className="mt-2 space-y-2">
                    {languages
                      .filter((l) => l !== lang)
                      .map((l) => (
                        <div key={l}>
                          <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">{MENU_LOCALE_NAMES[l]}</label>
                          <input
                            className={inputClass}
                            maxLength={120}
                            value={itemDraft.names[l] ?? ''}
                            onChange={(e) => setItemDraft({ ...itemDraft, names: { ...itemDraft.names, [l]: e.target.value } })}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-600">{t('tags')}</p>
              <div className="flex flex-wrap gap-2">
                {MENU_DIET_TAGS.map((tag) => {
                  const on = itemDraft.dietTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setItemDraft({ ...itemDraft, dietTags: on ? itemDraft.dietTags.filter((x) => x !== tag) : [...itemDraft.dietTags, tag] })
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-300 text-gray-600'
                      }`}
                    >
                      {tp(`tag_${tag}`)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">{t('allergens')}</p>
              <p className="mb-2 text-xs text-gray-500">{t('allergensHint')}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {MENU_ALLERGENS.map((allergen) => {
                  const on = itemDraft.allergens.includes(allergen)
                  return (
                    <label
                      key={allergen}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                        on ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-amber-500"
                        checked={on}
                        onChange={() =>
                          setItemDraft({
                            ...itemDraft,
                            allergens: on ? itemDraft.allergens.filter((x) => x !== allergen) : [...itemDraft.allergens, allergen],
                          })
                        }
                      />
                      {allergenNumber(allergen)}. {tp(`allergen_${allergen}`)}
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--gold)]"
                  checked={itemDraft.available}
                  onChange={(e) => setItemDraft({ ...itemDraft, available: e.target.checked })}
                />
                {t('available')}
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--gold)]"
                  checked={itemDraft.isDailySpecial}
                  onChange={(e) => setItemDraft({ ...itemDraft, isDailySpecial: e.target.checked })}
                />
                {t('dailySpecial')}
              </label>
            </div>
          </div>
          {errorBox}
          <ModalActions
            busy={busy}
            disabled={!itemDraft.name.trim()}
            saveLabel={t('save')}
            cancelLabel={t('cancel')}
            onCancel={() => setItemDraft(null)}
            onSave={saveItem}
          />
        </Modal>
      )}
    </div>
  )
}

// Lingua principale per prima, poi le altre attive.
function orderedLanguages(languages: MenuLocale[], main: MenuLocale): MenuLocale[] {
  return [main, ...languages.filter((l) => l !== main)]
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 disabled:opacity-30 ${danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-gray-100 hover:text-[var(--ink)]'}`}
    >
      {children}
    </button>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--ink)]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({
  busy,
  disabled,
  saveLabel,
  cancelLabel,
  onCancel,
  onSave,
}: {
  busy: boolean
  disabled: boolean
  saveLabel: string
  cancelLabel: string
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={busy || disabled}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {saveLabel}
      </button>
    </div>
  )
}
