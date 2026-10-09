'use client'

import { useEffect, useState } from 'react'
import { Cookie, LoaderCircle } from 'lucide-react'
import { notify } from '@/lib/adminNotify'
import { askConfirm } from '@/lib/confirm'
import { ALL_CONSENT_CATEGORIES, type ConsentCategory, type ConsentConfig } from '@/lib/consent'
import { adminGetCookieConsent, adminSetCookieConsent } from '@/app/actions/adminConsent'

const LABELS: Record<ConsentCategory, { title: string; text: string }> = {
  analytics: { title: 'Statistiche', text: 'Per strumenti come Google Analytics o simili (non anonimi).' },
  marketing: { title: 'Marketing', text: 'Per pixel e pubblicità: Meta, TikTok, Google Ads, LinkedIn…' },
}

function Switch({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// Admin → Impostazioni: banner dei cookie. Interruttore generale (acceso da
// solo = avviso «usiamo solo cookie tecnici» con «Ho capito») e, sotto, le
// categorie facoltative che trasformano l'avviso nel banner del consenso.
export default function CookieConsentSettings() {
  const [config, setConfig] = useState<ConsentConfig | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminGetCookieConsent().then((r) => {
      if (r.error) notify('Errore: ' + r.error)
      setConfig(r.config)
    })
  }, [])

  const save = async (next: ConsentConfig, message: string) => {
    setSaving(true)
    const result = await adminSetCookieConsent(next)
    setSaving(false)
    if (!result.success) return notify('Errore: ' + result.error)
    setConfig(result.config)
    notify(message)
  }

  const toggleBanner = async () => {
    if (!config) return
    if (config.enabled && config.categories.length) {
      const ok = await askConfirm(
        'Spegnere il banner? Si spengono anche Statistiche e Marketing: gli strumenti collegati al consenso smettono di funzionare per tutti. Se uno strumento è caricato senza ConsentGate, toglilo prima.'
      )
      if (!ok) return
    }
    await save({ enabled: !config.enabled, categories: [] }, config.enabled ? 'Banner cookie spento' : 'Banner cookie acceso (avviso informativo)')
  }

  const toggleCategory = async (category: ConsentCategory) => {
    if (!config?.enabled) return
    const on = !config.categories.includes(category)
    if (
      on &&
      !(await askConfirm(
        `Chiedere il consenso per «${LABELS[category].title}»? Fallo solo se sul sito c'è davvero uno strumento di questo tipo, collegato al consenso: chiedere il consenso per cookie che non esistono è scorretto, e uno strumento attivo senza consenso è vietato.`
      ))
    )
      return
    const categories = on ? [...config.categories, category] : config.categories.filter((c) => c !== category)
    await save({ enabled: true, categories }, on ? `${LABELS[category].title}: consenso richiesto` : `${LABELS[category].title}: tolto`)
  }

  const status = !config
    ? ''
    : !config.enabled
      ? 'Spento: nessun banner.'
      : config.categories.length
        ? 'Acceso: banner del consenso (Accetta / Rifiuta / Personalizza) e link «Preferenze cookie» nel piè di pagina.'
        : 'Acceso: avviso informativo «usiamo solo cookie tecnici» con il pulsante «Ho capito».'

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
        <Cookie className="h-5 w-5 text-[var(--gold)]" /> Banner cookie
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        Con i soli cookie tecnici per legge il banner non serve, ma puoi mostrare comunque un avviso informativo. Statistiche e Marketing si accendono solo
        quando aggiungi uno strumento di quel tipo: il banner diventa quello del consenso. Ricordati di aggiornare anche l&apos;elenco dei cookie
        nell&apos;informativa privacy.
      </p>
      {config === null ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Caricamento…
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-gray-300 px-4 py-3">
            <div>
              <p className="font-bold text-gray-900">Mostra il banner dei cookie</p>
              <p className="text-xs text-gray-500">Interruttore generale</p>
            </div>
            <Switch on={config.enabled} label="Banner cookie" disabled={saving} onClick={toggleBanner} />
          </div>
          <div className={`space-y-2 pl-4 ${config.enabled ? '' : 'opacity-50'}`}>
            {ALL_CONSENT_CATEGORIES.map((c) => (
              <div key={c} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-900">{LABELS[c].title}</p>
                  <p className="text-xs text-gray-500">{LABELS[c].text}</p>
                </div>
                <Switch on={config.categories.includes(c)} label={LABELS[c].title} disabled={saving || !config.enabled} onClick={() => toggleCategory(c)} />
              </div>
            ))}
            {!config.enabled && <p className="text-xs text-gray-500">Accendi prima il banner per scegliere le categorie.</p>}
          </div>
          <p className="pt-1 text-sm">
            Stato: <strong className={config.enabled ? 'text-emerald-700' : 'text-gray-700'}>{status}</strong>
          </p>
        </div>
      )}
    </div>
  )
}
