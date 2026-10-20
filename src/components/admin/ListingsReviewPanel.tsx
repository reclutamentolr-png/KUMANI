'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, LoaderCircle, MapPin, ShieldCheck, XCircle } from 'lucide-react'
import { adminGetListingsReview, adminReviewListing, adminSetListingsFreeMode, type PendingListing } from '@/app/actions/adminListingsReview'
import { askConfirm } from '@/lib/confirm'

// Admin → Bacheca: «Bacheca libera» (pubblicare senza KU Karma) e annunci da
// controllare prima che compaiano. Gli annunci arrivano qui sia con la
// Bacheca libera sia senza: il controllo dello Staff c'è sempre.
export default function ListingsReviewPanel() {
  const [free, setFree] = useState<boolean | null>(null)
  const [pending, setPending] = useState<PendingListing[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await adminGetListingsReview()
    if ('error' in r) return setError(r.error)
    setFree(r.free)
    setPending(r.pending)
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento della sezione
    load()
  }, [load])

  const toggle = async () => {
    const next = !free
    if (!(await askConfirm(next ? 'Accendere la Bacheca libera? Pubblicare un annuncio diventa gratis (niente KU Karma). Il controllo dello Staff resta.' : 'Spegnere la Bacheca libera? Pubblicare tornerà a costare i KU Karma. Il controllo dello Staff resta.'))) return
    setBusy('toggle')
    const r = await adminSetListingsFreeMode(next)
    setBusy(null)
    if (!r.success) return setError(r.error ?? 'Errore')
    setFree(next)
  }

  const review = async (id: string, approve: boolean) => {
    setBusy(id)
    setError(null)
    const r = await adminReviewListing(id, approve, notes[id] ?? '')
    setBusy(null)
    if (!r.success) return setError(r.error ?? 'Errore')
    setRejecting(null)
    setPending((list) => list.filter((l) => l.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Interruttore */}
      <div className="flex flex-col gap-3 rounded-xl border-2 border-[var(--gold)]/50 bg-gradient-to-br from-[var(--gold-pale)]/60 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-gray-900">Bacheca libera</p>
          <p className="mt-0.5 text-sm text-gray-600">
            Accesa: pubblicare un annuncio è <strong>gratis</strong>, senza KU Karma. Spenta: costa i KU Karma di sempre. In tutti e due i casi ogni
            annuncio compare solo dopo il vostro controllo, e in Bacheca c&apos;è scritto «Tutti gli annunci sono controllati dallo Staff».
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!free}
          disabled={free === null || busy === 'toggle'}
          onClick={toggle}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${free ? 'bg-emerald-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${free ? 'translate-x-7' : 'translate-x-1'}`} />
          <span className="sr-only">Bacheca libera</span>
        </button>
      </div>

      {/* Da controllare */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="flex items-center gap-2 font-bold text-gray-900">
          <ShieldCheck className="h-5 w-5 text-[var(--gold)]" /> Annunci da controllare
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pending.length ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{pending.length}</span>
        </p>
        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nessun annuncio in attesa.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((l) => (
              <li key={l.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex gap-4">
                  {l.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900">{l.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {l.author}
                      {l.authorEmail ? ` · ${l.authorEmail}` : ''} · {l.category}
                      {l.price !== null ? ` · ${l.price.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}` : ''} ·{' '}
                      {new Date(l.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}
                    </p>
                    {(l.city || l.countryCode) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="h-3 w-3" /> {[l.city, l.countryCode].filter(Boolean).join(', ')}
                        {l.isRemote ? ' · anche online' : ''}
                      </p>
                    )}
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{l.description}</p>
                  </div>
                </div>
                {rejecting === l.id && (
                  <textarea
                    value={notes[l.id] ?? ''}
                    onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })}
                    maxLength={300}
                    rows={2}
                    placeholder="Motivo (lo legge chi ha pubblicato), es. «Mancano dettagli sul servizio» o «Contenuto non consentito»"
                    className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                  />
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => review(l.id, true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy === l.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approva e pubblica
                  </button>
                  {rejecting === l.id ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => review(l.id, false)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" /> Conferma: non approvare
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRejecting(l.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" /> Non approvare…
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
