'use client'

import { notify } from '@/lib/adminNotify'
import { useCallback, useEffect, useState } from 'react'
import { Check, ExternalLink, ImageOff, LoaderCircle, Megaphone, X } from 'lucide-react'
import { listShowcaseAdmin, moderateShowcase, type AdminShowcaseItem } from '@/app/actions/kordataShowcase'
import { convivioPhotoUrl, savingPercent, SHOWCASE_REJECT_REASONS, type ShowcaseRejectReason } from '@/lib/convivio'

const REASON_LABEL: Record<ShowcaseRejectReason, string> = {
  photo: 'Foto non adatta',
  description: 'Titolo o descrizione non adatti',
  price: 'Prezzo al pubblico non credibile',
  other: 'Non rispetta le regole',
}

const STATUS_LABEL: Record<AdminShowcaseItem['showcase_status'], string> = {
  requested: 'Da approvare',
  approved: 'In vetrina',
  rejected: 'Rifiutata',
  removed: 'Tolta',
}

const euro = (value: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
const date = (value: string | null) => (value ? new Date(value).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

// Admin → Kordata → Vetrina homepage: richieste di capocordata e fornitori.
// In homepage compaiono al massimo 3 lotti approvati (i più recenti), e solo
// finché sono aperti e sotto il minimo.
export default function KordataShowcasePanel({ locale }: { locale: string }) {
  const [items, setItems] = useState<AdminShowcaseItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<{ id: string; action: 'reject' | 'remove'; reason: ShowcaseRejectReason | '' } | null>(null)

  const load = useCallback(async () => {
    const result = await listShowcaseAdmin()
    setItems(result.items)
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono, come ConvivioReportsPanel).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const act = async (id: string, action: 'approve' | 'reject' | 'remove', reason?: ShowcaseRejectReason) => {
    setWorking(id)
    const result = await moderateShowcase(id, action, reason)
    setWorking(null)
    if (!result.success) notify('Errore: ' + result.error)
    setRejecting(null)
    await load()
  }

  const visible = (items ?? []).filter((item) => item.showcase_status === 'approved' && item.eligible).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Megaphone className="h-6 w-6 text-amber-500" /> Kordata — vetrina in homepage
        </h2>
        <p className="mt-1 text-gray-600">
          Capocordata e fornitori chiedono di mostrare un lotto nella homepage. In homepage compaiono al massimo 3 lotti approvati (gli ultimi
          approvati), e solo finché sono aperti, con fornitore KUMANI confermato e sotto il numero minimo di aderenti. Controlla foto, titolo e
          prezzo al pubblico indicato: chi chiede riceve l’esito con una notifica.
        </p>
        <p className="mt-2 text-sm font-semibold text-gray-800">Ora in homepage: {Math.min(visible, 3)} di 3{visible > 3 ? ` (altri ${visible - 3} approvati in attesa di posto)` : ''}</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {items === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nessuna richiesta.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const photo = convivioPhotoUrl(item.photo_path)
            const saving = savingPercent(item)
            return (
              <div
                key={item.id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${item.showcase_status === 'requested' ? 'border-amber-300' : item.showcase_status === 'approved' ? 'border-emerald-300' : 'border-gray-200 opacity-75'}`}
              >
                <div className="flex flex-wrap gap-4">
                  <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {photo ? (
                      <a href={photo} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt="" className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-gray-400">
                        <ImageOff className="h-5 w-5" /> Senza foto
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                      {item.title}
                      <a href={`/${locale}/convivio/${item.id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.showcase_status === 'requested' ? 'bg-amber-100 text-amber-800' : item.showcase_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {STATUS_LABEL[item.showcase_status]}
                      </span>
                      {!item.eligible && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">Non più adatta (chiusa, scaduta o minimo raggiunto)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      Capocordata {item.leader_full_name || '—'} ({item.leader_email ?? '—'}) · fornitore {item.supplier_name}
                      {item.requested_by_supplier ? ' · richiesta dal fornitore' : ''}
                    </p>
                    <p className="mt-1 text-xs text-gray-700">
                      {euro(item.group_price)}
                      {item.unit_label ? ` / ${item.unit_label}` : ''}
                      {item.retail_price ? ` · al pubblico ${euro(item.retail_price)}${saving ? ` (−${saving}%)` : ''}` : ''} · {item.people}/{item.min_participants} aderenti · scade{' '}
                      {date(item.expires_at)}
                    </p>
                    {item.description && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-gray-600">{item.description}</p>}
                    <p className="mt-1 text-[11px] text-gray-400">
                      Richiesta {date(item.showcase_requested_at)}
                      {item.showcase_reviewed_at ? ` · esito ${date(item.showcase_reviewed_at)}` : ''}
                      {item.showcase_reason ? ` · motivo: ${REASON_LABEL[item.showcase_reason]}` : ''}
                    </p>
                  </div>
                </div>

                {rejecting?.id === item.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                    <select
                      value={rejecting.reason}
                      onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value as ShowcaseRejectReason })}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Motivo…</option>
                      {SHOWCASE_REJECT_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {REASON_LABEL[reason]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!rejecting.reason || working === item.id}
                      onClick={() => act(item.id, rejecting.action, rejecting.reason as ShowcaseRejectReason)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {rejecting.action === 'reject' ? 'Rifiuta' : 'Togli dalla vetrina'}
                    </button>
                    <button type="button" onClick={() => setRejecting(null)} className="px-2 py-1.5 text-sm text-gray-500">
                      Annulla
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                    {item.showcase_status !== 'approved' && (
                      <button
                        type="button"
                        disabled={working === item.id}
                        onClick={() => act(item.id, 'approve')}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" /> Approva
                      </button>
                    )}
                    {item.showcase_status === 'requested' && (
                      <button
                        type="button"
                        onClick={() => setRejecting({ id: item.id, action: 'reject', reason: '' })}
                        className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" /> Rifiuta
                      </button>
                    )}
                    {item.showcase_status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => setRejecting({ id: item.id, action: 'remove', reason: '' })}
                        className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" /> Togli dalla vetrina
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
