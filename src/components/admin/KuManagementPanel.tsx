'use client'

import { notify } from '@/lib/adminNotify'
import { useEffect, useState } from 'react'
import { Coins, Sparkles, Unlock, Award, Ticket, Repeat, Save, LoaderCircle, Info } from 'lucide-react'
import { getKuManagement, updateKuFeature, updateKuUnlock } from '@/app/actions/admin'
import type { KuFeatureKey, KuFeatureRow, KuUnlockRow } from '@/lib/ku'
import KuActivityPointsTable from '@/components/admin/KuActivityPointsTable'

type Stats = {
  byKind: Record<string, { count: number; ku: number; points: number; discountEur: number }>
  unlockOwners: Record<string, number>
  monthStart: string
}

// Nome leggibile degli sblocchi del catalogo (chiavi implementate nel codice).
const UNLOCK_LABELS: Record<string, string> = {
  linkinbio_premium_themes: 'Link in Bio — pacchetto dei 3 temi (vecchio, disattivato: chi l’ha comprato li conserva)',
  linkinbio_theme_aurora: 'Link in Bio — tema Aurora',
  linkinbio_theme_notte: 'Link in Bio — tema Notte dorata',
  linkinbio_theme_tramonto: 'Link in Bio — tema Tramonto',
}

// Descrizioni dettagliate: servono a capire, anche a distanza di tempo,
// come funziona ogni metodo prima di attivarlo o cambiarne i valori.
const DESCRIPTIONS: Record<KuFeatureKey, { title: string; icon: typeof Coins; paragraphs: string[] }> = {
  showcase: {
    title: '1. Vetrina annunci pagabile in KU Karma',
    icon: Sparkles,
    paragraphs: [
      "COSA FA — In Bacheca, sul proprio annuncio, il pulsante \"Metti in vetrina\" offre oltre al pagamento in KU Points anche quello in KU Karma. L'annuncio in vetrina compare in evidenza per 7 o 15 giorni.",
      'COME FUNZIONA — I costi in KU Karma sono quelli impostati qui sotto (uno per 7 giorni, uno per 15). Se l\'annuncio è già in vetrina, i giorni acquistati si sommano a quelli che restano. I KU Karma vengono scalati in modo atomico: se non bastano, la vetrina non parte e non si perde nulla.',
      "DOVE LO VEDE L'UTENTE — Bacheca → I miei annunci → \"Metti in vetrina\": compaiono i pulsanti \"7 giorni · X KU Karma\" e \"15 giorni · X KU Karma\" accanto a quelli in KU Points.",
      'COSTO PER KUMANI — Zero: la vetrina è uno spazio già esistente. Il prezzo in KU Points (impostazioni generali) resta disponibile in parallelo.',
      'QUANDO USARLO — Per dare subito un secondo uso concreto ai KU Karma di chi pubblica annunci. Consigliato come primo metodo da attivare.',
    ],
  },
  unlocks: {
    title: '2. Sblocchi extra negli strumenti',
    icon: Unlock,
    paragraphs: [
      "COSA FA — Catalogo di contenuti extra acquistabili una sola volta con i KU Karma (lo sblocco resta per sempre a chi lo compra). Ogni voce del catalogo corrisponde a un contenuto già realizzato nel codice dello strumento.",
      'COME FUNZIONA — Qui sotto per ogni sblocco si decide costo e disponibilità. Se l\'intero metodo è spento o la singola voce è disattivata, nessuno può più acquistarla; chi l\'ha già acquistata la conserva comunque.',
      "DOVE LO VEDE L'UTENTE — Portafoglio → \"Usa i tuoi KU Karma\" → Sblocchi; e dentro lo strumento (es. in Link in Bio i temi speciali compaiono con il lucchetto finché non vengono sbloccati).",
      'SBLOCCHI DISPONIBILI OGGI — Link in Bio: 3 temi speciali (Aurora, Notte dorata, Tramonto). Nuovi sblocchi (es. disegni extra del Mandala, suoni di Neurobalance, modelli di preventivo) richiedono di realizzare il contenuto nello strumento: una volta fatto, la voce comparirà in questo elenco.',
      'COSTO PER KUMANI — Zero: sono contenuti digitali.',
    ],
  },
  badges: {
    title: '3. Badge di costanza',
    icon: Award,
    paragraphs: [
      "COSA FA — Riconoscimento pubblico per chi usa KUMANI con costanza: al raggiungimento delle soglie di KU Karma guadagnati IN TOTALE (non il saldo, quindi spendere i KU Karma non fa perdere il badge) si ottiene un badge.",
      "COME FUNZIONA — I livelli e le soglie si impostano qui sotto (es. \"costante\" a 500 KU Karma, \"pilastro\" a 2.000). Il totale cresce a ogni punto guadagnato: accesso giornaliero, uso degli strumenti, accrediti manuali dell'admin. Per chi era già iscritto il totale iniziale è stimato come saldo attuale + KU Karma spesi in annunci.",
      "DOVE LO VEDE L'UTENTE — In dashboard accanto ai KU Karma e nel Portafoglio, con la barra di avanzamento verso il livello successivo.",
      'COSTO PER KUMANI — Zero.',
      "NOTA — Il nome visualizzato dei livelli \"costante\" e \"pilastro\" è tradotto nelle 7 lingue. Un livello con una chiave nuova viene mostrato con la chiave stessa finché non si aggiunge la traduzione.",
    ],
  },
  renewal_discount: {
    title: '4. Sconto sul rinnovo dell\'abbonamento',
    icon: Ticket,
    paragraphs: [
      "COSA FA — L'utente converte KU Karma in uno sconto in euro sul prossimo rinnovo annuale del suo abbonamento.",
      "COME FUNZIONA — Al click, i KU Karma vengono scalati e KUMANI applica automaticamente all'abbonamento Stripe dell'utente un coupon \"una tantum\" pari allo sconto impostato: vale sul prossimo addebito. Se Stripe non risponde o l'abbonamento non si trova, i KU Karma vengono restituiti. Limite: il numero massimo di sconti per utente in 365 giorni impostato qui sotto.",
      "CHI PUÒ USARLO — Solo chi ha un abbonamento Stripe attivo con rinnovo automatico (non chi è attivo tramite voucher o attivazione admin, perché non c'è un addebito futuro da scontare).",
      "DOVE LO VEDE L'UTENTE — Portafoglio → \"Usa i tuoi KU Karma\" → Sconto sul rinnovo.",
      'COSTO PER KUMANI — Lo sconto in euro, al massimo (sconto × limite annuale) per utente all\'anno. Esempio: 5 € una volta l\'anno.',
      "QUANDO USARLO — Come leva per trattenere gli utenti vicino alla scadenza. Lo sconto applicato si vede anche nel pannello Stripe (coupon \"KUMANI - sconto rinnovo KU Karma\").",
    ],
  },
  conversion: {
    title: '5. Conversione KU Karma → KU Points',
    icon: Repeat,
    paragraphs: [
      'COSA FA — I KU Karma si convertono in KU Points, che servono per i pacchetti voucher e per la vetrina annunci.',
      "COME FUNZIONA — Tasso: \"KU Karma per 1 KU Point\" (es. 20 KU Karma = 1 KU Point). Tetto: massimo \"KU Points al mese\" per utente (mese solare, ora italiana). Oltre il tetto la conversione viene rifiutata fino al mese successivo.",
      "ATTENZIONE — Con il pacchetto base 294 KU Points danno 49 € di credito voucher. Con 20 KU Karma = 1 KU Point e tetto 5 KU Points/mese, un utente molto attivo ottiene al massimo 60 KU Points l'anno. Tenere il tetto basso. I punti convertiti non contano per i badge Kuman Green/Star/Black. Anche i KU Karma accreditati a mano dall'admin diventano convertibili.",
      "DOVE LO VEDE L'UTENTE — Portafoglio → \"Usa i tuoi KU Karma\" → Converti in KU Points, con il tetto residuo del mese.",
      'COSTO PER KUMANI — Indiretto: abbonamenti o premi riscattati con i KU Points ottenuti.',
    ],
  },
}

const inputClass = 'w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none text-sm'

export default function KuManagementPanel() {
  const [features, setFeatures] = useState<KuFeatureRow[]>([])
  const [unlocks, setUnlocks] = useState<KuUnlockRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [openInfo, setOpenInfo] = useState<Record<string, boolean>>({})

  // Il primo caricamento mostra lo spinner (loading parte da true); dopo un
  // salvataggio i dati si aggiornano senza togliere la pagina.
  const load = async () => {
    const result = await getKuManagement()
    setFeatures(result.features as KuFeatureRow[])
    setUnlocks(result.unlocks as KuUnlockRow[])
    setStats(result.stats as Stats | null)
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  const setConfig = (key: string, patch: Record<string, unknown>) =>
    setFeatures((prev) => prev.map((f) => (f.key === key ? { ...f, config: { ...f.config, ...patch } } : f)))
  const setEnabled = (key: string, enabled: boolean) =>
    setFeatures((prev) => prev.map((f) => (f.key === key ? { ...f, enabled } : f)))

  const save = async (feature: KuFeatureRow) => {
    setSavingKey(feature.key)
    const result = await updateKuFeature(feature.key, feature.enabled, feature.config)
    setSavingKey(null)
    if (result.success) {
      await load()
      notify('Le modifiche sono state salvate.', 'success')
    } else {
      notify('❌ ' + (result.error || 'Errore'))
    }
  }

  const saveUnlock = async (unlock: KuUnlockRow) => {
    setSavingKey(unlock.key)
    const result = await updateKuUnlock(unlock.key, unlock.cost_ku, unlock.enabled)
    setSavingKey(null)
    if (!result.success) notify('❌ ' + (result.error || 'Errore'))
    else await load()
  }

  if (loading) return <p className="text-gray-400">Caricamento...</p>

  const numberField = (feature: KuFeatureRow, field: string, label: string, suffix?: string) => (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={Number(feature.config[field] ?? 0)}
          onChange={(e) => setConfig(feature.key, { [field]: parseInt(e.target.value, 10) || 0 })}
          className={inputClass}
        />
        {suffix && <span className="text-xs text-gray-500 whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  )

  const monthLabel = stats ? new Date(stats.monthStart).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) : ''
  const statLine = (feature: KuFeatureRow): string => {
    const s = stats?.byKind
    switch (feature.key) {
      case 'showcase':
        return `${s?.showcase?.count ?? 0} vetrine pagate in KU Karma · ${s?.showcase?.ku ?? 0} KU Karma spesi`
      case 'unlocks':
        return `${s?.unlock?.count ?? 0} sblocchi acquistati questo mese · ${s?.unlock?.ku ?? 0} KU Karma spesi`
      case 'badges':
        return 'Nessun costo: i badge si calcolano dai KU Karma guadagnati in totale.'
      case 'renewal_discount':
        return `${s?.renewal_discount?.count ?? 0} sconti applicati · ${s?.renewal_discount?.discountEur ?? 0} € di sconto totale`
      case 'conversion':
        return `${s?.conversion?.count ?? 0} conversioni · ${s?.conversion?.ku ?? 0} KU Karma → ${s?.conversion?.points ?? 0} KU Points`
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Coins className="w-7 h-7" /> Gestione KU
        </h2>
        <p className="text-gray-600 mt-1">
          Nuovi usi dei KU Karma, attivabili uno alla volta come incentivo. Tutti partono spenti. Apri &quot;Come
          funziona&quot; su ogni scheda per la descrizione completa. Statistiche del mese: {monthLabel}.
        </p>
      </div>

      <KuActivityPointsTable />

      {features.map((feature) => {
        const info = DESCRIPTIONS[feature.key]
        if (!info) return null
        const Icon = info.icon
        const levels = (feature.config.levels as { key: string; threshold: number }[] | undefined) ?? []
        return (
          <div key={feature.key} className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Icon className="w-5 h-5 text-[var(--gold)]" /> {info.title}
              </h3>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className={`text-sm font-semibold ${feature.enabled ? 'text-green-700' : 'text-gray-500'}`}>
                  {feature.enabled ? 'Attivo' : 'Spento'}
                </span>
                <input
                  type="checkbox"
                  checked={feature.enabled}
                  onChange={(e) => setEnabled(feature.key, e.target.checked)}
                  className="h-5 w-5 accent-[var(--gold)]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => setOpenInfo((prev) => ({ ...prev, [feature.key]: !prev[feature.key] }))}
              className="text-sm font-semibold text-indigo-700 flex items-center gap-1"
            >
              <Info className="w-4 h-4" /> {openInfo[feature.key] ? 'Nascondi descrizione' : 'Come funziona'}
            </button>
            {openInfo[feature.key] && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
                {info.paragraphs.map((text) => (
                  <p key={text} className="text-sm text-gray-700 leading-relaxed">
                    {text}
                  </p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {feature.key === 'showcase' && (
                <>
                  {numberField(feature, 'cost_7d', 'Costo 7 giorni', 'KU Karma')}
                  {numberField(feature, 'cost_15d', 'Costo 15 giorni', 'KU Karma')}
                </>
              )}
              {feature.key === 'renewal_discount' && (
                <>
                  {numberField(feature, 'cost_ku', 'Costo', 'KU Karma')}
                  {numberField(feature, 'discount_eur', 'Sconto', '€')}
                  {numberField(feature, 'max_per_year', 'Massimo per utente', 'all\'anno')}
                </>
              )}
              {feature.key === 'conversion' && (
                <>
                  {numberField(feature, 'ku_per_point', 'KU Karma per 1 KU Point', 'KU Karma')}
                  {numberField(feature, 'max_points_per_month', 'Tetto per utente', 'KU Points / mese')}
                </>
              )}
            </div>

            {feature.key === 'badges' && (
              <div className="space-y-2">
                {levels.map((level, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <label className="flex-1">
                      <span className="text-xs font-medium text-gray-600">Livello (chiave)</span>
                      <input
                        value={level.key}
                        onChange={(e) => {
                          const next = levels.map((l, i) => (i === index ? { ...l, key: e.target.value } : l))
                          setConfig(feature.key, { levels: next })
                        }}
                        className={inputClass}
                      />
                    </label>
                    <label className="w-40">
                      <span className="text-xs font-medium text-gray-600">Soglia (KU Karma totali)</span>
                      <input
                        type="number"
                        min={1}
                        value={level.threshold}
                        onChange={(e) => {
                          const next = levels.map((l, i) => (i === index ? { ...l, threshold: parseInt(e.target.value, 10) || 0 } : l))
                          setConfig(feature.key, { levels: next })
                        }}
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setConfig(feature.key, { levels: levels.filter((_, i) => i !== index) })}
                      className="px-3 py-2 text-xs text-red-600 hover:text-red-800"
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setConfig(feature.key, { levels: [...levels, { key: '', threshold: 0 }] })}
                  className="text-xs font-semibold text-indigo-700"
                >
                  + Aggiungi livello
                </button>
              </div>
            )}

            {feature.key === 'unlocks' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2 pr-3 font-medium">Sblocco</th>
                      <th className="py-2 pr-3 font-medium">Costo (KU Karma)</th>
                      <th className="py-2 pr-3 font-medium">Disponibile</th>
                      <th className="py-2 pr-3 font-medium">Utenti che lo hanno</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {unlocks.map((unlock) => (
                      <tr key={unlock.key} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-gray-800">{UNLOCK_LABELS[unlock.key] ?? unlock.key}</td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={1}
                            value={unlock.cost_ku}
                            onChange={(e) =>
                              setUnlocks((prev) => prev.map((u) => (u.key === unlock.key ? { ...u, cost_ku: parseInt(e.target.value, 10) || 0 } : u)))
                            }
                            className="w-24 p-1.5 border border-gray-300 rounded-lg text-sm"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="checkbox"
                            checked={unlock.enabled}
                            onChange={(e) => setUnlocks((prev) => prev.map((u) => (u.key === unlock.key ? { ...u, enabled: e.target.checked } : u)))}
                            className="h-4 w-4 accent-[var(--gold)]"
                          />
                        </td>
                        <td className="py-2 pr-3 text-gray-600">{stats?.unlockOwners[unlock.key] ?? 0}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => saveUnlock(unlock)}
                            disabled={savingKey === unlock.key}
                            className="text-xs font-semibold text-indigo-700 disabled:opacity-50"
                          >
                            Salva voce
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-xs text-gray-500">{statLine(feature)}</p>
              <button
                type="button"
                onClick={() => save(feature)}
                disabled={savingKey === feature.key}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--ink)] text-white text-sm font-semibold disabled:opacity-50"
              >
                {savingKey === feature.key ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salva
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
