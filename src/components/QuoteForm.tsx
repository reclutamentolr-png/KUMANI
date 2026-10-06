'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { CheckCircle, LoaderCircle, XCircle, Plus, Trash2, Pencil, User, Boxes, Search, X } from 'lucide-react'
import { createQuote, updateQuote, listSavedClients } from '@/app/actions/quotes'
import {
  emptyQuoteItem,
  computeQuoteTotal,
  type QuoteFormData,
  type QuoteInventoryProduct,
  type SavedClientRow,
} from '@/lib/quotes'
import { useFromDashboardSuffix } from '@/lib/useFromDashboard'
import QuoteClientQuickEditModal from '@/components/QuoteClientQuickEditModal'

type IssuerSummary = {
  company_name: string | null
  vat_number: string | null
  address: string | null
  email: string | null
  phone: string | null
  // Dalla Scheda attività: riempie il pagamento dei nuovi preventivi
  payment_info?: string | null
} | null

type Props = {
  issuer: IssuerSummary
  logoUrl: string | null
  mode: 'create' | 'edit'
  quoteId?: string
  initialData?: QuoteFormData
  // Prodotti attivi del Magazzino: passati solo a chi ha il Pro
  inventoryProducts?: QuoteInventoryProduct[]
  // Prima riga già pronta (es. dalle Calcolatrici) su un modulo nuovo
  initialLine?: { description: string; unitPrice: number }
}

function defaultForm(paymentInfo = ''): QuoteFormData {
  return {
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    clientCity: '',
    clientPostalCode: '',
    clientPec: '',
    clientVat: '',
    issueDate: new Date().toISOString().slice(0, 10),
    validUntil: '',
    items: [emptyQuoteItem()],
    paymentInfo,
    notes: '',
  }
}

export default function QuoteForm({ issuer, logoUrl, mode, quoteId, initialData, inventoryProducts, initialLine }: Props) {
  const t = useTranslations('preventivi')
  const tb = useTranslations('businessProfile')
  const te = useTranslations('ecosystem')
  const tm = useTranslations('magazzino')
  const router = useRouter()
  const fromDashboardSuffix = useFromDashboardSuffix()
  const issuerPayment = issuer?.payment_info?.trim() ?? ''

  const [form, setForm] = useState<QuoteFormData>(() => {
    if (initialData) return initialData
    const base = defaultForm(issuerPayment)
    return initialLine ? { ...base, items: [{ ...emptyQuoteItem(), ...initialLine }] } : base
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedClients, setSavedClients] = useState<SavedClientRow[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [editingClient, setEditingClient] = useState<SavedClientRow | null>(null)

  useEffect(() => {
    listSavedClients().then((result) => {
      if (result.success) setSavedClients(result.data)
    })
  }, [])

  const applyClientToForm = (client: SavedClientRow) => {
    setForm((prev) => ({
      ...prev,
      clientName: client.name,
      clientVat: client.vat || '',
      clientAddress: client.address || '',
      clientCity: client.city || '',
      clientPostalCode: client.postal_code || '',
      clientPec: client.pec || '',
      clientEmail: client.email || '',
      clientPhone: client.phone || '',
    }))
  }

  const handleSelectSavedClient = (clientId: string) => {
    setSelectedClientId(clientId)
    if (!clientId) return
    const client = savedClients.find((c) => c.id === clientId)
    if (!client) return
    applyClientToForm(client)
  }

  const handleSavedClientUpdated = (updated: SavedClientRow) => {
    setSavedClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    // The quote currently being edited was filled from this same client —
    // refresh those fields too so the correction isn't lost on save.
    if (selectedClientId === updated.id) applyClientToForm(updated)
    setEditingClient(null)
  }

  const selectedClient = savedClients.find((c) => c.id === selectedClientId) || null

  const total = computeQuoteTotal(form.items)
  const isValid = form.clientName.trim().length > 0 && form.items.some((i) => i.description.trim().length > 0)

  const updateItem = (index: number, patch: Partial<(typeof form.items)[number]>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  const pickerResults = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    const list = inventoryProducts ?? []
    const found = q ? list.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)) : list
    return found.slice(0, 50)
  }, [inventoryProducts, pickerQuery])

  // Prodotto scelto: nuova riga collegata (o al posto dell'unica riga vuota)
  const addProduct = (product: QuoteInventoryProduct) => {
    const line = { description: product.name, quantity: 1, unitPrice: Number(product.sale_price) || 0, productId: product.id }
    setForm((prev) => {
      const onlyEmpty = prev.items.length === 1 && !prev.items[0].description.trim() && !prev.items[0].unitPrice
      return { ...prev, items: onlyEmpty ? [line] : [...prev.items, line] }
    })
    setPickerOpen(false)
    setPickerQuery('')
  }

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, emptyQuoteItem()] }))
  const removeItem = (index: number) =>
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const cleanedForm: QuoteFormData = {
        ...form,
        items: form.items.filter((i) => i.description.trim().length > 0),
      }
      if (mode === 'create') {
        const result = await createQuote(cleanedForm)
        if (!result.success) {
          setError(result.message)
          return
        }
        router.push(`/marketplace/preventivi/${result.data.id}${fromDashboardSuffix}`)
      } else {
        const result = await updateQuote(quoteId!, cleanedForm)
        if (!result.success) {
          setError(result.message)
          return
        }
        router.push(`/marketplace/preventivi/${quoteId}${fromDashboardSuffix}`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <div className="space-y-6">
      {/* Issuer block — read-only, edited only from its own page */}
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-14 h-14 rounded-lg object-contain border border-[var(--gold)]/20 bg-[var(--background)] p-1" />
          ) : null}
          <div>
            <p className="font-bold text-[var(--ink)]">{issuer?.company_name || t('businessProfileMissing')}</p>
            {issuer?.vat_number && <p className="text-xs text-gray-500">{issuer.vat_number}</p>}
          </div>
        </div>
        <Link
          href="/scheda-attivita?from=/marketplace/preventivi"
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline"
        >
          <Pencil className="w-3.5 h-3.5" />
          {t('editBusinessProfile')}
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-bold text-[var(--ink)]">{t('clientSectionTitle')}</h3>
            {savedClients.length > 0 && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[var(--gold)]" />
                <select
                  value={selectedClientId}
                  onChange={(e) => handleSelectSavedClient(e.target.value)}
                  className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                >
                  <option value="">{t('savedClientPlaceholder')}</option>
                  {savedClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {selectedClient && (
                  <button
                    type="button"
                    onClick={() => setEditingClient(selectedClient)}
                    title={t('editSavedClientTitle')}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--gold)] hover:bg-[var(--gold-pale)] transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientNameField')}</label>
              <input
                type="text"
                value={form.clientName}
                onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientVatField')}</label>
              <input
                type="text"
                value={form.clientVat}
                onChange={(e) => setForm((prev) => ({ ...prev, clientVat: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientPecField')}</label>
              <input
                type="email"
                value={form.clientPec}
                onChange={(e) => setForm((prev) => ({ ...prev, clientPec: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientAddressField')}</label>
              <input
                type="text"
                value={form.clientAddress}
                onChange={(e) => setForm((prev) => ({ ...prev, clientAddress: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientCityField')}</label>
              <input
                type="text"
                value={form.clientCity}
                onChange={(e) => setForm((prev) => ({ ...prev, clientCity: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientPostalCodeField')}</label>
              <input
                type="text"
                value={form.clientPostalCode}
                onChange={(e) => setForm((prev) => ({ ...prev, clientPostalCode: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientEmailField')}</label>
              <input
                type="email"
                value={form.clientEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, clientEmail: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientPhoneField')}</label>
              <input
                type="text"
                value={form.clientPhone}
                onChange={(e) => setForm((prev) => ({ ...prev, clientPhone: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[var(--gold)]/15 pt-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('issueDateField')}</label>
            <input
              type="date"
              value={form.issueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, issueDate: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('validUntilField')}</label>
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
            />
          </div>
        </div>

        <div className="border-t border-[var(--gold)]/15 pt-6">
          <h3 className="font-bold text-[var(--ink)] mb-4">{t('itemsSectionTitle')}</h3>
          <div className="space-y-3">
            {form.items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-6">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder={t('itemDescriptionPlaceholder')}
                    className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
                  />
                  {item.productId && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--gold-pale)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink)]">
                      <Boxes className="w-3 h-3 text-[var(--gold)]" />
                      {te('quoteFromInventoryBadge')}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 0 })}
                  placeholder={t('itemQuantityPlaceholder')}
                  className="col-span-2 px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) || 0 })}
                  placeholder={t('itemPricePlaceholder')}
                  className="col-span-3 px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={form.items.length === 1}
                  className="col-span-1 flex items-center justify-center h-full text-red-500 hover:text-red-700 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline"
            >
              <Plus className="w-4 h-4" />
              {t('addItemAction')}
            </button>
            {inventoryProducts && (
              <button
                type="button"
                onClick={() => setPickerOpen((open) => !open)}
                aria-expanded={pickerOpen}
                className="flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline"
              >
                <Boxes className="w-4 h-4" />
                {te('quoteFromInventory')}
              </button>
            )}
          </div>

          {inventoryProducts && pickerOpen && (
            <div className="mt-3 rounded-xl border-2 border-[var(--gold)]/25 bg-[var(--background)] p-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    autoFocus
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder={te('quoteInventorySearch')}
                    aria-label={te('quoteInventorySearch')}
                    className="w-full rounded-lg border-2 border-[var(--gold)]/20 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  aria-label={t('cancelAction')}
                  className="p-2 rounded-lg text-gray-400 hover:text-[var(--ink)] hover:bg-[var(--gold-pale)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {pickerResults.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">{te('quoteInventoryEmpty')}</p>
              ) : (
                <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-[var(--gold)]/10">
                  {pickerResults.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => addProduct(product)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--gold-pale)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[var(--ink)]">{product.name}</span>
                          <span className="block text-xs text-gray-500">
                            {[
                              product.sku,
                              te('quoteInventoryStock', {
                                stock: Number(product.stock).toLocaleString(undefined, { maximumFractionDigits: 3 }),
                                unit: tm.has(`unit_${product.unit}`) ? tm(`unit_${product.unit}`) : product.unit,
                              }),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-[var(--ink)]">
                          {(Number(product.sale_price) || 0).toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <div className="bg-[var(--gold-pale)] rounded-xl px-5 py-3 text-right">
              <p className="text-xs text-[var(--ink)]/70 uppercase tracking-wide">{t('totalLabel')}</p>
              <p className="text-2xl font-bold text-[var(--ink)]">
                {total.toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--gold)]/15 pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('paymentInfoField')}</label>
          <p className="text-xs text-gray-400 mb-2">{t('paymentInfoHint')}</p>
          <textarea
            value={form.paymentInfo}
            onChange={(e) => setForm((prev) => ({ ...prev, paymentInfo: e.target.value }))}
            placeholder={t('paymentInfoPlaceholder')}
            rows={3}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
          {issuerPayment && form.paymentInfo.trim() !== issuerPayment && (
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, paymentInfo: issuerPayment }))}
              className="mt-2 text-xs font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
            >
              {tb('importButton')}
            </button>
          )}
        </div>

        <div className="border-t border-[var(--gold)]/15 pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('notesField')}</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-800 text-sm">
            <XCircle className="w-5 h-5 shrink-0" />
            {t(error)}
          </div>
        )}

        <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 rounded-xl font-semibold text-sm border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)] transition-all"
        >
          {t('cancelAction')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
        >
          {saving ? (
            <>
              <LoaderCircle className="w-5 h-5 animate-spin" />
              {t('saving')}
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              {mode === 'create' ? t('createQuoteAction') : t('saveChangesAction')}
            </>
          )}
        </button>
        </div>
      </div>
    </div>
    {editingClient && (
      <QuoteClientQuickEditModal
        client={editingClient}
        onClose={() => setEditingClient(null)}
        onSaved={handleSavedClientUpdated}
      />
    )}
    </>
  )
}
