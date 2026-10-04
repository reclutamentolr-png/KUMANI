'use client'

import { notify } from '@/lib/adminNotify'
import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Check, LoaderCircle, MessageSquareQuote, Star, Undo2, X } from 'lucide-react'
import { listReviewsAdmin, moderateReview, type AdminReview } from '@/app/actions/reviews'
import type { RejectReason, ReviewStatus } from '@/lib/reviews'

// Motivi oggettivi di rifiuto (gli stessi spiegati nella pagina pubblica).
// Una recensione NON si rifiuta perché negativa: è vietato dal Codice del Consumo.
const REASONS: Record<RejectReason, string> = {
  offensive: 'Insulti o linguaggio offensivo',
  personal_data: 'Contiene dati personali',
  advertising: 'Pubblicità o link',
  off_topic: 'Non parla di KUMANI o del servizio',
  not_genuine: 'Non sembra un’esperienza reale',
  other: 'Altro motivo contrario alle regole',
}

const TABS: { id: ReviewStatus; label: string }[] = [
  { id: 'pending', label: 'Da approvare' },
  { id: 'approved', label: 'Pubblicate' },
  { id: 'rejected', label: 'Rifiutate' },
]

const LABEL: Record<string, string> = { base: 'Abbonato Base', pro: 'Abbonato Pro', pass: 'Pass del servizio' }

// Admin → Recensioni: approvazione delle recensioni di chi ha acquistato.
export default function ReviewsPanel() {
  const [tab, setTab] = useState<ReviewStatus>('pending')
  const [reviews, setReviews] = useState<AdminReview[] | null>(null)
  const [counts, setCounts] = useState<Record<ReviewStatus, number>>({ pending: 0, approved: 0, rejected: 0 })
  const [working, setWorking] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState<RejectReason>('offensive')

  const load = useCallback(async (status: ReviewStatus) => {
    const result = await listReviewsAdmin(status)
    if (!result) {
      notify('Non autorizzato')
      setReviews([])
      return
    }
    setReviews(result.reviews)
    setCounts(result.counts)
  }, [])

  useEffect(() => {
    // Caricamento dal server (setState asincrono, come gli altri pannelli)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
  }, [load, tab])

  const act = async (id: string, approve: boolean, why?: RejectReason) => {
    setWorking(id)
    const result = await moderateReview(id, approve, why)
    setWorking(null)
    setRejecting(null)
    if (!result.success) notify('Errore: ' + result.error)
    else notify(approve ? 'Recensione pubblicata' : 'Recensione rifiutata: l’autore è stato avvisato')
    await load(tab)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <MessageSquareQuote className="h-6 w-6 text-[var(--gold)]" /> Recensioni
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Le scrive solo chi ha acquistato (abbonamento Base/Pro o Pass, da almeno 7 giorni). Pubblica anche quelle negative: rifiuta solo per uno dei
          motivi elencati, che l’autore riceve con una notifica e può correggere.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${tab === item.id ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-400'}`}
          >
            {item.label} <span className="opacity-60">{counts[item.id]}</span>
          </button>
        ))}
      </div>

      {reviews === null ? (
        <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
      ) : reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">Nessuna recensione in questo elenco.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-4 w-4 ${n <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  ))}
                  <span className="ml-2 text-sm font-semibold text-gray-700">{review.subject === 'kumani' ? 'KUMANI in generale' : review.subject}</span>
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(review.updated_at).toLocaleString('it-IT')} · lingua {review.locale.toUpperCase()}
                </span>
              </div>
              {review.title && <p className="mt-2 font-bold text-gray-900">{review.title}</p>}
              <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{review.body}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                <span>
                  Pubblicata come <strong>{review.display_name}</strong>
                </span>
                <span>
                  {[review.author?.first_name, review.author?.last_name].filter(Boolean).join(' ')} · {review.author?.email}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <BadgeCheck className="h-3.5 w-3.5" /> {LABEL[review.purchase_label] ?? review.purchase_label}
                </span>
                {review.reject_reason && <span className="font-semibold text-red-600">Rifiutata: {REASONS[review.reject_reason]}</span>}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {review.status !== 'approved' && (
                  <button
                    type="button"
                    disabled={working === review.id}
                    onClick={() => act(review.id, true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" /> Approva e pubblica
                  </button>
                )}
                {review.status !== 'rejected' &&
                  (rejecting === review.id ? (
                    <>
                      <select value={reason} onChange={(e) => setReason(e.target.value as RejectReason)} className="rounded-lg border border-gray-300 px-2 py-2 text-sm">
                        {(Object.keys(REASONS) as RejectReason[]).map((key) => (
                          <option key={key} value={key}>
                            {REASONS[key]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={working === review.id}
                        onClick={() => act(review.id, false, reason)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        <X className="h-4 w-4" /> Conferma rifiuto
                      </button>
                      <button type="button" onClick={() => setRejecting(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
                        Annulla
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRejecting(review.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                    >
                      {review.status === 'approved' ? <Undo2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      {review.status === 'approved' ? 'Ritira' : 'Rifiuta'}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
