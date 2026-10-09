'use client'

import { useEffect, useState } from 'react'
import { Cookie, LoaderCircle } from 'lucide-react'
import { notify } from '@/lib/adminNotify'
import { askConfirm } from '@/lib/confirm'
import { ALL_CONSENT_CATEGORIES, type ConsentCategory } from '@/lib/consent'
import { adminGetCookieConsent, adminSetCookieConsent } from '@/app/actions/adminConsent'

const LABELS: Record<ConsentCategory, { title: string; text: string }> = {
  analytics: { title: 'Statistiche', text: 'Per strumenti come Google Analytics o simili (non anonimi).' },
  marketing: { title: 'Marketing', text: 'Per pixel e pubblicità: Meta, TikTok, Google Ads, LinkedIn…' },
}

// Admin → Impostazioni: interruttori del banner dei cookie facoltativi. Spenti
// = nessun banner (KUMANI oggi usa solo cookie tecnici). Si accende una
// categoria solo quando sul sito c'è davvero uno strumento di quel tipo.
export default function CookieConsentSettings() {
  const [active, setActive] = useState<ConsentCategory[] | null>(null)
  const [saving, setSaving] = useState<ConsentCategory | null>(null)

  useEffect(() => {
    adminGetCookieConsent().then((r) => {
      if (r.error) notify('Errore: ' + r.error)
      setActive(r.categories)
    })
  }, [])

  const toggle = async (category: ConsentCategory) => {
    if (!active) return
    const on = !active.includes(category)
    if (
      on &&
      !(await askConfirm(
        `Accendere il banner per «${LABELS[category].title}»? Fallo solo se sul sito c'è davvero uno strumento di questo tipo, collegato al consenso: chiedere il consenso per cookie che non esistono è scorretto, e uno strumento attivo senza consenso è vietato.`
      ))
    )
      return
    setSaving(category)
    const next = on ? [...active, category] : active.filter((c) => c !== category)
    const result = await adminSetCookieConsent(next)
    setSaving(null)
    if (!result.success) return notify('Errore: ' + result.error)
    setActive(result.categories)
    notify(on ? `Banner acceso per ${LABELS[category].title}` : `${LABELS[category].title}: spento`)
  }

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
        <Cookie className="h-5 w-5 text-[var(--gold)]" /> Cookie facoltativi (banner del consenso)
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        Oggi KUMANI usa solo cookie tecnici: per legge non serve il banner. Accendi una categoria solo quando aggiungi uno strumento di quel tipo; da quel
        momento a chi visita il sito compare il banner (Accetta / Rifiuta / Personalizza) e nel piè di pagina il link «Preferenze cookie». Ricordati di
        aggiornare anche l&apos;elenco dei cookie nell&apos;informativa privacy.
      </p>
      {active === null ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Caricamento…
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {ALL_CONSENT_CATEGORIES.map((c) => {
            const on = active.includes(c)
            return (
              <div key={c} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-900">{LABELS[c].title}</p>
                  <p className="text-xs text-gray-500">{LABELS[c].text}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={LABELS[c].title}
                  disabled={saving !== null}
                  onClick={() => toggle(c)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            )
          })}
          <p className="text-xs text-gray-500">
            Stato: {active.length ? <strong className="text-emerald-700">banner acceso</strong> : <strong>banner spento</strong>}
          </p>
        </div>
      )}
    </div>
  )
}
