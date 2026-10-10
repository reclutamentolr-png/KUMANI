'use client'

import { useState, useEffect } from 'react'
import { notify } from '@/lib/adminNotify'
import { createClient } from '@/lib/supabase/client'
import { adminSaveSystemSettings, adminGetPlanPrices, getHouseAccount, createHouseAccount } from '@/app/actions/admin'
import type { AdminHouseAccount, AdminSystemSettings } from '@/lib/adminTypes'
import {
  Coins,
  Users,
  GitBranch,
  Settings,
  ToggleLeft,
  ToggleRight,
  Save,
  BadgeCheck,
  Sparkles,
} from 'lucide-react'
import { askConfirm } from '@/lib/confirm'

// Sezione "settings" dell'Admin, caricata solo quando la si apre.

// Un solo stile per tutti i campi (numeri e testi): stessa grandezza del
// testo e stessi margini in ogni sezione
const INPUT =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]'
export default function AdminSettingsPanel() {
  const supabase = createClient()
  const [systemSettings, setSystemSettings] = useState<AdminSystemSettings>({
    maintenance_mode: false,
    maintenance_message: 'Sito in manutenzione. Torna presto!',
    matrix_slot_bonus_points: 0,
    matrix_spillover_bonus_points: 0,
    welcome_bonus_base: 1,
    welcome_bonus_pro: 10,
    welcome_bonus_from_direct: 6,
    activity_thanks_points: 0,
    pro_invite_extra_points: 0,
    network_points_activation_base: 10,
    network_points_activation_pro: 120,
    network_points_upgrade_pro: 110,
    qualifications: [
      { key: 'rising_star', activations: 6, points: 60, vouchers: 1 },
      { key: 'shining_star', activations: 36, points: 360, vouchers: 6 },
      { key: 'diamond_star', activations: 108, points: 1080, vouchers: 18 },
    ],
    black_plus_every: 6,
    voucher_value_base_eur: 49,
    voucher_value_pro_eur: 149,
    pro_trial_days: 15,
    affinity_intros_per_week: 3,
    listing_feature_cost_7d: 20,
    listing_feature_cost_15d: 35,
    menu_ai_daily_runs: 5,
    surprise_price_voucher_cents: 290,
    surprise_price_journey3_cents: 990,
    surprise_price_journey7_cents: 1590,
    surprise_karma_voucher: 300,
    surprise_karma_journey3: 1000,
    surprise_karma_journey7: 1600,
    surprise_kupoints_voucher: 18,
    surprise_kupoints_journey3: 60,
    surprise_kupoints_journey7: 96,
    veritas_write_seconds: 90,
    veritas_vote_seconds: 45,
    veritas_reveal_seconds: 15,
    verifoto_daily_user: 1,
    checkmail_daily_user: 10,
    scudo_dati_other_cost: 3,
    scudo_dati_daily_cap: 90,
    verifoto_monthly_ops: 1800,
    mosaic_pixels_day: 3,
    mosaic_bonus_pixels: 1,
    mosaic_min_login_days: 7,
    fabula_min_login_days: 7,
    fabula_hide_after_reports: 3
  })
  // Valori letti all'apertura: si salvano solo i campi cambiati
  const [savedSettings, setSavedSettings] = useState<Record<string, unknown>>({})
  const [planPrices, setPlanPrices] = useState<{ base: number; pro: number; source: 'stripe' | 'settings' } | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [houseAccount, setHouseAccount] = useState<AdminHouseAccount | null>(null)
  const [houseEmail, setHouseEmail] = useState('')
  const [creatingHouse, setCreatingHouse] = useState(false)

  const loadHouseAccount = async () => {
    const { account } = await getHouseAccount()
    setHouseAccount(account)
  }

  const handleCreateHouseAccount = async () => {
    if (!(await askConfirm(`Creare l'account KUMANI con l'email ${houseEmail}? Da quel momento chiunque potrà iscriversi senza codice invito.`))) return
    setCreatingHouse(true)
    const result = await createHouseAccount(houseEmail)
    setCreatingHouse(false)
    if (result.success) {
      await loadHouseAccount()
      notify('✅ Account KUMANI creato: la registrazione senza invito è attiva.')
    } else {
      notify('❌ ' + (result.error || 'Errore'))
    }
  }

  const loadSystemSettings = async () => {
    loadHouseAccount()
    adminGetPlanPrices().then(setPlanPrices)
    const { data } = await supabase.from('system_settings').select('key, value')
    if (data) {
      const settingsObj: AdminSystemSettings = { ...systemSettings }
      data.forEach((s: { key: string; value: string }) => {
        let value: unknown
        try {
          value = JSON.parse(s.value)
        } catch {
          value = s.value
        }
        // Impostazione numerica salvata come testo (es. "20"): torna numero,
        // solo se è davvero un numero valido
        if (typeof settingsObj[s.key] === 'number' && typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
          value = Number(value)
        }
        settingsObj[s.key] = value
      })
      setSystemSettings(settingsObj)
      setSavedSettings(settingsObj)
    }
  }

  const saveSystemSettings = async () => {
    setSavingSettings(true)
    try {
      const changed = Object.fromEntries(
        Object.entries(systemSettings).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(savedSettings[key]))
      )
      const result = await adminSaveSystemSettings(changed)
      if (result.success) {
        setSavedSettings({ ...savedSettings, ...changed })
        notify(Object.keys(changed).length ? '✅ Impostazioni salvate con successo!' : 'Nessuna modifica da salvare.')
      }
      else notify('❌ Errore durante il salvataggio: ' + (result.error || ''))
    } catch {
      notify('❌ Errore durante il salvataggio')
    }
    setSavingSettings(false)
  }

  // Dati della sezione all'apertura
  useEffect(() => {
    // Caricamento dei dati della sezione (con il segnale "caricamento"):
    // è proprio il compito di questo effetto
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSystemSettings()
    // Solo all'apertura: la funzione di caricamento cambia a ogni disegno
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderSettings = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7" />
          Impostazioni Sistema
        </h2>
        <p className="text-gray-600 mt-1">Configura i parametri globali della piattaforma, divisi per argomento. Un solo pulsante in fondo salva tutto.</p>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <BadgeCheck className="h-5 w-5 text-[var(--ink)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">Abbonamenti</h3>
          <span className="text-xs text-gray-600">prezzi e prova Pro</span>
        </div>
        <div className="space-y-6 p-5">
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
              <BadgeCheck className="w-4 h-4" />
              Prezzi degli abbonamenti
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Letti direttamente da Stripe (i prezzi usati dal checkout): sono quelli mostrati sul sito e usati per il
              riepilogo finanziario. Per cambiarli si modifica il prezzo su Stripe; il sito si aggiorna entro un&apos;ora.
            </p>
            {planPrices ? (
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800">Base: {planPrices.base} € / anno</span>
                <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800">Pro: {planPrices.pro} € / anno</span>
                {planPrices.source !== 'stripe' && (
                  <span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">Stripe non raggiungibile: valori di riserva salvati</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Caricamento…</p>
            )}
          </div>
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
              <GitBranch className="w-4 h-4" />
              Piano Pro: prova gratuita
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Giorni di Pro gratis per chi si registra come professionista o la attiva dalla pagina Pro (una sola volta per
              account, senza carta).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Giorni di prova</span>
                <input
                  type="number"
                  min="1"
                  value={systemSettings.pro_trial_days ?? 15}
                  onChange={(e) => setSystemSettings({ ...systemSettings, pro_trial_days: parseInt(e.target.value, 10) || 1 })}
                  className={INPUT}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <Users className="h-5 w-5 text-[var(--ink)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">Iscrizioni</h3>
          <span className="text-xs text-gray-600">registrazione senza invito</span>
        </div>
        <div className="space-y-6 p-5">
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Users className="w-4 h-4" />
              Iscrizioni senza invito
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Chi si iscrive senza codice invito entra nella struttura dell’account KUMANI (mai in quella di un Kumano) e non
              dà KU Points a nessuno.
            </p>
            {houseAccount ? (
              <p className="text-sm text-gray-700 mb-3">
                ✅ Attiva — account <strong>{houseAccount.first_name} {houseAccount.last_name}</strong>{' '}
                <span className="font-mono">({houseAccount.referral_code})</span> · {houseAccount.email} ·{' '}
                {houseAccount.directMembers} iscritti senza invito
              </p>
            ) : (
              <div className="mb-3 space-y-2">
                <p className="text-sm text-amber-700">
                  ⚠️ Non attiva: finché l&apos;account KUMANI non esiste, la registrazione richiede ancora un codice invito.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
                  <input
                    type="email"
                    value={houseEmail}
                    onChange={(e) => setHouseEmail(e.target.value)}
                    placeholder="email dell'account KUMANI (es. community@...)"
                    className={`flex-1 ${INPUT.replace('w-full ', '')}`}
                  />
                  <button
                    type="button"
                    onClick={handleCreateHouseAccount}
                    disabled={creatingHouse || !houseEmail}
                    className="px-4 py-2.5 rounded-lg bg-[var(--ink)] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {creatingHouse ? 'Creazione...' : 'Crea account KUMANI'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <Coins className="h-5 w-5 text-[var(--ink)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">KU Points e voucher</h3>
          <span className="text-xs text-gray-600">punti, qualifiche, voucher premio e vetrina</span>
        </div>
        <div className="space-y-6 p-5">
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
              <GitBranch className="w-4 h-4" />
              KU Points
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Punti assegnati <strong>solo allo sponsor diretto</strong> quando un suo invitato paga con carta: primo
              abbonamento Base o Pro, oppure passaggio da Base a Pro (in proporzione a quanto pagato). Voucher e rinnovi
              non danno punti; un rimborso li toglie. <strong>Bonus Accoglienza:</strong> dal N° invitato attivato in poi,
              una parte dei punti dello sponsor passa a chi accoglie la persona nella propria stella (un altro Kumano):
              Base 10 → 9 allo sponsor + 1; Pro 120 → 110 + 10. Nel passaggio a Pro di una persona accolta, la stessa
              proporzione (101 + 9). Non è un costo in più per KUMANI: lo cede lo sponsor.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl">
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Attivazione Base</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.network_points_activation_base ?? 10}
                  onChange={(e) => setSystemSettings({ ...systemSettings, network_points_activation_base: parseInt(e.target.value, 10) || 0 })}
                  className={INPUT}
                />
              </label>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Attivazione Pro</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.network_points_activation_pro ?? 120}
                  onChange={(e) => setSystemSettings({ ...systemSettings, network_points_activation_pro: parseInt(e.target.value, 10) || 0 })}
                  className={INPUT}
                />
              </label>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Passaggio a Pro</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.network_points_upgrade_pro ?? 110}
                  onChange={(e) => setSystemSettings({ ...systemSettings, network_points_upgrade_pro: parseInt(e.target.value, 10) || 0 })}
                  className={INPUT}
                />
              </label>
            </div>
            <p className="mt-5 mb-2 text-sm font-semibold text-gray-800">Bonus Accoglienza (ceduto dallo sponsor)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Dal N° invitato attivato</span>
                <input
                  type="number"
                  min="1"
                  value={systemSettings.welcome_bonus_from_direct ?? 6}
                  onChange={(e) => setSystemSettings({ ...systemSettings, welcome_bonus_from_direct: parseInt(e.target.value, 10) || 1 })}
                  className={INPUT}
                />
              </label>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Punti ceduti per un Base</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.welcome_bonus_base ?? 1}
                  onChange={(e) => setSystemSettings({ ...systemSettings, welcome_bonus_base: parseInt(e.target.value, 10) || 0 })}
                  className={INPUT}
                />
              </label>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Punti ceduti per un Pro</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.welcome_bonus_pro ?? 10}
                  onChange={(e) => setSystemSettings({ ...systemSettings, welcome_bonus_pro: parseInt(e.target.value, 10) || 0 })}
                  className={INPUT}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Esempio con i valori attuali: dal {systemSettings.welcome_bonus_from_direct ?? 6}° invitato lo sponsor riceve{' '}
              {(systemSettings.network_points_activation_base ?? 10) - (systemSettings.welcome_bonus_base ?? 1)} punti per un Base e{' '}
              {(systemSettings.network_points_activation_pro ?? 120) - (systemSettings.welcome_bonus_pro ?? 10)} per un Pro; chi accoglie riceve{' '}
              {systemSettings.welcome_bonus_base ?? 1} e {systemSettings.welcome_bonus_pro ?? 10}.
            </p>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
              <GitBranch className="w-4 h-4" />
              Qualifiche e voucher premio
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Una qualifica si raggiunge con <strong>entrambi</strong> i requisiti: attivazioni Base/Pro pagate con carta
              delle persone invitate (i Pass e le attivazioni con voucher non contano) e KU Points guadagnati in totale
              (compresi quelli ricevuti dalla struttura e dai Pass). Al raggiungimento arrivano da soli nel Wallet i voucher
              Base di premio; con Kuman Black anche un voucher Pro di un anno per sé. Se un rimborso fa perdere i requisiti,
              i voucher premio non ancora usati vengono annullati.
            </p>
            <div className="space-y-2 max-w-2xl">
              {(Array.isArray(systemSettings.qualifications) ? systemSettings.qualifications : []).map((rule, index) => (
                <div key={rule.key} className="grid grid-cols-[7rem_1fr_1fr_1fr] items-end gap-3">
                  <span className="pb-3 text-xs font-bold text-gray-500">{['Kuman Green', 'Kuman Star', 'Kuman Black'][index] ?? rule.key}</span>
                  {(['activations', 'points', 'vouchers'] as const).map((field) => (
                    <label key={field} className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-600">{field === 'activations' ? 'Attivazioni' : field === 'points' ? 'KU Points' : 'Voucher premio'}</span>
                      <input
                        type="number"
                        min="0"
                        value={rule[field]}
                        onChange={(e) => {
                          const rules = [...systemSettings.qualifications]
                          rules[index] = { ...rule, [field]: parseInt(e.target.value, 10) || 0 }
                          setSystemSettings({ ...systemSettings, qualifications: rules })
                        }}
                        className={INPUT}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <label className="mt-4 block max-w-xs">
              <span className="mb-1 block text-xs font-medium text-gray-600">Black continuo: 1 voucher ogni N nuove attivazioni (0 = spento)</span>
              <input
                type="number"
                min="0"
                value={systemSettings.black_plus_every ?? 6}
                onChange={(e) => setSystemSettings({ ...systemSettings, black_plus_every: parseInt(e.target.value, 10) || 0 })}
                className={INPUT}
              />
            </label>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Valore voucher Base (€)</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.voucher_value_base_eur ?? 49}
                  onChange={(e) => setSystemSettings({ ...systemSettings, voucher_value_base_eur: parseInt(e.target.value, 10) || 0 })}
                  className={INPUT}
                />
              </label>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Valore voucher Pro (€)</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.voucher_value_pro_eur ?? 149}
                  onChange={(e) => setSystemSettings({ ...systemSettings, voucher_value_pro_eur: parseInt(e.target.value, 10) || 0 })}
                  className={INPUT}
                />
              </label>
            </div>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Sparkles className="w-4 h-4" />
              Annunci in Vetrina
            </label>
            <p className="text-xs text-gray-500 mb-3">
              KU Points richiesti a un Kumano per mettere in evidenza un proprio annuncio nella sezione “In Vetrina”
              della bacheca, per 7 o 15 giorni.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={systemSettings.listing_feature_cost_7d ?? 20}
                  onChange={(e) => setSystemSettings({ ...systemSettings, listing_feature_cost_7d: parseInt(e.target.value, 10) || 0 })}
                  className={INPUT}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">/ 7gg</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={systemSettings.listing_feature_cost_15d ?? 35}
                  onChange={(e) => setSystemSettings({ ...systemSettings, listing_feature_cost_15d: parseInt(e.target.value, 10) || 0 })}
                  className={INPUT}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">/ 15gg</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <Sparkles className="h-5 w-5 text-[var(--ink)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">Servizi</h3>
          <span className="text-xs text-gray-600">limiti e parametri degli strumenti</span>
        </div>
        <div className="space-y-6 p-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KUMANI Sorpresa: prezzi (€)</label>
            <div className="grid max-w-xl gap-3 sm:grid-cols-3">
              {(
                [
                  ['surprise_price_voucher_cents', 'Buono regalo'],
                  ['surprise_price_journey3_cents', 'Percorso 3 giorni'],
                  ['surprise_price_journey7_cents', 'Percorso 7 giorni'],
                ] as const
              ).map(([key, name]) => (
                <label key={key} className="text-xs text-gray-600">
                  {name}
                  <input
                    type="number"
                    min="0.5"
                    max="1000"
                    step="0.10"
                    value={((systemSettings[key] as number) ?? 0) / 100}
                    onChange={(e) => setSystemSettings({ ...systemSettings, [key]: Math.round((Number(e.target.value) || 0) * 100) })}
                    className={`mt-1 ${INPUT}`}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">Quanto paga chi crea una sorpresa per attivare il link (IVA compresa). Vale per le sorprese pagate da adesso.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KUMANI Sorpresa: costo in punti</label>
            <div className="grid max-w-xl gap-3 sm:grid-cols-3">
              {(
                [
                  ['surprise_karma_voucher', 'Buono regalo · KU Karma'],
                  ['surprise_karma_journey3', 'Percorso 3 giorni · KU Karma'],
                  ['surprise_karma_journey7', 'Percorso 7 giorni · KU Karma'],
                  ['surprise_kupoints_voucher', 'Buono regalo · KU Points'],
                  ['surprise_kupoints_journey3', 'Percorso 3 giorni · KU Points'],
                  ['surprise_kupoints_journey7', 'Percorso 7 giorni · KU Points'],
                ] as const
              ).map(([key, name]) => (
                <label key={key} className="text-xs text-gray-600">
                  {name}
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    value={(systemSettings[key] as number) ?? 0}
                    onChange={(e) => setSystemSettings({ ...systemSettings, [key]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className={`mt-1 ${INPUT}`}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">In alternativa alla carta, chi crea la sorpresa può pagarla con i KU Karma oppure con i KU Points confermati (mai quelli ancora in conferma). 0 = non si può pagare con quei punti. Riferimento: 294 KU Points = voucher da 49 €; 300 KU Karma = 5 € di sconto sul rinnovo.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Traduzioni AI del Menù al giorno (per ristorante)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={systemSettings.menu_ai_daily_runs ?? 5}
              onChange={(e) => setSystemSettings({ ...systemSettings, menu_ai_daily_runs: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className={`max-w-xs ${INPUT}`}
            />
            <p className="text-xs text-gray-500 mt-1">Ogni traduzione ha un piccolo costo sulla chiave AI del progetto.</p>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">VeriFoto: rilevatore AI (Sightengine, quota gratuita)</p>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <label className="text-xs text-gray-600">
                Analisi per utente al giorno
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={systemSettings.verifoto_daily_user ?? 1}
                  onChange={(e) => setSystemSettings({ ...systemSettings, verifoto_daily_user: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  className={`mt-1 ${INPUT}`}
                />
              </label>
              <label className="text-xs text-gray-600">
                Operazioni al mese (tetto)
                <input
                  type="number"
                  min="0"
                  max="2000"
                  value={systemSettings.verifoto_monthly_ops ?? 1800}
                  onChange={(e) => setSystemSettings({ ...systemSettings, verifoto_monthly_ops: Math.min(2000, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                  className={`mt-1 ${INPUT}`}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Il piano gratuito di Sightengine include 2.000 operazioni al mese: oltre si paga. Tieni il tetto sotto 2.000 per restare gratis
              (ogni analisi consuma le operazioni indicate da Sightengine, di solito alcune per foto).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CheckMail: analisi per utente al giorno</label>
            <input
              type="number"
              min="0"
              max="100"
              value={systemSettings.checkmail_daily_user ?? 10}
              onChange={(e) => setSystemSettings({ ...systemSettings, checkmail_daily_user: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className={`max-w-xs ${INPUT}`}
            />
            <p className="text-xs text-gray-500 mt-1">Ogni analisi usa anche la chiave AI del progetto (lettura del testo), con un piccolo costo.</p>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">Scudo Dati</p>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <label className="text-xs text-gray-600">
                KU Karma per controllare un&apos;altra email
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={systemSettings.scudo_dati_other_cost ?? 3}
                  onChange={(e) => setSystemSettings({ ...systemSettings, scudo_dati_other_cost: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                  className={`mt-1 ${INPUT}`}
                />
              </label>
              <label className="text-xs text-gray-600">
                Controlli esterni al giorno (tutto il sito)
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={systemSettings.scudo_dati_daily_cap ?? 90}
                  onChange={(e) => setSystemSettings({ ...systemSettings, scudo_dati_daily_cap: Math.min(10000, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                  className={`mt-1 ${INPUT}`}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Il controllo della propria email è gratis (5 nuovi al giorno a persona); le altre email costano KU Karma (10 al giorno a persona).
              Il tetto giornaliero protegge il servizio gratuito XposedOrNot: gli esiti restano in memoria 24 ore e non contano.
            </p>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">Veritas: durata delle fasi (secondi)</p>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {([
                ['veritas_write_seconds', 'Scrittura', 90],
                ['veritas_vote_seconds', 'Voto', 45],
                ['veritas_reveal_seconds', 'Rivelazione', 15],
              ] as const).map(([key, labelText, fallback]) => (
                <label key={key} className="text-xs text-gray-600">
                  {labelText}
                  <input
                    type="number"
                    min="5"
                    max="600"
                    value={systemSettings[key] ?? fallback}
                    onChange={(e) => setSystemSettings({ ...systemSettings, [key]: Math.max(5, parseInt(e.target.value, 10) || 5) })}
                    className={`mt-1 ${INPUT}`}
                  />
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">KUMANI Mosaic</p>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {([
                ['mosaic_pixels_day', 'Tessere al giorno', 3, 1, 50],
                ['mosaic_bonus_pixels', 'Tessere bonus', 1, 0, 10],
                ['mosaic_min_login_days', 'Giorni di accesso minimi', 7, 0, 365],
              ] as const).map(([key, labelText, fallback, min, max]) => (
                <label key={key} className="text-xs text-gray-600">
                  {labelText}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={systemSettings[key] ?? fallback}
                    onChange={(e) => setSystemSettings({ ...systemSettings, [key]: Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)) })}
                    className={`mt-1 ${INPUT}`}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Il bonus arriva a chi oggi ha usato un altro servizio KUMANI. Un giorno di accesso = il KU Karma di accesso giornaliero.
              Dimensione e date delle stagioni si gestiscono in Admin → Mosaic.
            </p>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">Kumani Fabula</p>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {([
                ['fabula_min_login_days', 'Giorni di accesso per pubblicare subito', 7, 0, 365],
                ['fabula_hide_after_reports', 'Segnalazioni per nascondere una storia', 3, 1, 20],
              ] as const).map(([key, labelText, fallback, min, max]) => (
                <label key={key} className="text-xs text-gray-600">
                  {labelText}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={systemSettings[key] ?? fallback}
                    onChange={(e) => setSystemSettings({ ...systemSettings, [key]: Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)) })}
                    className={`mt-1 ${INPUT}`}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Chi ha meno giorni di accesso, o scrive una parola filtrata, pubblica in attesa del controllo in Admin → Fabula.
            </p>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Users className="w-4 h-4" />
              Affinity Amicizie
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Quante persone Kumi presenta ogni settimana a chi partecipa ad Affinity Amicizie (solo abbonati, 18+). Con pochi
              iscritti conviene tenerlo basso; si può alzare man mano che la community cresce. 0 = presentazioni sospese.
            </p>
            <label className="block max-w-xs">
              <span className="mb-1 block text-xs font-medium text-gray-600">Presentazioni a settimana</span>
              <input
                type="number"
                min="0"
                max="20"
                value={systemSettings.affinity_intros_per_week ?? 3}
                onChange={(e) => setSystemSettings({ ...systemSettings, affinity_intros_per_week: Math.min(20, parseInt(e.target.value, 10) || 0) })}
                className={INPUT}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <Settings className="h-5 w-5 text-[var(--ink)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">Sistema</h3>
          <span className="text-xs text-gray-600">manutenzione del sito</span>
        </div>
        <div className="space-y-6 p-5">
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
            <div>
              <div className="font-medium text-red-900">Modalità Manutenzione</div>
              <div className="text-sm text-red-600">Se attiva, gli utenti vedranno un messaggio di manutenzione</div>
            </div>
            <button
              onClick={() => setSystemSettings({...systemSettings, maintenance_mode: !systemSettings.maintenance_mode})}
              className="focus:outline-none"
            >
              {systemSettings.maintenance_mode ? (
                <ToggleRight className="w-14 h-8 text-red-500" />
              ) : (
                <ToggleLeft className="w-14 h-8 text-gray-400" />
              )}
            </button>
          </div>

          {systemSettings.maintenance_mode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio di Manutenzione</label>
              <textarea
                value={systemSettings.maintenance_message || ''}
                onChange={(e) => setSystemSettings({...systemSettings, maintenance_message: e.target.value})}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-1 flex justify-end rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          onClick={saveSystemSettings}
          disabled={savingSettings}
          className="px-6 py-3 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] font-medium disabled:bg-gray-400 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {savingSettings ? 'Salvataggio...' : 'Salva Impostazioni'}
        </button>
      </div>
    </div>
  )

  return renderSettings()
}
