'use client'

import { useState } from 'react'
import { KeyRound, LoaderCircle } from 'lucide-react'
import { adminSendPasswordReset } from '@/app/actions/password'
import { notify } from '@/lib/adminNotify'

// Admin → Gestisci Utente: invia al Kumano il link per scegliere una nuova
// password. Lo Staff non vede né imposta la password.
const LANGUAGES = [
  ['it', 'Italiano'],
  ['en', 'English'],
  ['fr', 'Français'],
  ['es', 'Español'],
  ['pt', 'Português'],
  ['de', 'Deutsch'],
  ['ru', 'Русский'],
] as const

export default function AdminPasswordReset({ userId }: { userId: string }) {
  const [lang, setLang] = useState('it')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!window.confirm('Inviare a questa persona l’email con il link per scegliere una nuova password?')) return
    setBusy(true)
    const r = await adminSendPasswordReset(userId, lang)
    setBusy(false)
    if (r.success) notify(`Link inviato a ${r.email}.`, 'success')
    else notify(r.error ?? 'Invio non riuscito.')
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
      <p className="mb-2 text-xs text-gray-500">Per chi non riesce più a entrare: riceve un’email con il link per scegliere una nuova password. La lingua è quella della pagina che si apre dal link.</p>
      <div className="flex gap-2">
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg border border-gray-300 p-2 text-sm">
          {LANGUAGES.map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
        <button type="button" onClick={run} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Invia link nuova password
        </button>
      </div>
    </div>
  )
}
