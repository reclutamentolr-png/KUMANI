'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import CopyButton from '@/components/CopyButton'
import { createClient } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/resizeImage'
import { askConfirm } from '@/lib/confirm'
import SellerPaymentsGuide from '@/components/shop/SellerPaymentsGuide'
import type { SellerPaymentsDetail } from '@/app/actions/shop'
import { deleteShopProduct, saveShopProduct, saveShopSettings, updateShopOrder, type MyShop } from '@/app/actions/shopStore'
import { formatCents, shopPath, slugify, type OrderStatus, type ShopOrder, type ShopProduct, type ShopSettings } from '@/lib/shop'

// KUMANI Shop, pagina del venditore: il negozio (nome, indirizzo, consegna,
// condizioni, aperto/chiuso), i prodotti e gli ordini.

type Tab = 'shop' | 'products' | 'orders' | 'payments'
const input = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/25'
const label = 'mb-1 block text-sm font-semibold text-gray-700'
const toCents = (v: string) => Math.round(Number(v.replace(',', '.')) * 100)
const toEuro = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(2).replace(/\.00$/, ''))

async function uploadImage(userId: string, file: File): Promise<string | null> {
  const image = (await resizeImageFile(file, 1400, 0.82)) ?? file
  if (image.size > 5 * 1024 * 1024) return null
  const path = `${userId}/${crypto.randomUUID()}.${image.type === 'image/png' ? 'png' : 'jpg'}`
  const { error } = await createClient().storage.from('shop-media').upload(path, image, { contentType: image.type, upsert: false })
  return error ? null : path
}
const publicImage = (path: string | null) => (path ? createClient().storage.from('shop-media').getPublicUrl(path).data.publicUrl : null)

export default function ShopManager({ userId, initial, initialTab, payments }: { userId: string; initial: MyShop; initialTab: Tab; payments: SellerPaymentsDetail | null }) {
  const t = useTranslations('shop')
  const [tab, setTab] = useState<Tab>(initial.settings || initialTab === 'payments' ? initialTab : 'shop')
  const [settings, setSettings] = useState<ShopSettings | null>(initial.settings)
  const [products, setProducts] = useState<ShopProduct[]>(initial.products)
  const [orders, setOrders] = useState<ShopOrder[]>(initial.orders)
  const toDo = orders.filter((o) => o.status === 'paid').length

  return (
    <div className="space-y-5">
      {(!initial.profileReady || !initial.stripeReady) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4" /> {t('readyTitle')}
          </p>
          <ul className="mt-2 space-y-1">
            <li>{initial.profileReady ? '✓' : '•'} {t('readyProfile')}</li>
            <li>{initial.stripeReady ? '✓' : '•'} {t('readyStripe')}</li>
          </ul>
          {tab !== 'payments' && (
            <button type="button" onClick={() => setTab('payments')} className="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white">
              {t('readyCta')}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-1 rounded-2xl border border-[var(--gold)]/25 bg-white p-1 shadow-sm">
        {(['shop', 'products', 'orders', 'payments'] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            disabled={(k === 'products' || k === 'orders') && !settings}
            onClick={() => setTab(k)}
            className={`flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-sm font-bold sm:flex-row sm:gap-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${tab === k ? 'bg-[var(--ink)] text-white shadow' : 'text-gray-600 hover:text-[var(--ink)]'}`}
          >
            {k === 'shop' ? <Store className="h-4 w-4" /> : k === 'products' ? <Package className="h-4 w-4" /> : k === 'orders' ? <ShoppingBag className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            <span className="text-xs sm:text-sm">{t(`tab_${k}`)}</span>
            {k === 'orders' && toDo > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-xs text-white">{toDo}</span>}
          </button>
        ))}
      </div>

      {tab === 'shop' && <ShopForm userId={userId} settings={settings} canOpen={initial.profileReady && initial.stripeReady} hasProducts={products.some((p) => p.isActive)} onSaved={setSettings} />}
      {tab === 'products' && <Products userId={userId} products={products} setProducts={setProducts} inventory={initial.inventory} />}
      {tab === 'orders' && <Orders orders={orders} setOrders={setOrders} />}
      {tab === 'payments' && payments && <SellerPaymentsGuide detail={payments} />}
    </div>
  )
}

function ShopForm({ userId, settings, canOpen, hasProducts, onSaved }: { userId: string; settings: ShopSettings | null; canOpen: boolean; hasProducts: boolean; onSaved: (s: ShopSettings) => void }) {
  const t = useTranslations('shop')
  const locale = useLocale()
  const router = useRouter()
  const [form, setForm] = useState<ShopSettings>(
    settings ?? {
      slug: '',
      name: '',
      description: '',
      coverPath: null,
      isOpen: false,
      pickupEnabled: true,
      pickupInfo: '',
      shippingEnabled: false,
      shippingItCents: 690,
      shippingEuCents: null,
      freeShippingOverCents: null,
      returnsPolicy: t('policyTemplate'),
    }
  )
  const [slugTouched, setSlugTouched] = useState(!!settings)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const set = <K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) => setForm((f) => ({ ...f, [k]: v }))
  // Indirizzo pubblico (sempre sul dominio kumani.io, anche in prova); letto
  // dopo l'apertura della pagina, così server e browser mostrano lo stesso
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'indirizzo del sito esiste solo nel browser
    setOrigin(window.location.origin.replace(/localhost:\d+|127\.0\.0\.1:\d+/, 'kumani.io').replace('http://', 'https://'))
  }, [])
  const url = origin && form.slug ? `${origin}${shopPath(form.slug)}` : ''

  const save = async (patch?: Partial<ShopSettings>) => {
    const next = { ...form, ...patch }
    setBusy(true)
    setNotice(null)
    const r = await saveShopSettings(next)
    setBusy(false)
    if (!r.success) return setNotice({ ok: false, text: t(`error_${r.message}`) })
    setForm(r.data)
    onSaved(r.data)
    setNotice({ ok: true, text: t(patch?.isOpen === true ? 'openedOk' : patch?.isOpen === false ? 'closedOk' : 'saved') })
  }
  const pickCover = async (file?: File) => {
    if (!file) return
    setBusy(true)
    const path = await uploadImage(userId, file)
    setBusy(false)
    if (!path) return setNotice({ ok: false, text: t('error_upload') })
    set('coverPath', path)
  }

  return (
    <div className="space-y-5">
      {settings && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${settings.isOpen ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
          <div className="min-w-0">
            <p className="font-bold text-[var(--ink)]">{settings.isOpen ? t('statusOpen') : t('statusClosed')}</p>
            {url && <p className="truncate text-sm text-gray-600">{url}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {settings.isOpen && url && (
              <>
                <CopyButton text={url} variant="light" />
                <a href={shopPath(settings.slug)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold">
                  <ExternalLink className="h-4 w-4" /> {t('openShop')}
                </a>
              </>
            )}
            <button
              type="button"
              disabled={busy || (!settings.isOpen && (!canOpen || !hasProducts))}
              onClick={() => save({ isOpen: !settings.isOpen })}
              className={`min-h-10 cursor-pointer rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${settings.isOpen ? 'border border-gray-300 bg-white text-gray-700' : 'bg-emerald-600 text-white'}`}
            >
              {settings.isOpen ? t('closeShop') : t('openShopNow')}
            </button>
          </div>
          {!settings.isOpen && (!canOpen || !hasProducts) && <p className="w-full text-xs text-gray-600">{!canOpen ? t('openNeedsReady') : t('openNeedsProducts')}</p>}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--ink)]">{t('sectionShop')}</h2>
        <div>
          <label className={label}>{t('name')}</label>
          <input
            value={form.name}
            maxLength={80}
            placeholder={t('namePlaceholder')}
            onChange={(e) => {
              set('name', e.target.value)
              if (!slugTouched) set('slug', slugify(e.target.value))
            }}
            className={input}
          />
        </div>
        <div>
          <label className={label}>{t('slug')}</label>
          <div className="flex items-center rounded-xl border border-gray-300 bg-gray-50 pl-3 focus-within:border-[var(--gold)]">
            <span className="shrink-0 text-sm text-gray-500">kumani.io/shop/</span>
            <input
              value={form.slug}
              maxLength={40}
              onChange={(e) => {
                setSlugTouched(true)
                set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }}
              className="min-w-0 flex-1 rounded-r-xl bg-white px-2 py-2.5 text-[15px] outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">{t('slugHint')}</p>
        </div>
        <div>
          <label className={label}>{t('description')}</label>
          <textarea value={form.description} maxLength={600} rows={3} placeholder={t('descriptionPlaceholder')} onChange={(e) => set('description', e.target.value)} className={input} />
        </div>
        <div>
          <span className={label}>{t('cover')}</span>
          {form.coverPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicImage(form.coverPath) ?? ''} alt="" className="mb-2 max-h-40 w-full rounded-xl object-cover" />
          )}
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 text-sm font-semibold text-gray-600 hover:border-[var(--gold)]">
              <ImagePlus className="h-4 w-4" /> {t('coverUpload')}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickCover(e.target.files?.[0])} />
            </label>
            {form.coverPath && (
              <button type="button" onClick={() => set('coverPath', null)} className="min-h-11 cursor-pointer text-sm font-semibold text-red-600">
                {t('remove')}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--ink)]">{t('sectionDelivery')}</h2>
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={form.pickupEnabled} onChange={(e) => set('pickupEnabled', e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
          <span>
            <span className="font-semibold">{t('pickup')}</span>
            <span className="block text-sm text-gray-500">{t('pickupHint')}</span>
          </span>
        </label>
        {form.pickupEnabled && <textarea value={form.pickupInfo} maxLength={300} rows={2} placeholder={t('pickupInfoPlaceholder')} onChange={(e) => set('pickupInfo', e.target.value)} className={input} />}
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={form.shippingEnabled} onChange={(e) => set('shippingEnabled', e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--ink)]" />
          <span>
            <span className="font-semibold">{t('shipping')}</span>
            <span className="block text-sm text-gray-500">{t('shippingHint')}</span>
          </span>
        </label>
        {form.shippingEnabled && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-gray-600">
              {t('shippingIt')}
              <input inputMode="decimal" defaultValue={toEuro(form.shippingItCents)} onChange={(e) => set('shippingItCents', toCents(e.target.value || '0'))} className={`mt-1 ${input}`} />
            </label>
            <label className="text-sm text-gray-600">
              {t('shippingEu')}
              <input inputMode="decimal" defaultValue={toEuro(form.shippingEuCents)} placeholder={t('shippingEuNone')} onChange={(e) => set('shippingEuCents', e.target.value.trim() ? toCents(e.target.value) : null)} className={`mt-1 ${input}`} />
            </label>
            <label className="text-sm text-gray-600">
              {t('freeOver')}
              <input inputMode="decimal" defaultValue={toEuro(form.freeShippingOverCents)} placeholder={t('freeOverNone')} onChange={(e) => set('freeShippingOverCents', e.target.value.trim() ? toCents(e.target.value) : null)} className={`mt-1 ${input}`} />
            </label>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--ink)]">{t('sectionPolicy')}</h2>
        <p className="text-sm text-gray-600">{t('policyHint')}</p>
        <textarea value={form.returnsPolicy} maxLength={2000} rows={7} onChange={(e) => set('returnsPolicy', e.target.value)} className={input} />
      </section>

      {notice && <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{notice.text}</p>}
      <div className="flex gap-3">
        {/* Annulla: si torna alla pagina precedente senza salvare */}
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push(`/${locale === 'it' ? '' : `${locale}/`}dashboard`))}
          disabled={busy}
          className="min-h-12 cursor-pointer rounded-xl border border-gray-300 bg-white px-6 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {t('cancel')}
        </button>
        <button type="button" onClick={() => save()} disabled={busy} className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 font-bold text-[var(--ink)] shadow disabled:opacity-60">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('save')}
        </button>
      </div>
    </div>
  )
}

type Draft = { id?: string; name: string; description: string; price: string; imagePath: string | null; inventoryProductId: string | null; stock: string; isActive: boolean }

function Products({ userId, products, setProducts, inventory }: { userId: string; products: ShopProduct[]; setProducts: (fn: (p: ShopProduct[]) => ShopProduct[]) => void; inventory: MyShop['inventory'] }) {
  const t = useTranslations('shop')
  const locale = useLocale()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const linked = useMemo(() => new Set(products.map((p) => p.inventoryProductId).filter(Boolean)), [products])

  const edit = (p?: ShopProduct) => {
    setError(null)
    setDraft(
      p
        ? { id: p.id, name: p.name, description: p.description, price: toEuro(p.priceCents), imagePath: p.imagePath, inventoryProductId: p.inventoryProductId, stock: p.inventoryProductId || p.stock == null ? '' : String(p.stock), isActive: p.isActive }
        : { name: '', description: '', price: '', imagePath: null, inventoryProductId: null, stock: '', isActive: true }
    )
  }
  const save = async () => {
    if (!draft) return
    setBusy(true)
    setError(null)
    const r = await saveShopProduct({
      id: draft.id,
      name: draft.name,
      description: draft.description,
      priceCents: toCents(draft.price || '0'),
      imagePath: draft.imagePath,
      inventoryProductId: draft.inventoryProductId,
      stock: draft.inventoryProductId || !draft.stock.trim() ? null : Number(draft.stock),
      isActive: draft.isActive,
    })
    setBusy(false)
    if (!r.success) return setError(r.limitText ?? t(`error_${r.message}`))
    setProducts((list) => (draft.id ? list.map((p) => (p.id === r.data.id ? r.data : p)) : [...list, r.data]))
    setDraft(null)
  }
  const remove = async (p: ShopProduct) => {
    if (!(await askConfirm(t('deleteProductConfirm', { name: p.name }), { tone: 'danger' }))) return
    const r = await deleteShopProduct(p.id)
    if (r.success) setProducts((list) => list.filter((x) => x.id !== p.id))
  }
  const pickImage = async (file?: File) => {
    if (!file || !draft) return
    setBusy(true)
    const path = await uploadImage(userId, file)
    setBusy(false)
    if (!path) return setError(t('error_upload'))
    setDraft((d) => (d ? { ...d, imagePath: path } : d))
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => edit()} className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--gold)]/60 bg-white font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]/40">
        <Plus className="h-5 w-5" /> {t('addProduct')}
      </button>
      {!products.length && <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-gray-500">{t('noProducts')}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {products.map((p) => (
          <li key={p.id} className={`flex gap-3 rounded-2xl border bg-white p-3 shadow-sm ${p.isActive ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-70'}`}>
            {p.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicImage(p.imagePath) ?? ''} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-gray-50 object-cover" />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                <Package className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-[var(--ink)]">{p.name}</p>
              <p className="text-sm font-semibold text-[var(--ink)]">{formatCents(p.priceCents, locale)}</p>
              <p className={`text-xs ${p.stock === 0 ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                {p.stock == null ? t('stockUnlimited') : p.stock === 0 ? t('stockOut') : t('stockLeft', { n: p.stock })}
                {p.inventoryProductId ? ` · ${t('fromInventory')}` : ''}
                {!p.isActive ? ` · ${t('hidden')}` : ''}
              </p>
              <div className="mt-1 flex gap-1">
                <button type="button" onClick={() => edit(p)} aria-label={t('edit')} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => remove(p)} aria-label={t('delete')} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {draft && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => !busy && setDraft(null)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{draft.id ? t('editProduct') : t('addProduct')}</h3>
              <button type="button" onClick={() => setDraft(null)} aria-label={t('close')} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {inventory.length > 0 && (
              <div>
                <label className={label}>{t('fromInventoryLabel')}</label>
                <select
                  value={draft.inventoryProductId ?? ''}
                  onChange={(e) => {
                    const item = inventory.find((i) => i.id === e.target.value)
                    setDraft((d) => (d ? { ...d, inventoryProductId: item?.id ?? null, name: item && !d.name ? item.name : d.name, price: item && !d.price && item.salePriceCents ? toEuro(item.salePriceCents) : d.price } : d))
                  }}
                  className={input}
                >
                  <option value="">{t('fromInventoryNone')}</option>
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id} disabled={linked.has(i.id) && i.id !== draft.inventoryProductId}>
                      {i.name} · {t('stockLeft', { n: i.stock })}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">{t('fromInventoryHint')}</p>
              </div>
            )}
            <div>
              <label className={label}>{t('productName')}</label>
              <input value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>{t('productDescription')}</label>
              <textarea value={draft.description} maxLength={1500} rows={3} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{t('price')}</label>
                <input inputMode="decimal" value={draft.price} placeholder="0,00" onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={input} />
              </div>
              {!draft.inventoryProductId && (
                <div>
                  <label className={label}>{t('stock')}</label>
                  <input inputMode="numeric" value={draft.stock} placeholder={t('stockUnlimitedShort')} onChange={(e) => setDraft({ ...draft, stock: e.target.value.replace(/\D/g, '') })} className={input} />
                </div>
              )}
            </div>
            <div>
              <span className={label}>{t('photo')}</span>
              {draft.imagePath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={publicImage(draft.imagePath) ?? ''} alt="" className="mb-2 max-h-48 rounded-xl object-contain" />
              )}
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 text-sm font-semibold text-gray-600 hover:border-[var(--gold)]">
                <ImagePlus className="h-4 w-4" /> {draft.imagePath ? t('photoChange') : t('photoUpload')}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} />
              </label>
            </div>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="h-5 w-5 accent-[var(--ink)]" />
              <span className="font-semibold">{t('visible')}</span>
            </label>
            {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{error}</p>}
            <button type="button" onClick={save} disabled={busy} className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--ink)] font-bold text-white disabled:opacity-60">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('saveProduct')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  paid: 'bg-rose-100 text-rose-700',
  ready: 'bg-sky-100 text-sky-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

function Orders({ orders, setOrders }: { orders: ShopOrder[]; setOrders: (fn: (o: ShopOrder[]) => ShopOrder[]) => void }) {
  const t = useTranslations('shop')
  const locale = useLocale()
  const [openId, setOpenId] = useState<string | null>(null)
  const [tracking, setTracking] = useState({ number: '', url: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const date = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const change = async (o: ShopOrder, status: OrderStatus) => {
    if (status === 'cancelled' && !(await askConfirm(t('cancelConfirm', { amount: formatCents(o.totalCents, locale) }), { tone: 'danger', title: t('cancelTitle'), confirmLabel: t('cancelRefund') }))) return
    setBusy(true)
    setError(null)
    const r = await updateShopOrder(o.id, status, status === 'shipped' ? tracking : undefined)
    setBusy(false)
    if (!r.success) return setError(t(`error_${r.message}`))
    setOrders((list) => list.map((x) => (x.id === r.data.id ? r.data : x)))
  }

  if (!orders.length) return <p className="rounded-xl bg-white px-4 py-10 text-center text-sm text-gray-500">{t('noOrders')}</p>
  return (
    <ul className="space-y-3">
      {orders.map((o) => {
        const open = openId === o.id
        return (
          <li key={o.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => {
                setOpenId(open ? null : o.id)
                setTracking({ number: o.trackingNumber ?? '', url: o.trackingUrl ?? '' })
                setError(null)
              }}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-[var(--ink)]">
                  {t('orderNumber', { n: o.number ?? 0 })} · {o.customerName}
                </span>
                <span className="block text-xs text-gray-500">
                  {date(o.paidAt ?? o.createdAt)} · {t(o.delivery === 'pickup' ? 'pickup' : 'shipping')} · {formatCents(o.totalCents, locale)}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[o.status]}`}>{t(`status_${o.status}`)}</span>
            </button>
            {open && (
              <div className="space-y-3 border-t border-gray-100 px-4 py-4 text-sm">
                <ul className="space-y-1">
                  {o.items.map((i) => (
                    <li key={i.product_id} className="flex justify-between gap-3">
                      <span>
                        {i.quantity} × {i.name}
                      </span>
                      <span className="font-semibold">{formatCents(i.price_cents * i.quantity, locale)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3 text-gray-500">
                    <span>{t(o.delivery === 'pickup' ? 'pickup' : 'shipping')}</span>
                    <span>{formatCents(o.shippingCents, locale)}</span>
                  </li>
                  <li className="flex justify-between gap-3 border-t border-gray-100 pt-1 font-bold">
                    <span>{t('total')}</span>
                    <span>{formatCents(o.totalCents, locale)}</span>
                  </li>
                </ul>
                <div className="rounded-xl bg-gray-50 p-3 text-gray-700">
                  <p className="font-semibold">{o.customerName}</p>
                  <p>
                    <a href={`mailto:${o.customerEmail}`} className="underline">
                      {o.customerEmail}
                    </a>
                    {o.customerPhone && (
                      <>
                        {' · '}
                        <a href={`tel:${o.customerPhone}`} className="underline">
                          {o.customerPhone}
                        </a>
                      </>
                    )}
                  </p>
                  {o.shipAddress && (
                    <p className="mt-1">
                      {o.shipAddress.line}, {o.shipAddress.postal_code} {o.shipAddress.city} {o.shipAddress.province} ({o.shipAddress.country})
                    </p>
                  )}
                  {o.notes && <p className="mt-1 italic">«{o.notes}»</p>}
                  {o.trackingNumber && <p className="mt-1">{t('trackingShown', { code: o.trackingNumber })}</p>}
                </div>
                {o.status === 'paid' && o.delivery === 'shipping' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={tracking.number} maxLength={80} placeholder={t('trackingNumber')} onChange={(e) => setTracking({ ...tracking, number: e.target.value })} className={input} />
                    <input value={tracking.url} maxLength={500} inputMode="url" placeholder={t('trackingUrl')} onChange={(e) => setTracking({ ...tracking, url: e.target.value })} className={input} />
                  </div>
                )}
                {error && <p className="rounded-xl bg-amber-50 px-3 py-2 font-semibold text-amber-800">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  {o.status === 'paid' && o.delivery === 'pickup' && (
                    <button type="button" disabled={busy} onClick={() => change(o, 'ready')} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--ink)] px-4 font-bold text-white disabled:opacity-60">
                      <PackageCheck className="h-4 w-4" /> {t('markReady')}
                    </button>
                  )}
                  {o.status === 'paid' && o.delivery === 'shipping' && (
                    <button type="button" disabled={busy} onClick={() => change(o, 'shipped')} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--ink)] px-4 font-bold text-white disabled:opacity-60">
                      <Truck className="h-4 w-4" /> {t('markShipped')}
                    </button>
                  )}
                  {(o.status === 'ready' || o.status === 'shipped') && (
                    <button type="button" disabled={busy} onClick={() => change(o, 'delivered')} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white disabled:opacity-60">
                      <CheckCircle2 className="h-4 w-4" /> {t('markDelivered')}
                    </button>
                  )}
                  {(o.status === 'paid' || o.status === 'ready') && (
                    <button type="button" disabled={busy} onClick={() => change(o, 'cancelled')} className="min-h-11 cursor-pointer rounded-xl border border-red-200 px-4 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
                      {t('cancelRefund')}
                    </button>
                  )}
                  {busy && <LoaderCircle className="h-5 w-5 animate-spin self-center text-gray-400" />}
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
