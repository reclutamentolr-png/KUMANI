'use client'

import { useState } from 'react'
import { LoaderCircle, UserPlus } from 'lucide-react'
import { adminAssignLateSponsor } from '@/app/actions/lateSponsor'
import { notify } from '@/lib/adminNotify'
import { askConfirm } from '@/lib/confirm'

// Admin → Gestisci Utente: assegna chi ha invitato una persona iscritta
// senza codice (anche dopo i 15 giorni), su richiesta del Kumano.
const ERRORS: Record<string, string> = {
  not_direct: 'Questa persona ha già un invitante: si può assegnare solo a chi si è iscritto senza codice.',
  already: 'L’invitante è già stato assegnato una volta.',
  has_team: 'Sotto questa persona ci sono già altri iscritti: non si può spostare.',
  invalid_code: 'Codice invito non valido o account non attivo.',
  self: 'Non si può indicare il codice della persona stessa.',
  forbidden: 'Non autorizzato.',
}

export default function AdminLateSponsor({ userId }: { userId: string }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    const clean = code.trim().toUpperCase()
    if (!clean) return
    if (!(await askConfirm(`Spostare questa persona nella stella del Kumano con codice ${clean}? Si può fare una sola volta.`))) return
    setBusy(true)
    const r = await adminAssignLateSponsor(userId, clean)
    setBusy(false)
    if (r.success) {
      notify(`Fatto: ora è nella stella di ${r.sponsorName ?? clean}. Eventuali KU Points dell’attivazione sono stati assegnati.`, 'success')
      setCode('')
    } else notify(ERRORS[r.code] ?? 'Operazione non riuscita.')
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Assegna chi l’ha invitato</label>
      <p className="mb-2 text-xs text-gray-500">Solo per chi si è iscritto senza codice e non ha ancora persone sotto di sé. Anche dopo i 15 giorni.</p>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Codice invito del Kumano" className="flex-1 rounded-lg border border-gray-300 p-2 text-sm uppercase" />
        <button type="button" onClick={run} disabled={busy || !code.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Assegna
        </button>
      </div>
    </div>
  )
}
