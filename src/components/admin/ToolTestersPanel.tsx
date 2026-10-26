'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserPlus, X } from 'lucide-react'
import AdminUserPicker from '@/components/admin/AdminUserPicker'
import { adminAddToolTester, adminListToolTesters, adminRemoveToolTester, type ToolTester } from '@/app/actions/adminToolTesters'
import type { StaffUserHit } from '@/app/actions/admin'
import { notify } from '@/lib/adminNotify'

// Admin → Servizi, servizio «Solo Staff»: iscritti scelti che lo provano in
// anteprima insieme allo Staff (ricevono un avviso con il link).
export default function ToolTestersPanel({ toolName }: { toolName: string }) {
  const [testers, setTesters] = useState<ToolTester[] | null>(null)
  const [picked, setPicked] = useState<StaffUserHit | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => adminListToolTesters(toolName).then(setTesters), [toolName])
  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    if (!picked) return
    setBusy(true)
    const result = await adminAddToolTester(toolName, picked.id)
    setBusy(false)
    if (!result.success) return notify('Errore: ' + (result.error ?? ''))
    notify('✅ Tester aggiunto: riceve un avviso con il link al servizio')
    setPicked(null)
    load()
  }

  const remove = async (tester: ToolTester) => {
    setBusy(true)
    const ok = await adminRemoveToolTester(toolName, tester.id)
    setBusy(false)
    if (!ok) return notify('Errore: tester non tolto')
    load()
  }

  return (
    <div className="mb-4 rounded-lg border border-violet-200 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Tester (oltre allo Staff)</p>
      <p className="mb-2 text-xs text-gray-500">Iscritti che possono aprire e usare il servizio in anteprima, anche senza il piano richiesto.</p>
      {testers === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : testers.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {testers.map((tester) => (
            <li key={tester.id} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs text-violet-900" title={tester.email ?? undefined}>
              {tester.name}
              <button type="button" disabled={busy} onClick={() => remove(tester)} className="rounded-full p-0.5 text-violet-700 hover:bg-violet-100" aria-label={`Togli ${tester.name}`}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-gray-400">Nessun tester: lo provano solo gli amministratori e lo Staff.</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <AdminUserPicker scope="testers" selected={picked} onSelect={setPicked} />
        </div>
        <button type="button" disabled={!picked || busy} onClick={add} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#7c3aed] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
          <UserPlus className="h-4 w-4" /> Aggiungi tester
        </button>
      </div>
    </div>
  )
}
