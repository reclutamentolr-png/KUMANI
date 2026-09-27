'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Bell, CircleHelp, CreditCard, Crown, Globe, LoaderCircle, Percent, Plus, Store, TriangleAlert } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { saveSupplier, type ConvivioMyFees } from '@/app/actions/convivio'
import { CONVIVIO_CATEGORIES, formatEuro, type ConvivioCard, type MySupplierInfo } from '@/lib/convivio'
import { countryName, EVENT_COUNTRIES, MIN_FEE_PAYMENT } from '@/lib/events'
import { prettyVat, VAT_COUNTRIES_EU, VAT_COUNTRIES_OTHER, vatExample } from '@/lib/vat'
import ConvivioCardItem from './ConvivioCardItem'
import ConvivioCreateForm from './ConvivioCreateForm'

const input = 'w-full rounded-xl border border-[var(--gold)]/30 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'

// Paesi della partita IVA: prima quelli UE (verifica VIES), poi gli extra-UE con
// formato noto; "Altro paese" apre l'elenco completo dei paesi.
const OTHER_CHOICE = '__other'
const MAIN_VAT_COUNTRIES: string[] = [...VAT_COUNTRIES_EU, ...VAT_COUNTRIES_OTHER]
const EXTRA_VAT_COUNTRIES: string[] = EVENT_COUNTRIES.filter((c) => !MAIN_VAT_COUNTRIES.includes(c))

// Area fornitore di Convivio (professionisti Pro): scheda attività con
// "Accetto ordini di gruppo", offerte di gruppo proprie e richieste dei
// capocordata da confermare, commissioni KUMANI (pagamento con carta).
export type SupplierFeeNotice = 'paid' | 'pending' | 'canceled' | 'error' | 'none' | null

export default function SupplierArea({
  info,
  userId,
  orders,
  fees,
  feeNotice = null,
  profileCountry = null,
}: {
  info: MySupplierInfo
  userId: string
  orders: ConvivioCard[]
  fees?: ConvivioMyFees
  feeNotice?: SupplierFeeNotice
  profileCountry?: string | null
}) {
  const t = useTranslations('convivio')
  const locale = useLocale()
  const router = useRouter()
  const supplier = info.supplier
  const initialCountry = (supplier?.vat_country || profileCountry || 'IT').toUpperCase()
  const [form, setForm] = useState({
    businessName: supplier?.business_name ?? info.prefill?.business_name ?? '',
    vatCountry: /^[A-Z]{2}$/.test(initialCountry) ? initialCountry : 'IT',
    vatNumber: supplier ? prettyVat(supplier.vat_number) : (info.prefill?.vat_number ?? '').trim(),
    city: supplier?.city ?? info.prefill?.city ?? '',
    category: supplier?.category ?? 'food',
    description: supplier?.description ?? '',
    accepts: supplier?.accepts_group_orders ?? true,
  })
  const [editing, setEditing] = useState(!supplier)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'warn' | 'error' } | null>(null)
  // "Altro paese": elenco completo quando il paese non è tra quelli principali
  const [otherCountry, setOtherCountry] = useState(!MAIN_VAT_COUNTRIES.includes(form.vatCountry))
  const [creating, setCreating] = useState(false)
  const [now, setNow] = useState(0)
  const [showFeeNotice, setShowFeeNotice] = useState(feeNotice !== null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
  }, [])

  if (!info.is_pro) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[var(--gold)]/30 bg-white p-6 text-center shadow-sm">
        <Crown className="mx-auto h-10 w-10 text-[var(--gold)]" />
        <p className="mt-3 font-bold text-[var(--ink)]">{t('supplierProOnly')}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('supplierProOnlyHint')}</p>
        <Link href="/pro" className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 font-bold text-[var(--ink)]">
          {t('discoverPro')}
        </Link>
      </div>
    )
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const result = await saveSupplier(form)
    setBusy(false)
    if (result === 'ok' || result === 'ok_vies_invalid' || result === 'ok_vies_unavailable') {
      // Salvata comunque: l'esito VIES è solo un'informazione
      setEditing(false)
      setMessage(
        result === 'ok'
          ? { text: t('supplierSaved'), tone: 'ok' }
          : { text: `${t('supplierSaved')} ${t(result === 'ok_vies_invalid' ? 'vatSavedViesInvalid' : 'vatSavedViesUnavailable')}`, tone: 'warn' }
      )
      router.refresh()
    } else if (result === 'invalid_vat') {
      const example = vatExample(form.vatCountry)
      setMessage({ text: example ? t('vatErrorFormatExample', { example }) : t('vatErrorFormat'), tone: 'error' })
    } else if (result === 'invalid_vat_checksum' || result === 'invalid_vat_country') {
      setMessage({ text: t(result === 'invalid_vat_checksum' ? 'vatErrorChecksum' : 'vatErrorCountry'), tone: 'error' })
    } else {
      setMessage({ text: t(`error_${result}`), tone: 'error' })
    }
  }

  const vatPlaceholder = vatExample(form.vatCountry) ?? ''
  const vatIsEu = (c: string | undefined) => VAT_COUNTRIES_EU.includes((c || 'IT').toUpperCase())
  const vatStatus = supplier?.vat_status ?? 'unverified'

  const requests = orders.filter((o) => o.status === 'awaiting_supplier' && o.supplier_status === 'pending')
  const others = orders.filter((o) => !requests.includes(o))

  // Commissioni: da 0,50 € in su si pagano (e bloccano nuove conferme), sotto si sommano alle prossime
  const feeList = fees?.fees ?? []
  const feePercent = Number(fees?.percent ?? 0)
  const dueTotal = Math.round(feeList.filter((f) => f.status === 'due').reduce((sum, f) => sum + Number(f.amount), 0) * 100) / 100
  const feesBlock = dueTotal >= MIN_FEE_PAYMENT
  const money = (value: number) => formatEuro(value, locale)
  const feeNoticeStyle: Record<Exclude<SupplierFeeNotice, null>, string> = {
    paid: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    pending: 'border-amber-200 bg-amber-50 text-amber-800',
    canceled: 'border-gray-200 bg-white text-gray-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    none: 'border-gray-200 bg-white text-gray-700',
  }

  return (
    <div className="space-y-6">
      {showFeeNotice && feeNotice && (
        <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${feeNoticeStyle[feeNotice]}`}>
          <span>{t(`feeNotice_${feeNotice}`)}</span>
          <button type="button" onClick={() => setShowFeeNotice(false)} className="text-xs underline">
            {t('feeClose')}
          </button>
        </div>
      )}

      {/* Scheda attività */}
      <div className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
            <Store className="h-5 w-5 text-[var(--gold)]" /> {t('supplierCard')}
          </p>
          {supplier && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-[var(--gold)] hover:underline">
              {t('edit')}
            </button>
          )}
        </div>
        {editing ? (
          <form onSubmit={save} className="space-y-3">
            <p className="text-sm text-[var(--muted)]">{t('supplierIntro')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>{t('businessName')}</label>
                <input className={input} value={form.businessName} maxLength={120} required onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
              </div>
              <div>
                <label className={label}>{t('vatCountry')}</label>
                <select
                  className={input}
                  value={otherCountry ? OTHER_CHOICE : form.vatCountry}
                  onChange={(e) => {
                    if (e.target.value === OTHER_CHOICE) {
                      setOtherCountry(true)
                      setForm({ ...form, vatCountry: EXTRA_VAT_COUNTRIES.includes(form.vatCountry) ? form.vatCountry : EXTRA_VAT_COUNTRIES[0] })
                    } else {
                      setOtherCountry(false)
                      setForm({ ...form, vatCountry: e.target.value })
                    }
                  }}
                >
                  <optgroup label={t('vatCountriesEu')}>
                    {VAT_COUNTRIES_EU.map((c) => (
                      <option key={c} value={c}>
                        {countryName(c, locale)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t('vatCountriesOther')}>
                    {VAT_COUNTRIES_OTHER.map((c) => (
                      <option key={c} value={c}>
                        {countryName(c, locale)}
                      </option>
                    ))}
                    <option value={OTHER_CHOICE}>{t('vatOtherCountry')}</option>
                  </optgroup>
                </select>
                {otherCountry && (
                  <select className={`${input} mt-2`} value={form.vatCountry} aria-label={t('vatOtherCountry')} onChange={(e) => setForm({ ...form, vatCountry: e.target.value })}>
                    {(EXTRA_VAT_COUNTRIES.includes(form.vatCountry) ? EXTRA_VAT_COUNTRIES : [form.vatCountry, ...EXTRA_VAT_COUNTRIES]).map((c) => (
                      <option key={c} value={c}>
                        {countryName(c, locale)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className={label}>{t('vatNumber')}</label>
                <input
                  className={`${input} font-mono uppercase`}
                  inputMode={form.vatCountry === 'IT' ? 'numeric' : 'text'}
                  autoCapitalize="characters"
                  value={form.vatNumber}
                  maxLength={24}
                  required
                  placeholder={vatPlaceholder}
                  onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {vatPlaceholder ? t('vatExampleHint', { example: vatPlaceholder }) : t('vatGenericHint')}
                  {!vatIsEu(form.vatCountry) && ` ${t('vatNoOnlineCheck')}`}
                </p>
              </div>
              <div>
                <label className={label}>{t('city')}</label>
                <input className={input} value={form.city} maxLength={80} required onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className={label}>{t('fieldCategory')}</label>
                <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}>
                  {CONVIVIO_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`category_${c}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={label}>{t('supplierDescription')}</label>
              <textarea className={input} rows={2} maxLength={500} value={form.description} placeholder={t('supplierDescriptionPlaceholder')} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.accepts} onChange={(e) => setForm({ ...form, accepts: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
              <span>
                <span className="font-semibold">{t('acceptsGroupOrders')}</span>
                <span className="block text-xs text-[var(--muted)]">{t('acceptsGroupOrdersHint')}</span>
              </span>
            </label>
            <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-2.5 font-bold text-white disabled:opacity-50">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('save')}
            </button>
            <p className="flex items-start gap-1.5 text-xs text-[var(--muted)]">
              <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gold)]" /> {t('supplierAbroadNote')}
            </p>
          </form>
        ) : supplier ? (
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-[var(--ink)]">{supplier.business_name}</p>
            <p className="text-[var(--muted)]">
              {supplier.city} · {t(`category_${supplier.category}`)} · {t('vatShort')} <span className="font-mono">{prettyVat(supplier.vat_number)}</span>
              {supplier.vat_country && supplier.vat_country !== 'IT' && ` (${countryName(supplier.vat_country, locale)})`}
            </p>
            {/* Esito della verifica della partita IVA (VIES, solo UE) */}
            {vatStatus === 'valid' ? (
              <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" /> {t('vatStatusValid')}
                {supplier.vat_registered_name && <span className="font-normal text-emerald-800">· {supplier.vat_registered_name}</span>}
              </p>
            ) : vatStatus === 'invalid' ? (
              <div className="mt-2">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  <TriangleAlert className="h-3.5 w-3.5" /> {t('vatStatusInvalid')}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">{t('vatStatusInvalidHint')}</p>
              </div>
            ) : (
              <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                <CircleHelp className="h-3.5 w-3.5" /> {t('vatStatusUnverified')}
                {!vatIsEu(supplier.vat_country) && <span className="font-normal">· {t('vatNoOnlineCheck')}</span>}
              </p>
            )}
            <p className={`mt-2 text-xs font-semibold ${supplier.accepts_group_orders ? 'text-emerald-700' : 'text-amber-700'}`}>
              {supplier.accepts_group_orders ? t('supplierVisible') : t('supplierHidden')}
            </p>
          </div>
        ) : null}
        {message && (
          <p className={`mt-3 text-sm font-semibold ${message.tone === 'ok' ? 'text-emerald-700' : message.tone === 'warn' ? 'text-amber-700' : 'text-red-700'}`}>{message.text}</p>
        )}
      </div>

      {supplier && (
        <>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] sm:w-auto"
          >
            <Plus className="h-5 w-5" /> {t('createOffer')}
          </button>

          {requests.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-bold text-[var(--ink)]">
                <Bell className="h-5 w-5 text-amber-500" /> {t('requestsTitle', { count: requests.length })}
              </h2>
              <p className="mb-3 flex items-start gap-1.5 text-xs text-[var(--muted)]">
                <Percent className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gold)]" /> {t('feePercentNotice', { percent: feePercent })}
              </p>
              {feesBlock && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{t('error_fees_due')}</p>}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {requests.map((card) => (
                  <ConvivioCardItem key={card.id} card={card} now={now} />
                ))}
              </div>
            </section>
          )}

          {/* Commissioni KUMANI */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-[var(--ink)]">
              <CreditCard className="h-5 w-5 text-[var(--gold)]" /> {t('feeTitle')}
            </h2>
            <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-700">{t('feePercentNotice', { percent: feePercent })}</p>
              {feeList.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--muted)]">{t('feeNone')}</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {feeList.map((fee) => (
                    <li key={fee.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <div className="min-w-0">
                        <Link href={`/marketplace/convivio/${fee.group_id}`} className="font-semibold text-[var(--ink)] hover:underline">
                          {fee.title}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">
                          {t('feeFormula', { quantity: fee.quantity, price: money(Number(fee.price)), percent: Number(fee.percent) })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--ink)]">{money(Number(fee.amount))}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            fee.status === 'due' ? 'bg-amber-100 text-amber-800' : fee.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {t(`fee_${fee.status}`)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {feesBlock ? (
                <form method="POST" action={`/api/convivio/fee-checkout?locale=${locale}`} className="mt-4">
                  <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-white sm:w-auto">
                    <CreditCard className="h-4 w-4" /> {t('feePay', { amount: money(dueTotal) })}
                  </button>
                  <p className="mt-2 text-xs text-[var(--muted)]">{t('feePayHint')}</p>
                </form>
              ) : dueTotal > 0 ? (
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{t('feeBelowMinimum', { amount: money(dueTotal), min: money(MIN_FEE_PAYMENT) })}</p>
              ) : null}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-bold text-[var(--ink)]">{t('myGroupOrders')}</h2>
            {others.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white/70 p-8 text-center text-sm text-[var(--muted)]">{t('noGroupOrders')}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((card) => (
                  <ConvivioCardItem key={card.id} card={card} now={now} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {creating && supplier && (
        <ConvivioCreateForm
          mode="own"
          ownId={userId}
          ownName={supplier.business_name}
          ownCategory={supplier.category}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`/${locale}/marketplace/convivio/${id}`)}
        />
      )}
    </div>
  )
}
