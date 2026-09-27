'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Bell, Crown, LoaderCircle, Plus, Store } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { saveSupplier } from '@/app/actions/convivio'
import { CONVIVIO_CATEGORIES, type ConvivioCard, type MySupplierInfo } from '@/lib/convivio'
import ConvivioCardItem from './ConvivioCardItem'
import ConvivioCreateForm from './ConvivioCreateForm'

const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'

// Area fornitore di Convivio (professionisti Pro): scheda attività con
// "Accetto ordini di gruppo", offerte di gruppo proprie e richieste dei
// capocordata da confermare.
export default function SupplierArea({ info, userId, orders }: { info: MySupplierInfo; userId: string; orders: ConvivioCard[] }) {
  const t = useTranslations('convivio')
  const locale = useLocale()
  const router = useRouter()
  const supplier = info.supplier
  const [form, setForm] = useState({
    businessName: supplier?.business_name ?? info.prefill?.business_name ?? '',
    vatNumber: supplier?.vat_number ?? (info.prefill?.vat_number ?? '').replace(/\D/g, ''),
    city: supplier?.city ?? info.prefill?.city ?? '',
    category: supplier?.category ?? 'food',
    description: supplier?.description ?? '',
    accepts: supplier?.accepts_group_orders ?? true,
  })
  const [editing, setEditing] = useState(!supplier)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [now, setNow] = useState(0)

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
    if (result === 'ok') {
      setEditing(false)
      setMessage(t('supplierSaved'))
      router.refresh()
    } else {
      setMessage(t(`error_${result}`))
    }
  }

  const requests = orders.filter((o) => o.status === 'awaiting_supplier' && o.supplier_status === 'pending')
  const others = orders.filter((o) => !requests.includes(o))

  return (
    <div className="space-y-6">
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
                <label className={label}>{t('vatNumber')}</label>
                <input className={`${input} font-mono`} inputMode="numeric" value={form.vatNumber} maxLength={14} required placeholder="01234567890" onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} />
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
          </form>
        ) : supplier ? (
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-[var(--ink)]">{supplier.business_name}</p>
            <p className="text-[var(--muted)]">
              {supplier.city} · {t(`category_${supplier.category}`)} · P.IVA {supplier.vat_number}
            </p>
            <p className={`mt-2 text-xs font-semibold ${supplier.accepts_group_orders ? 'text-emerald-700' : 'text-amber-700'}`}>
              {supplier.accepts_group_orders ? t('supplierVisible') : t('supplierHidden')}
            </p>
          </div>
        ) : null}
        {message && <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>}
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {requests.map((card) => (
                  <ConvivioCardItem key={card.id} card={card} now={now} />
                ))}
              </div>
            </section>
          )}

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
