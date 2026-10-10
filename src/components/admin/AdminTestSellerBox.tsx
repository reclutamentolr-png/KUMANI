'use client'

import { useState } from 'react'
import { LoaderCircle, Store } from 'lucide-react'
import { adminCreateTestSeller } from '@/app/actions/adminShopTest'

// Admin → Impostazioni: conto venditore di prova per KUMANI Shop (solo con
// Stripe in modalità test), per mostrare o provare lo Shop senza registrarsi
export default function AdminTestSellerBox({ input }: { input: string }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const create = async () => {
    setBusy(true)
    setNotice(null)
    const r = await adminCreateTestSeller(email)
    setBusy(false)
    setNotice(
      r.success
        ? { ok: true, text: `Conto di prova ${r.account} collegato a ${r.email}. Stripe lo attiva in circa mezzo minuto: poi in KUMANI Shop → Pagamenti risulta attivo e si può aprire il negozio e pagare con la carta 4242 4242 4242 4242.` }
        : { ok: false, text: r.error }
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Store className="h-4 w-4" /> KUMANI Shop: conto venditore di prova
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Solo con Stripe in modalità test. Collega al Kumano un conto Stripe di prova già pronto (dati di test di Stripe), così può aprire il negozio e provare un acquisto senza registrarsi su Stripe. Sostituisce l’eventuale conto già collegato.
      </p>
      <div className="mt-2 flex max-w-xl flex-wrap gap-2">
        <input type="email" value={email} placeholder="Email del Kumano" onChange={(e) => setEmail(e.target.value)} className={`min-w-0 flex-1 ${input}`} />
        <button type="button" onClick={create} disabled={busy || !email.trim()} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Crea conto di prova
        </button>
      </div>
      {notice && <p className={`mt-2 text-xs ${notice.ok ? 'text-emerald-700' : 'text-red-600'}`}>{notice.text}</p>}
    </div>
  )
}
