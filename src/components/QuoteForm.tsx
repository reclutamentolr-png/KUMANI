'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import Link from '@/components/LocalizedLink'
import { CheckCircle, LoaderCircle, XCircle, Plus, Trash2, Pencil, User, Boxes, Search, X, Table2, ScrollText } from 'lucide-react'
import { createQuote, updateQuote, listSavedClients } from '@/app/actions/quotes'
import {
  emptyQuoteItem,
  computeQuoteTotal,
  QUOTE_LAYOUTS,
  QUOTE_LOGO_POSITIONS,
  BAND_COLORS,
  BAND_HEIGHT_MAX,
  BAND_HEIGHT_MIN,
  DEFAULT_BAND_STYLE,
  LINE_COLORS,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  cleanBandStyle,
  DEFAULT_DEPOSIT_PERCENT,
  type QuotePaymentMode,
  type QuoteBandStyle,
  type QuoteLogoPosition,
  type QuotePreset,
  type QuoteFormData,
  type QuoteInventoryProduct,
  type SavedClientRow,
} from '@/lib/quotes'
import { useFromDashboardSuffix } from '@/lib/useFromDashboard'
import QuoteClientQuickEditModal from '@/components/QuoteClientQuickEditModal'
import QuoteSectionsEditor from '@/components/quotes/QuoteSectionsEditor'
import QuotePdfPreview from '@/components/quotes/QuotePdfPreview'
import type { IssuerForPdf } from '@/lib/quotePdfShared'
import VatCheck from '@/components/ecosystem/VatCheck'
import IbanInlineCheck from '@/components/ecosystem/IbanInlineCheck'
import { askConfirm } from '@/lib/confirm'

type IssuerSummary = {
  company_name: string | null
  vat_number: string | null
  address: string | null
  email: string | null
  phone: string | null
  // Dalla Scheda attività: riempie il pagamento dei nuovi preventivi
  payment_info?: string | null
  // Ultima posizione del logo scelta e sezioni pronte del preventivo descrittivo
  quote_logo_position?: string | null
  quote_presets?: QuotePreset[] | null
  quote_band_style?: QuoteBandStyle | null
  accent?: string | null
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
  // Numero del preventivo (nuovo: il prossimo libero) per l'anteprima
  quoteNumber?: number
  // KUMANI Shop: conto Stripe collegato e pronto per incassare
  canChargeOnline?: boolean
}

function defaultForm(paymentInfo = '', logoPosition: QuoteLogoPosition = 'left', intro = '', closing = '', bandStyle: QuoteBandStyle | null = null): QuoteFormData {
  return {
    layout: 'table',
    logoPosition,
    bandStyle,
    subject: '',
    intro,
    sections: [],
    showTotal: true,
    vatMode: 'plus',
    closing,
    signature: true,
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
    paymentMode: 'none',
    depositPercent: DEFAULT_DEPOSIT_PERCENT,
    notes: '',
  }
}

export default function QuoteForm({ issuer, logoUrl, mode, quoteId, initialData, inventoryProducts, initialLine, quoteNumber, canChargeOnline = false }: Props) {
  const t = useTranslations('preventivi')
  const tb = useTranslations('businessProfile')
  const te = useTranslations('ecosystem')
  const tm = useTranslations('magazzino')
  const router = useRouter()
  const fromDashboardSuffix = useFromDashboardSuffix()
  const issuerPayment = issuer?.payment_info?.trim() ?? ''

  const [form, setForm] = useState<QuoteFormData>(() => {
    if (initialData) return initialData
    const savedPosition = issuer?.quote_logo_position
    const position = QUOTE_LOGO_POSITIONS.includes(savedPosition as QuoteLogoPosition) ? (savedPosition as QuoteLogoPosition) : 'left'
    const base = defaultForm(issuerPayment, position, t('defaultIntro'), t('defaultClosing'), cleanBandStyle(issuer?.quote_band_style))
    return initialLine ? { ...base, items: [{ ...emptyQuoteItem(), ...initialLine }] } : base
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedClients, setSavedClients] = useState<SavedClientRow[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [editingClient, setEditingClient] = useState<SavedClientRow | null>(null)
  const [clientQuery, setClientQuery] = useState('')
  const [clientListOpen, setClientListOpen] = useState(false)

  // Modifiche non salvate: confronto con il modulo di partenza
  const [initialSnapshot] = useState(() => JSON.stringify(form))
  const dirty = JSON.stringify(form) !== initialSnapshot
  useEffect(() => {
    if (!dirty || saving) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, saving])
  // «Annulla»: in modifica torna al preventivo, se nuovo all'elenco; con
  // modifiche non salvate chiede prima conferma
  const cancel = async () => {
    if (dirty && !(await askConfirm(t('cancelConfirm')))) return
    router.push(mode === 'edit' && quoteId ? `/marketplace/preventivi/${quoteId}${fromDashboardSuffix}` : `/marketplace/preventivi${fromDashboardSuffix}`)
  }

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
  // Ricerca tra i clienti salvati: nome, città, P.IVA, email o telefono
  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    const list = q
      ? savedClients.filter((c) => [c.name, c.city, c.vat, c.email, c.phone].some((v) => v?.toLowerCase().includes(q)))
      : savedClients
    return list.slice(0, 8)
  }, [clientQuery, savedClients])
  const pickClient = (client: SavedClientRow) => {
    handleSelectSavedClient(client.id)
    setClientQuery('')
    setClientListOpen(false)
  }

  const descriptive = form.layout === 'descriptive'
  const total = computeQuoteTotal(form.items)
  const isValid =
    form.clientName.trim().length > 0 &&
    (descriptive
      ? form.sections.some((s) => s.title.trim() || s.body.trim()) || form.subject.trim().length > 0
      : form.items.some((i) => i.description.trim().length > 0))

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
        sections: form.sections.filter((x) => x.title.trim() || x.body.trim() || x.amount !== null),
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
    {/* Su schermi larghi: modulo a sinistra, anteprima dal vivo del PDF a destra */}
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start xl:gap-8">
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

      {/* Modalità del preventivo e posizione del logo nel PDF */}
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8 space-y-5">
        <div>
          <h3 className="mb-3 font-bold text-[var(--ink)]">{t('layoutTitle')}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QUOTE_LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, layout: l }))}
                aria-pressed={form.layout === l}
                className={`rounded-xl border-2 p-4 text-left transition ${form.layout === l ? 'border-[var(--gold)] bg-[var(--gold-pale)]/50' : 'border-gray-200 hover:border-[var(--gold)]/50'}`}
              >
                <span className="flex items-center gap-2 font-bold text-[var(--ink)]">
                  {l === 'table' ? <Table2 className="h-5 w-5 text-[var(--gold)]" /> : <ScrollText className="h-5 w-5 text-[var(--gold)]" />}
                  {t(`layout_${l}`)}
                </span>
                <span className="mt-1 block text-xs text-gray-600">{t(`layout_${l}_hint`)}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-bold text-[var(--ink)]">{t('logoPositionTitle')}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUOTE_LOGO_POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, logoPosition: pos }))}
                aria-pressed={form.logoPosition === pos}
                className={`rounded-xl border-2 p-2 text-center transition ${form.logoPosition === pos ? 'border-[var(--gold)] bg-[var(--gold-pale)]/50' : 'border-gray-200 hover:border-[var(--gold)]/50'}`}
              >
                {/* Miniatura della pagina con il logo nella posizione */}
                <span className="relative mx-auto block h-14 w-11 rounded border border-gray-300 bg-white">
                  {pos === 'band' ? (
                    <>
                      <span className="absolute inset-x-0 top-1.5 h-2 bg-gray-400" />
                      <span className="absolute inset-x-0 top-3.5 h-0.5 bg-[var(--gold)]" />
                      <span className="absolute left-1/2 top-0.5 h-4 w-4 -translate-x-1/2 rounded-sm bg-[var(--ink)]" />
                    </>
                  ) : (
                    <span
                      className={`absolute top-1.5 h-3 w-3 rounded-sm bg-[var(--ink)] ${pos === 'left' ? 'left-1.5' : pos === 'right' ? 'right-1.5' : 'left-1/2 -translate-x-1/2'}`}
                    />
                  )}
                  <span className="absolute inset-x-1.5 top-7 h-0.5 bg-gray-200" />
                  <span className="absolute inset-x-1.5 top-9 h-0.5 bg-gray-200" />
                  <span className="absolute inset-x-1.5 top-11 h-0.5 bg-gray-200" />
                </span>
                <span className="mt-1.5 block text-xs font-semibold text-[var(--ink)]">{t(`logoPosition_${pos}`)}</span>
              </button>
            ))}
          </div>
          {!logoUrl && <p className="mt-2 text-xs text-gray-500">{t('logoPositionNoLogo')}</p>}
          {form.logoPosition === 'band' && (() => {
            // Senza scelta: grigio e il colore dell'azienda per la riga
            // (scelte salvate prima dello spessore della riga: completate con i valori di base)
            const band = form.bandStyle ? { ...DEFAULT_BAND_STYLE, ...form.bandStyle } : { ...DEFAULT_BAND_STYLE, line: /^#[0-9a-f]{6}$/i.test(issuer?.accent ?? '') ? (issuer!.accent as string) : DEFAULT_BAND_STYLE.line }
            const setBand = (patch: Partial<QuoteBandStyle>) => setForm((prev) => ({ ...prev, bandStyle: { ...band, ...patch } }))
            const swatches = (colors: string[], value: string, key: 'band' | 'line') => (
              <div className="flex flex-wrap items-center gap-1.5">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBand({ [key]: c })}
                    aria-label={c}
                    aria-pressed={value.toLowerCase() === c}
                    className={`h-7 w-7 rounded-full border-2 ${value.toLowerCase() === c ? 'border-[var(--ink)] ring-2 ring-[var(--gold)]/40' : 'border-gray-200'}`}
                    style={{ background: c }}
                  />
                ))}
                <input type="color" value={value} onChange={(e) => setBand({ [key]: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-gray-300" />
              </div>
            )
            return (
              <div className="mt-4 space-y-3 rounded-xl border border-[var(--gold)]/25 bg-[var(--background)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[var(--ink)]">{t('bandStyleTitle')}</p>
                  {form.bandStyle && (
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, bandStyle: null }))} className="text-xs font-semibold text-[var(--gold)] hover:underline">
                      {t('bandReset')}
                    </button>
                  )}
                </div>
                {/* Miniatura: fascia, riga e riquadro del logo */}
                <div className="relative h-20 overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="absolute inset-x-0" style={{ top: 34 - band.height / 3, height: band.height / 1.5, background: band.band }} />
                  <div className="absolute inset-x-0" style={{ top: 34 + band.height / 3, height: Math.max(1, band.lineHeight / 1.5), background: band.line }} />
                  <div className="absolute left-1/2 top-1.5 flex h-16 w-28 -translate-x-1/2 items-center justify-center bg-[#141414]">
                    {logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="" className="max-h-12 max-w-24 object-contain" />
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1 block text-xs font-semibold text-gray-600">{t('bandColor')}</span>
                    {swatches(BAND_COLORS, band.band, 'band')}
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-semibold text-gray-600">{t('bandLineColor')}</span>
                    {swatches(LINE_COLORS, band.line, 'line')}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 flex justify-between text-xs font-semibold text-gray-600">
                      {t('bandHeight')} <span>{band.height} pt</span>
                    </span>
                    <input
                      type="range"
                      min={BAND_HEIGHT_MIN}
                      max={BAND_HEIGHT_MAX}
                      step={2}
                      value={band.height}
                      onChange={(e) => setBand({ height: Number(e.target.value) })}
                      className="w-full accent-[var(--gold)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 flex justify-between text-xs font-semibold text-gray-600">
                      {t('bandLineHeight')} <span>{band.lineHeight} pt</span>
                    </span>
                    <input
                      type="range"
                      min={LINE_HEIGHT_MIN}
                      max={LINE_HEIGHT_MAX}
                      step={1}
                      value={band.lineHeight}
                      onChange={(e) => setBand({ lineHeight: Number(e.target.value) })}
                      className="w-full accent-[var(--gold)]"
                    />
                  </label>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-bold text-[var(--ink)]">{t('clientSectionTitle')}</h3>
            {savedClients.length > 0 && (
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gold)]" />
                  <input
                    type="search"
                    value={clientQuery}
                    onChange={(e) => {
                      setClientQuery(e.target.value)
                      setClientListOpen(true)
                    }}
                    onFocus={() => setClientListOpen(true)}
                    onBlur={() => setTimeout(() => setClientListOpen(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && clientMatches[0]) {
                        e.preventDefault()
                        pickClient(clientMatches[0])
                      }
                      if (e.key === 'Escape') setClientListOpen(false)
                    }}
                    placeholder={selectedClient ? selectedClient.name : t('clientSearchPlaceholder')}
                    aria-label={t('clientSearchPlaceholder')}
                    className="w-full rounded-lg border-2 border-gray-200 py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                  />
                  {clientListOpen && (
                    <ul className="absolute right-0 z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                      {clientMatches.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-gray-500">{t('clientSearchEmpty')}</li>
                      ) : (
                        clientMatches.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickClient(c)}
                              className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--gold-pale)] ${c.id === selectedClientId ? 'bg-[var(--gold-pale)]/60' : ''}`}
                            >
                              <User className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-[var(--ink)]">{c.name}</span>
                                <span className="block truncate text-xs text-gray-500">{[c.city, c.vat, c.email].filter(Boolean).join(' · ')}</span>
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
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
              <VatCheck value={form.clientVat} onUseName={(name) => setForm((prev) => ({ ...prev, clientName: name }))} />
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

        {descriptive ? (
          <div className="border-t border-[var(--gold)]/15 pt-6">
            <QuoteSectionsEditor form={form} setForm={setForm} initialPresets={Array.isArray(issuer?.quote_presets) ? issuer.quote_presets : []} />
          </div>
        ) : (
        <div className="border-t border-[var(--gold)]/15 pt-6">
          <h3 className="font-bold text-[var(--ink)] mb-4">{t('itemsSectionTitle')}</h3>
          {/* Titoli delle colonne */}
          <div className="mb-1.5 grid grid-cols-12 gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            <span className="col-span-6">{t('itemDescriptionHeader')}</span>
            <span className="col-span-2">{t('itemQuantityHeader')}</span>
            <span className="col-span-3">{t('itemPriceHeader')}</span>
          </div>
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
        )}

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
          <IbanInlineCheck text={form.paymentInfo} />
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

        {/* KUMANI Shop: il cliente accetta e paga online dalla pagina del preventivo */}
        <div className="border-t border-[var(--gold)]/15 pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('onlinePaymentField')}</label>
          <p className="text-xs text-gray-400 mb-2">{canChargeOnline ? t('onlinePaymentHint') : t('onlinePaymentConnectHint')}</p>
          {canChargeOnline ? (
            <div className="flex flex-wrap items-center gap-2">
              {(['none', 'full', 'deposit'] as QuotePaymentMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, paymentMode: m }))}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                    form.paymentMode === m ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]'
                  }`}
                >
                  {t(`onlinePayment_${m}`)}
                </button>
              ))}
              {form.paymentMode === 'deposit' && (
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.depositPercent}
                    onChange={(e) => setForm((prev) => ({ ...prev, depositPercent: Number(e.target.value) || 0 }))}
                    className="w-20 rounded-lg border-2 border-[var(--gold)]/20 px-2 py-1 text-right focus:border-[var(--gold)] focus:outline-none"
                  />
                  %
                </label>
              )}
            </div>
          ) : (
            <Link href="/scheda-attivita?from=/marketplace/preventivi" className="text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
              {t('onlinePaymentConnect')}
            </Link>
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

        {/* Nel descrittivo la casella è nell'editor delle sezioni, vicino alla chiusura */}
        {!descriptive && (
          <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <input type="checkbox" className="h-5 w-5 accent-[var(--gold)]" checked={form.signature} onChange={(e) => setForm((p) => ({ ...p, signature: e.target.checked }))} />
            {t('signatureField')}
          </label>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-800 text-sm">
            <XCircle className="w-5 h-5 shrink-0" />
            {t(error)}
          </div>
        )}

        <div className="flex gap-3">
        <button
          type="button"
          onClick={cancel}
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
    <QuotePdfPreview form={form} issuer={issuer as unknown as IssuerForPdf} logoUrl={logoUrl} quoteNumber={quoteNumber ?? 0} />
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
