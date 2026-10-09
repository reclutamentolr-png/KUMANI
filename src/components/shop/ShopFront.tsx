'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { LoaderCircle, Minus, Package, Plus, ShoppingBag, Store, Trash2, X } from 'lucide-react'
import { startShopCheckout } from '@/app/actions/shopStore'
import { EU_COUNTRIES, formatCents, shippingCents, type ShopProduct, type ShopSettings } from '@/lib/shop'

// Vetrina pubblica del negozio: prodotti, carrello (resta nel browser) e
// dati per l'ordine; il pagamento avviene su Stripe, sul conto del venditore.

type Product = ShopProduct & { imageUrl: string | null }
type Cart = Record<string, number>
const cartKey = (slug: string) => `kumani_cart_${slug}`
const input = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/25'

export default function ShopFront({ settings, products, sellerName }: { settings: ShopSettings; products: Product[]; sellerName: string }) {
  const t = useTranslations('shopPublic')
  const locale = useLocale()
  const [cart, setCart] = useState<Cart>({})
  const [open, setOpen] = useState<'cart' | 'product' | 'policy' | null>(null)
  const [shown, setShown] = useState<Product | null>(null)
  const [step, setStep] = useState<'cart' | 'details'>('cart')
  const [delivery, setDelivery] = useState<'pickup' | 'shipping'>(settings.pickupEnabled ? 'pickup' : 'shipping')
  const [form, setForm] = useState({ name: '', email: '', phone: '', line: '', city: '', postal_code: '', province: '', country: 'IT', notes: '' })
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const money = (c: number) => formatCents(c, locale)

  // Carrello salvato nel browser (solo prodotti ancora in vendita)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(cartKey(settings.slug)) || '{}') as Cart
      const valid = Object.fromEntries(Object.entries(saved).filter(([id, q]) => products.some((p) => p.id === id) && q > 0))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- la memoria del browser si legge solo nel browser
      setCart(valid)
    } catch {
      // memoria del browser non disponibile
    }
  }, [settings.slug, products])
  const update = (next: Cart) => {
    setCart(next)
    try {
      localStorage.setItem(cartKey(settings.slug), JSON.stringify(next))
    } catch {
      // nulla da fare
    }
  }
  const add = (p: Product, delta: number) => {
    const max = p.stock == null ? 99 : Math.min(p.stock, 99)
    const q = Math.max(0, Math.min((cart[p.id] ?? 0) + delta, max))
    const next = { ...cart }
    if (q) next[p.id] = q
    else delete next[p.id]
    update(next)
  }

  const lines = useMemo(() => products.filter((p) => cart[p.id]).map((p) => ({ product: p, quantity: cart[p.id] })), [products, cart])
  const count = lines.reduce((s, l) => s + l.quantity, 0)
  const subtotal = lines.reduce((s, l) => s + l.product.priceCents * l.quantity, 0)
  const shipping = shippingCents(settings, subtotal, delivery, form.country)
  const total = subtotal + (shipping ?? 0)

  const pay = async () => {
    setBusy(true)
    setError(null)
    const r = await startShopCheckout({
      slug: settings.slug,
      cart: lines.map((l) => ({ id: l.product.id, quantity: l.quantity })),
      name: form.name,
      email: form.email,
      phone: form.phone,
      delivery,
      address: { line: form.line, city: form.city, postal_code: form.postal_code, province: form.province, country: form.country },
      notes: form.notes,
      acceptTerms: terms,
    })
    if (r.success) {
      window.location.href = r.data.url
      return
    }
    setBusy(false)
    setError(t(`error_${r.message}`))
  }

  return (
    <>
      {!products.length ? (
        <p className="flex flex-col items-center gap-2 rounded-2xl bg-white px-4 py-12 text-center text-gray-500">
          <Store className="h-8 w-8 text-gray-300" /> {t('noProducts')}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => {
            const out = p.stock === 0
            return (
              <li key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShown(p)
                    setOpen('product')
                  }}
                  className="cursor-pointer text-left"
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} loading="lazy" className="aspect-square w-full bg-gray-50 object-cover" />
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center bg-gray-100 text-gray-300">
                      <Package className="h-10 w-10" />
                    </span>
                  )}
                  <span className="block px-3 pt-2 text-sm font-semibold leading-snug text-[var(--ink)]">{p.name}</span>
                </button>
                <div className="mt-auto flex items-center justify-between gap-2 px-3 pb-3 pt-1">
                  <span className="font-bold text-[var(--ink)]">{money(p.priceCents)}</span>
                  {out ? (
                    <span className="text-xs font-semibold text-red-600">{t('soldOut')}</span>
                  ) : (
                    <button type="button" onClick={() => add(p, 1)} aria-label={t('addToCart', { name: p.name })} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[var(--ink)] text-white hover:brightness-125">
                      <Plus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {settings.returnsPolicy && (
        <button type="button" onClick={() => setOpen('policy')} className="mt-6 min-h-11 cursor-pointer text-sm font-semibold text-gray-600 underline underline-offset-4">
          {t('policyLink')}
        </button>
      )}

      {count > 0 && open === null && (
        <button
          type="button"
          onClick={() => {
            setStep('cart')
            setOpen('cart')
          }}
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex min-h-14 max-w-md cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-5 font-bold text-white shadow-2xl"
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[var(--gold-bright)]" /> {t('cartCount', { n: count })}
          </span>
          <span>{money(subtotal)}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => !busy && setOpen(null)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[var(--ink)]">{open === 'product' ? shown?.name : open === 'policy' ? t('policyTitle') : step === 'cart' ? t('cartTitle') : t('detailsTitle')}</h2>
              <button type="button" onClick={() => setOpen(null)} aria-label={t('close')} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {open === 'policy' && <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{settings.returnsPolicy}</p>}

            {open === 'product' && shown && (
              <div className="space-y-3">
                {shown.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shown.imageUrl} alt={shown.name} className="max-h-[50vh] w-full rounded-2xl bg-gray-50 object-contain" />
                )}
                <p className="text-xl font-bold">{money(shown.priceCents)}</p>
                {shown.description && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700">{shown.description}</p>}
                {shown.stock != null && shown.stock > 0 && shown.stock <= 5 && <p className="text-sm font-semibold text-amber-700">{t('fewLeft', { n: shown.stock })}</p>}
                {shown.stock === 0 ? (
                  <p className="font-semibold text-red-600">{t('soldOut')}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      add(shown, 1)
                      setOpen(null)
                    }}
                    className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--ink)] font-bold text-white"
                  >
                    <Plus className="h-5 w-5" /> {t('addButton')}
                  </button>
                )}
              </div>
            )}

            {open === 'cart' && step === 'cart' && (
              <div className="space-y-4">
                <ul className="divide-y divide-gray-100">
                  {lines.map(({ product, quantity }) => (
                    <li key={product.id} className="flex items-center gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{product.name}</span>
                        <span className="text-sm text-gray-500">{money(product.priceCents)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={() => add(product, -1)} aria-label={t('less')} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-300">
                          {quantity === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                        </button>
                        <span className="w-7 text-center font-bold">{quantity}</span>
                        <button type="button" onClick={() => add(product, 1)} disabled={product.stock != null && quantity >= product.stock} aria-label={t('more')} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-300 disabled:opacity-40">
                          <Plus className="h-4 w-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="flex justify-between text-lg font-bold">
                  <span>{t('subtotal')}</span>
                  <span>{money(subtotal)}</span>
                </p>
                {settings.shippingEnabled && settings.freeShippingOverCents != null && subtotal < settings.freeShippingOverCents && (
                  <p className="text-sm text-gray-600">{t('freeShippingFrom', { amount: money(settings.freeShippingOverCents) })}</p>
                )}
                <button type="button" onClick={() => setStep('details')} disabled={!lines.length} className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-[var(--ink)] font-bold text-white disabled:opacity-50">
                  {t('continue')}
                </button>
              </div>
            )}

            {open === 'cart' && step === 'details' && (
              <div className="space-y-4">
                {settings.pickupEnabled && settings.shippingEnabled && (
                  <div className="grid grid-cols-2 gap-2">
                    {(['pickup', 'shipping'] as const).map((d) => (
                      <button key={d} type="button" onClick={() => setDelivery(d)} aria-pressed={delivery === d} className={`min-h-12 cursor-pointer rounded-xl border-2 px-3 text-sm font-bold ${delivery === d ? 'border-[var(--ink)] bg-[var(--gold-pale)]' : 'border-gray-200'}`}>
                        {t(d === 'pickup' ? 'deliveryPickup' : 'deliveryShipping')}
                      </button>
                    ))}
                  </div>
                )}
                {delivery === 'pickup' && settings.pickupInfo && <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{settings.pickupInfo}</p>}
                <div className="grid gap-3">
                  <input value={form.name} autoComplete="name" placeholder={t('fieldName')} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
                  <input value={form.email} type="email" autoComplete="email" placeholder={t('fieldEmail')} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
                  <input value={form.phone} type="tel" autoComplete="tel" placeholder={t('fieldPhone')} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
                  {delivery === 'shipping' && (
                    <>
                      <input value={form.line} autoComplete="street-address" placeholder={t('fieldAddress')} onChange={(e) => setForm({ ...form, line: e.target.value })} className={input} />
                      <div className="grid grid-cols-[1fr_7rem] gap-3">
                        <input value={form.city} autoComplete="address-level2" placeholder={t('fieldCity')} onChange={(e) => setForm({ ...form, city: e.target.value })} className={input} />
                        <input value={form.postal_code} autoComplete="postal-code" placeholder={t('fieldPostal')} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className={input} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input value={form.province} placeholder={t('fieldProvince')} onChange={(e) => setForm({ ...form, province: e.target.value })} className={input} />
                        <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={input}>
                          <option value="IT">Italia</option>
                          {settings.shippingEuCents != null &&
                            EU_COUNTRIES.map((c) => (
                              <option key={c} value={c}>
                                {new Intl.DisplayNames([locale], { type: 'region' }).of(c)}
                              </option>
                            ))}
                        </select>
                      </div>
                    </>
                  )}
                  <textarea value={form.notes} maxLength={500} rows={2} placeholder={t('fieldNotes')} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input} />
                </div>
                <div className="space-y-1 rounded-xl bg-gray-50 p-3 text-sm">
                  <p className="flex justify-between">
                    <span>{t('subtotal')}</span>
                    <span>{money(subtotal)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>{t(delivery === 'pickup' ? 'deliveryPickup' : 'shipping')}</span>
                    <span>{shipping == null ? '—' : shipping === 0 ? t('free') : money(shipping)}</span>
                  </p>
                  <p className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold">
                    <span>{t('total')}</span>
                    <span>{money(total)}</span>
                  </p>
                </div>
                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
                  <span>
                    {t('termsLabel', { seller: sellerName })}{' '}
                    <button type="button" onClick={() => setOpen('policy')} className="cursor-pointer font-semibold underline">
                      {t('policyLinkShort')}
                    </button>{' '}
                    ·{' '}
                    <a href={`/${locale === 'it' ? '' : `${locale}/`}privacy`} target="_blank" rel="noreferrer" className="font-semibold underline">
                      Privacy
                    </a>
                  </span>
                </label>
                {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep('cart')} className="min-h-12 cursor-pointer rounded-xl border border-gray-300 px-4 font-semibold">
                    {t('back')}
                  </button>
                  <button type="button" onClick={pay} disabled={busy || shipping == null} className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] font-bold text-[var(--ink)] shadow disabled:opacity-60">
                    {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('pay', { amount: money(total) })}
                  </button>
                </div>
                <p className="text-center text-xs text-gray-500">{t('payNote', { seller: sellerName })}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
