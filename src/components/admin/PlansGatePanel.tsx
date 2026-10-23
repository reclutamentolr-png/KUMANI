'use client'

import { useEffect, useState } from 'react'
import { BellRing, CalendarClock, LoaderCircle } from 'lucide-react'
import { adminGetPlansGate, adminNotifyPlanWaitlist, adminSavePlansGate } from '@/app/actions/adminPlansGate'
import type { PlansGate, PlansGateSettings } from '@/lib/plansGate'
import { notify } from '@/lib/adminNotify'

type Waitlist = { total: number; base: number; pro: number; notified: number }

// Admin → Apertura piani: prima del lancio KUMANI si usa gratis; «Abbonati»,
// «Passa a Pro» e l'anno da regalare mostrano la data di apertura e
// «Avvisami». Il giorno della data i piani si aprono da soli e la mattina
// parte l'avviso a chi è in lista (notifica ed email nella sua lingua).
export default function PlansGatePanel() {
  const [settings, setSettings] = useState<PlansGateSettings | null>(null)
  const [state, setState] = useState<PlansGate | null>(null)
  const [waitlist, setWaitlist] = useState<Waitlist | null>(null)
  const [busy, setBusy] = useState<'save' | 'notify' | null>(null)

  useEffect(() => {
    adminGetPlansGate().then((result) => {
      if ('error' in result) return notify('Errore: ' + result.error)
      setSettings(result.settings)
      setState(result.state)
      setWaitlist(result.waitlist)
    })
  }, [])

  if (!settings || !state || !waitlist) return <p className="text-sm text-gray-500">Caricamento…</p>

  const save = async () => {
    setBusy('save')
    const result = await adminSavePlansGate(settings)
    setBusy(null)
    if (!result.success) return notify('Errore: ' + result.error)
    setSettings(result.settings)
    setState(result.state)
    setWaitlist(result.waitlist)
    notify(result.state.closed ? 'Salvato: i piani sono chiusi fino alla data di apertura.' : 'Salvato: i piani sono aperti.', 'success')
  }

  const sendNow = async () => {
    setBusy('notify')
    const result = await adminNotifyPlanWaitlist()
    setBusy(null)
    if (!result.success) return notify('Errore: ' + result.error)
    setState(result.state)
    setWaitlist(result.waitlist)
    notify(`Avvisate ${result.notified} persone (${result.emails} email).`, 'success')
  }

  const pending = waitlist.total - waitlist.notified

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <CalendarClock className="h-7 w-7 text-[var(--gold)]" /> Apertura piani
        </h2>
        <p className="mt-1 text-gray-600">
          Prima del lancio KUMANI si usa gratis. Con «Piani in arrivo» acceso, «Abbonati», «Passa a Pro» e l&apos;anno di Plus o Pro da regalare
          mostrano la data di apertura e il pulsante «Avvisami» al posto del pagamento. Il giorno della data i piani si aprono da soli e la
          mattina parte l&apos;avviso a chi è in lista. Anche la prova gratuita del Pro parte solo dall’apertura. Pass dei singoli servizi e KUMANI Sorpresa restano acquistabili.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className={`rounded-full px-3 py-1 font-semibold ${state.closed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
          Oggi i piani sono {state.closed ? 'chiusi (in arrivo)' : 'aperti'}
        </span>
      </div>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="h-4 w-4 accent-[var(--gold)]" />
          Piani in arrivo (pagamenti degli abbonamenti chiusi fino alla data)
        </label>
        <label className="block text-sm text-gray-700">
          <span className="mb-1 block font-semibold">Data di apertura dei piani</span>
          <input
            type="date"
            value={settings.openDate}
            onChange={(e) => setSettings({ ...settings, openDate: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--ink-soft)] disabled:bg-gray-400"
          >
            {busy === 'save' && <LoaderCircle className="h-4 w-4 animate-spin" />} Salva
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <BellRing className="h-5 w-5 text-[var(--gold)]" /> Lista «Avvisami»
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {[
            { label: 'In lista', value: waitlist.total },
            { label: 'Volevano Plus', value: waitlist.base },
            { label: 'Volevano Pro', value: waitlist.pro },
            { label: 'Già avvisati', value: waitlist.notified },
          ].map((box) => (
            <div key={box.label} className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{box.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{box.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={sendNow}
            disabled={busy !== null || state.closed || pending === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {busy === 'notify' && <LoaderCircle className="h-4 w-4 animate-spin" />} Avvisa adesso ({pending})
          </button>
          <p className="text-xs text-gray-500">
            {state.closed ? 'Si può avvisare solo a piani aperti.' : 'Altrimenti l’avviso parte da solo domattina.'} Ogni persona viene avvisata una volta sola.
          </p>
        </div>
      </section>
    </div>
  )
}
