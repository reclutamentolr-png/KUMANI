'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle, MapPin, Pencil, Phone, Plug, Plus, ShieldAlert, ShieldCheck, ShieldX, Trash2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { deleteAppliance, discardUpload, saveAppliance } from '@/app/actions/casa'
import { legalWarrantyEnd, warrantyState, type ApplianceForm, type CasaAppliance, type FindoPlace } from '@/lib/casa'
import { askConfirm } from '@/lib/confirm'
import { FileField, FileLink, Sheet, card, ghostBtn, input, label, parseNumber, primaryBtn, useAction, useFormat } from '@/components/casa/shared'

type Editing = { id?: string; form: ApplianceForm; priceText: string; original: (string | null)[] }

const WARRANTY_STYLE = {
  none: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-500',
  soon: 'bg-amber-100 text-amber-800',
  ok: 'bg-emerald-100 text-emerald-800',
}

export default function AppliancesPanel({
  homeId,
  appliances,
  fileUrls,
  today,
  findoPlaces,
  findoAvailable,
}: {
  homeId: string
  appliances: CasaAppliance[]
  fileUrls: Record<string, string>
  today: string
  findoPlaces: FindoPlace[]
  findoAvailable: boolean
}) {
  const t = useTranslations('casa')
  const f = useFormat()
  const { run, isPending, error, setError } = useAction()
  const [editing, setEditing] = useState<Editing | null>(null)
  const placeById = new Map(findoPlaces.map((p) => [p.id, p.path]))

  const open = (a?: CasaAppliance) => {
    setError(null)
    setEditing({
      id: a?.id,
      priceText: a?.price !== null && a?.price !== undefined ? String(a.price).replace('.', ',') : '',
      original: [a?.receipt_path ?? null, a?.manual_path ?? null],
      form: {
        name: a?.name ?? '',
        brand: a?.brand ?? '',
        model: a?.model ?? '',
        serialNumber: a?.serial_number ?? '',
        room: a?.room ?? '',
        purchasedOn: a?.purchased_on ?? '',
        price: a?.price ?? null,
        store: a?.store ?? '',
        warrantyUntil: a?.warranty_until ?? '',
        supportPhone: a?.support_phone ?? '',
        notes: a?.notes ?? '',
        receiptPath: a?.receipt_path ?? null,
        manualPath: a?.manual_path ?? null,
        findoLocationId: a?.findo_location_id ?? null,
      },
    })
  }
  const set = <K extends keyof ApplianceForm>(key: K, value: ApplianceForm[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e))

  // Chiuso senza salvare: i file caricati ora non restano nello spazio
  const cancel = () => {
    if (editing) for (const path of [editing.form.receiptPath, editing.form.manualPath]) if (path && !editing.original.includes(path)) void discardUpload(homeId, path)
    setEditing(null)
  }

  const remove = async (a: CasaAppliance) => {
    if (!(await askConfirm(t('deleteApplianceConfirm', { name: a.name })))) return
    run(() => deleteAppliance(a.id))
  }

  // In ordine: garanzie che scadono presto, poi le altre
  const sorted = [...appliances].sort((x, y) => {
    const rank = (a: CasaAppliance) => ({ soon: 0, ok: 1, none: 2, expired: 3 })[warrantyState(a.warranty_until, today)]
    return rank(x) - rank(y) || x.name.localeCompare(y.name)
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">{t('appliancesIntro')}</p>
        <button type="button" onClick={() => open()} className={primaryBtn}>
          <Plus className="h-4 w-4" /> {t('addAppliance')}
        </button>
      </div>

      {appliances.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-white px-6 py-8 text-center">
          <Plug className="mx-auto h-9 w-9 text-[var(--gold)]" />
          <p className="mt-2 font-bold text-[var(--ink)]">{t('appliancesEmptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{t('appliancesEmptyText')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sorted.map((a) => {
            const state = warrantyState(a.warranty_until, today)
            const WIcon = state === 'expired' ? ShieldX : state === 'soon' ? ShieldAlert : ShieldCheck
            return (
              <div key={a.id} className={`${card} !p-4`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                    <Plug className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-[var(--ink)]">{a.name}</p>
                    <p className="truncate text-sm text-[var(--muted)]">{[a.brand, a.model, a.room].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  <button type="button" onClick={() => open(a)} aria-label={t('edit')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => remove(a)} aria-label={t('delete')} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${WARRANTY_STYLE[state]}`}>
                    <WIcon className="h-3.5 w-3.5" />
                    {state === 'none' ? t('warrantyNone') : state === 'expired' ? t('warrantyExpired', { date: f.date(a.warranty_until!) }) : t('warrantyUntil', { date: f.date(a.warranty_until!) })}
                  </span>
                  {a.purchased_on && (
                    <span className="text-xs text-[var(--muted)]">
                      {t('purchasedShort', { date: f.date(a.purchased_on) })}
                      {a.price !== null ? ` · ${f.eur(a.price)}` : ''}
                    </span>
                  )}
                </div>
                {a.findo_location_id && placeById.has(a.findo_location_id) && (
                  <Link
                    href="/marketplace/findo"
                    title={t('findoOpen')}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--gold)]"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />
                    <span className="truncate">{placeById.get(a.findo_location_id)!.replace(/ > /g, ' › ')}</span>
                  </Link>
                )}
                {(a.receipt_path || a.manual_path || a.support_phone) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                    {a.receipt_path && <FileLink url={fileUrls[a.receipt_path]}>{t('receiptFile')}</FileLink>}
                    {a.manual_path && <FileLink url={fileUrls[a.manual_path]}>{t('manualFile')}</FileLink>}
                    {a.support_phone && (
                      <a
                        href={`tel:${a.support_phone.replace(/[^\d+]/g, '')}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-gray-50"
                      >
                        <Phone className="h-3.5 w-3.5 text-[var(--gold)]" /> {t('supportPhoneShort')}
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {error && !editing && <p className="text-sm text-red-600">{error}</p>}

      {editing && (
        <Sheet title={editing.id ? t('editAppliance') : t('addAppliance')} onClose={cancel}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = { ...editing.form, price: parseNumber(editing.priceText) }
              run(() => saveAppliance(homeId, form, editing.id), () => setEditing(null))
            }}
            className="space-y-4"
          >
            <div>
              <label className={label} htmlFor="ap-name">
                {t('applianceName')}
              </label>
              <input id="ap-name" className={input} value={editing.form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} placeholder={t('applianceNamePlaceholder')} required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="ap-brand">
                  {t('brand')}
                </label>
                <input id="ap-brand" className={input} value={editing.form.brand} onChange={(e) => set('brand', e.target.value)} maxLength={60} />
              </div>
              <div>
                <label className={label} htmlFor="ap-model">
                  {t('model')}
                </label>
                <input id="ap-model" className={input} value={editing.form.model} onChange={(e) => set('model', e.target.value)} maxLength={80} />
              </div>
              <div>
                <label className={label} htmlFor="ap-serial">
                  {t('serialNumber')}
                </label>
                <input id="ap-serial" className={input} value={editing.form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} maxLength={80} />
              </div>
              <div>
                <label className={label} htmlFor="ap-room">
                  {t('room')}
                </label>
                <input id="ap-room" className={input} value={editing.form.room} onChange={(e) => set('room', e.target.value)} maxLength={60} placeholder={t('roomPlaceholder')} />
              </div>
              <div>
                <label className={label} htmlFor="ap-bought">
                  {t('purchasedOn')}
                </label>
                <input
                  id="ap-bought"
                  type="date"
                  className={input}
                  value={editing.form.purchasedOn}
                  onChange={(e) => {
                    const value = e.target.value
                    // Suggerisce la fine della garanzia se non c'è ancora
                    setEditing((x) => (x ? { ...x, form: { ...x.form, purchasedOn: value, warrantyUntil: x.form.warrantyUntil || (value ? legalWarrantyEnd(value) : '') } } : x))
                  }}
                />
              </div>
              <div>
                <label className={label} htmlFor="ap-price">
                  {t('price')}
                </label>
                <input id="ap-price" inputMode="decimal" className={input} value={editing.priceText} onChange={(e) => setEditing((x) => (x ? { ...x, priceText: e.target.value } : x))} placeholder="0,00" />
              </div>
              <div>
                <label className={label} htmlFor="ap-store">
                  {t('store')}
                </label>
                <input id="ap-store" className={input} value={editing.form.store} onChange={(e) => set('store', e.target.value)} maxLength={80} />
              </div>
              <div>
                <label className={label} htmlFor="ap-warranty">
                  {t('warrantyUntilField')}
                </label>
                <input id="ap-warranty" type="date" className={input} value={editing.form.warrantyUntil} onChange={(e) => set('warrantyUntil', e.target.value)} />
              </div>
            </div>
            <p className="-mt-2 text-xs text-[var(--muted)]">{t('warrantyHint')}</p>
            {/* Dove si trova: le posizioni di Findo (casa › stanza › mobile) */}
            {findoAvailable && (
              <div>
                <label className={label} htmlFor="ap-findo">
                  {t('findoLocation')}
                </label>
                {findoPlaces.length ? (
                  <select id="ap-findo" className={input} value={editing.form.findoLocationId ?? ''} onChange={(e) => set('findoLocationId', e.target.value || null)}>
                    <option value="">{t('findoNone')}</option>
                    {findoPlaces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.path.replace(/ > /g, ' › ')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded-xl bg-[var(--paper)] px-3 py-2 text-sm text-[var(--muted)]">
                    {t('findoEmpty')}{' '}
                    <Link href="/marketplace/findo/locations" className="font-bold text-[var(--gold)] hover:text-[var(--ink)]">
                      {t('findoCreate')}
                    </Link>
                  </p>
                )}
              </div>
            )}
            <div>
              <label className={label} htmlFor="ap-phone">
                {t('supportPhone')}
              </label>
              <input id="ap-phone" type="tel" className={input} value={editing.form.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} maxLength={40} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FileField
                homeId={homeId}
                labelText={t('receiptFile')}
                value={editing.form.receiptPath}
                url={editing.form.receiptPath ? fileUrls[editing.form.receiptPath] : null}
                onChange={(path) => set('receiptPath', path)}
              />
              <FileField
                homeId={homeId}
                labelText={t('manualFile')}
                value={editing.form.manualPath}
                url={editing.form.manualPath ? fileUrls[editing.form.manualPath] : null}
                onChange={(path) => set('manualPath', path)}
              />
            </div>
            <div>
              <label className={label} htmlFor="ap-notes">
                {t('notes')}
              </label>
              <textarea id="ap-notes" className={`${input} min-h-[70px]`} value={editing.form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={cancel} className={`${ghostBtn} flex-1`}>
                {t('cancel')}
              </button>
              <button type="submit" disabled={isPending} className={`${primaryBtn} flex-1`}>
                {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('save')}
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  )
}
