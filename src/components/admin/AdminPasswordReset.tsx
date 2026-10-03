'use client'

import { useState } from 'react'
import { KeyRound, LoaderCircle } from 'lucide-react'
import { adminSendPasswordReset } from '@/app/actions/password'
import { notify } from '@/lib/adminNotify'

// Admin → Gestisci Utente: invia al Kumano l'email con il codice per scegliere
// una nuova password. Lo Staff non vede né imposta la password.
export default function AdminPasswordReset({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!window.confirm('Inviare a questa persona l’email con il codice per scegliere una nuova password?')) return
    setBusy(true)
    const r = await adminSendPasswordReset(userId, 'it')
    setBusy(false)
    if (r.success) notify(`Codice inviato a ${r.email}. Va inserito in “Password dimenticata” → “Ho già ricevuto un codice”.`, 'success')
    else notify(r.error ?? 'Invio non riuscito.')
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
      <p className="mb-2 text-xs text-gray-500">Per chi non riesce più a entrare: riceve un’email con un codice. Poi va su «Password dimenticata», scrive la sua email e tocca «Ho già ricevuto un codice» per scegliere la nuova password.</p>
      <div className="flex gap-2">
        <button type="button" onClick={run} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Invia codice nuova password
        </button>
      </div>
    </div>
  )
}
