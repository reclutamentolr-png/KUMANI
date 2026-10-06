'use client'

import { useState, useEffect } from 'react'
import { notify } from '@/lib/adminNotify'
import { createClient } from '@/lib/supabase/client'
import {
  adminSaveSystemSettings,
  createReward,
  updateReward,
  listRewards,
  deleteReward,
  listRewardRedemptions,
  fulfillRewardRedemption,
  uploadRewardImage,
} from '@/app/actions/admin'
import type { AdminRewardRow, AdminRewardRedemption } from '@/lib/adminTypes'
import { Pencil, Trash2, Gift } from 'lucide-react'

// Sezione "rewards" dell'Admin, caricata solo quando la si apre.
export default function AdminRewardsPanel({ loadBadges }: { loadBadges: () => void }) {
  const supabase = createClient()
  const [rewards, setRewards] = useState<AdminRewardRow[]>([])
  const [rewardsCatalogOn, setRewardsCatalogOn] = useState(false)
  const [rewardRedemptions, setRewardRedemptions] = useState<AdminRewardRedemption[]>([])
  const [loadingRewards, setLoadingRewards] = useState(false)
  const [rewardForm, setRewardForm] = useState({ title: '', description: '', imageUrl: '', pointsCost: '', isVisible: true })
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null)
  const [savingReward, setSavingReward] = useState(false)
  const [rewardError, setRewardError] = useState<string | null>(null)
  const [uploadingRewardImage, setUploadingRewardImage] = useState(false)
  const [fulfillCodeInputs, setFulfillCodeInputs] = useState<Record<string, string>>({})
  const [fulfillingId, setFulfillingId] = useState<string | null>(null)

  const loadRewardsData = async (silent = false) => {
    if (!silent) setLoadingRewards(true)
    const [rewardsResult, redemptionsResult, switchResult] = await Promise.all([
      listRewards(),
      listRewardRedemptions(),
      supabase.from('system_settings').select('value').eq('key', 'rewards_catalog_enabled').maybeSingle(),
    ])
    setRewards(rewardsResult.rewards)
    setRewardRedemptions(redemptionsResult.redemptions)
    setRewardsCatalogOn(switchResult.data?.value === 'true')
    setLoadingRewards(false)
  }

  // Interruttore del Catalogo Premi: spento, gli utenti non vedono né
  // possono riscattare premi; catalogo e riscatti restano salvati.
  const toggleRewardsCatalog = async () => {
    const next = !rewardsCatalogOn
    const ok = confirm(
      next
        ? 'Attivare il Catalogo Premi? Gli utenti vedranno la pagina Premi e potranno riscattare i premi visibili con i KU Points.'
        : 'Disattivare il Catalogo Premi? La pagina Premi sparisce e nessuno può più riscattare premi. Catalogo e riscatti già fatti restano salvati.'
    )
    if (!ok) return
    const result = await adminSaveSystemSettings({ rewards_catalog_enabled: next })
    if (result.success) setRewardsCatalogOn(next)
    else notify(result.error || 'Errore durante il salvataggio.')
  }

  const resetRewardForm = () => {
    setRewardForm({ title: '', description: '', imageUrl: '', pointsCost: '', isVisible: true })
    setEditingRewardId(null)
  }

  const handleEditReward = (reward: AdminRewardRow) => {
    setEditingRewardId(reward.id)
    setRewardForm({
      title: reward.title,
      description: reward.description || '',
      imageUrl: reward.image_url || '',
      pointsCost: String(reward.points_cost),
      isVisible: reward.is_visible,
    })
  }

  const handleSaveReward = async () => {
    setRewardError(null)
    const pointsCost = parseInt(rewardForm.pointsCost, 10)
    if (!rewardForm.title.trim() || !pointsCost || pointsCost <= 0) {
      setRewardError('Titolo e KU Points (> 0) sono obbligatori.')
      return
    }
    setSavingReward(true)
    const payload = {
      title: rewardForm.title,
      description: rewardForm.description,
      imageUrl: rewardForm.imageUrl,
      pointsCost,
      isVisible: rewardForm.isVisible,
    }
    const result = editingRewardId ? await updateReward(editingRewardId, payload) : await createReward(payload)
    setSavingReward(false)
    if (!result.success) {
      setRewardError(result.error || 'Errore durante il salvataggio del premio.')
      return
    }
    resetRewardForm()
    await loadRewardsData(true)
  }

  const handleDeleteReward = async (rewardId: string) => {
    if (!confirm('Eliminare questo premio? Possibile solo se non è mai stato riscattato.')) return
    const result = await deleteReward(rewardId)
    if (result.success) {
      setRewards((prev) => prev.filter((r) => r.id !== rewardId))
    } else {
      notify(result.error || 'Errore durante l\'eliminazione del premio.')
    }
  }

  const handleFulfillRedemption = async (redemptionId: string) => {
    const code = (fulfillCodeInputs[redemptionId] || '').trim()
    if (!code) {
      notify('Inserisci il codice da inviare al Kumano.')
      return
    }
    setFulfillingId(redemptionId)
    const result = await fulfillRewardRedemption(redemptionId, code)
    setFulfillingId(null)
    if (result.success) {
      setRewardRedemptions((prev) =>
        prev.map((r) =>
          r.id === redemptionId ? { ...r, fulfilled_at: new Date().toISOString(), fulfillment_code: code } : r
        )
      )
      loadBadges()
      setFulfillCodeInputs((prev) => {
        const next = { ...prev }
        delete next[redemptionId]
        return next
      })
    } else {
      notify(result.error || 'Errore durante l\'evasione del riscatto.')
    }
  }

  // Ridimensiona la foto nel browser (lato lungo max 1200 px, JPEG) prima
  // dell'invio: resta sotto il limite di 1 MB delle server action e le
  // pagine del Catalogo si caricano in fretta.
  const handleRewardImageFile = async (file: File | undefined) => {
    if (!file) return
    setRewardError(null)
    setUploadingRewardImage(true)
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (!blob) throw new Error('Impossibile elaborare la foto.')
      const formData = new FormData()
      formData.append('file', new File([blob], 'premio.jpg', { type: 'image/jpeg' }))
      const result = await uploadRewardImage(formData)
      if (result.success) setRewardForm((prev) => ({ ...prev, imageUrl: result.url }))
      else setRewardError(result.error)
    } catch (err) {
      setRewardError((err instanceof Error && err.message) || 'Caricamento della foto non riuscito.')
    } finally {
      setUploadingRewardImage(false)
    }
  }

  // Dati della sezione all'apertura
  useEffect(() => {
    // Caricamento dei dati della sezione (con il segnale "caricamento"):
    // è proprio il compito di questo effetto
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRewardsData()
    // Solo all'apertura: la funzione di caricamento cambia a ogni disegno
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderRewards = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gift className="w-7 h-7" />
            Catalogo Premi
          </h2>
          <p className="text-gray-600 mt-1">
            Premi riscattabili dai Kumani con i KU Points. Un premio già riscattato non può più essere eliminato,
            solo nascosto (disattiva &quot;Visibile&quot;).
          </p>
        </div>

        <div
          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            rewardsCatalogOn ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div>
            <p className="font-bold text-gray-900">Catalogo Premi {rewardsCatalogOn ? 'attivo' : 'disattivato'}</p>
            <p className="text-sm text-gray-600">
              {rewardsCatalogOn
                ? 'Gli utenti vedono la pagina Premi e possono riscattare i premi visibili.'
                : 'Gli utenti non vedono la pagina Premi e non possono riscattare. Puoi comunque preparare il catalogo ed evadere i riscatti già fatti.'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleRewardsCatalog}
            disabled={loadingRewards}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
              rewardsCatalogOn ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {rewardsCatalogOn ? 'Disattiva catalogo' : 'Attiva catalogo'}
          </button>
        </div>

        {/* A catalogo spento si vede solo l'interruttore (e i riscatti ancora da evadere) */}
        {rewardsCatalogOn && (
        <>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900">{editingRewardId ? 'Modifica premio' : 'Nuovo premio'}</h3>
          {rewardError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{rewardError}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo di Regalo</label>
              <input
                type="text"
                placeholder="Es. Buono Amazon 20€"
                value={rewardForm.title}
                onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">KU Points necessari</label>
              <input
                type="number"
                min="1"
                placeholder="Es. 294"
                value={rewardForm.pointsCost}
                onChange={(e) => setRewardForm({ ...rewardForm, pointsCost: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Foto</label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <label className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-gray-400 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap ${uploadingRewardImage ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingRewardImage ? 'Caricamento...' : '📷 Carica foto'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      handleRewardImageFile(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                <span className="text-xs text-gray-400">oppure</span>
                <input
                  type="text"
                  placeholder="incolla un link https://..."
                  value={rewardForm.imageUrl}
                  onChange={(e) => setRewardForm({ ...rewardForm, imageUrl: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </div>
              {rewardForm.imageUrl && (
                <div className="mt-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={rewardForm.imageUrl} alt="Anteprima premio" className="h-20 w-20 rounded-lg object-cover border" />
                  <button
                    type="button"
                    onClick={() => setRewardForm({ ...rewardForm, imageUrl: '' })}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Rimuovi foto
                  </button>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
              <textarea
                placeholder="Descrizione del premio"
                value={rewardForm.description}
                onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none h-20"
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                id="reward-visible"
                checked={rewardForm.isVisible}
                onChange={(e) => setRewardForm({ ...rewardForm, isVisible: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="reward-visible" className="text-sm font-medium text-gray-700">
                Visibile nel Catalogo Premi dei Kumani
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveReward}
              disabled={savingReward}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] disabled:opacity-50 font-medium"
            >
              <Gift className="w-4 h-4" />
              {savingReward ? 'Salvataggio...' : editingRewardId ? 'Salva modifiche' : 'Crea premio'}
            </button>
            {editingRewardId && (
              <button onClick={resetRewardForm} className="px-5 py-2.5 text-gray-600 hover:text-gray-900 font-medium">
                Annulla
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Premio</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">KU Points</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Visibile</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loadingRewards ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Caricamento...</td></tr>
              ) : rewards.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Nessun premio creato ancora</td></tr>
              ) : (
                rewards.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.title}</div>
                      {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{r.points_cost}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {r.is_visible ? 'Visibile' : 'Nascosto'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEditReward(r)} className="text-[var(--gold)] hover:text-[var(--ink)] p-1" title="Modifica">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => handleDeleteReward(r.id)} className="text-red-500 hover:text-red-700 p-1 ml-1" title="Elimina">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </>
        )}

        {(rewardsCatalogOn || rewardRedemptions.some((r) => !r.fulfilled_at)) && (
        <div>
          <h3 className="font-bold text-gray-900 mb-3">Riscatti da evadere</h3>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Premio</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Kumano</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Punti spesi</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Richiesto il</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Stato</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rewardRedemptions.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nessun riscatto ancora</td></tr>
                ) : (
                  rewardRedemptions.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{r.reward_catalog?.title}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.redeemer?.first_name} {r.redeemer?.last_name}
                        <div className="text-xs text-gray-400">{r.redeemer?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.points_spent}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(r.redeemed_at).toLocaleDateString('it-IT')}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            r.fulfilled_at ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {r.fulfilled_at ? 'Evaso' : 'Da evadere'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.fulfilled_at ? (
                          <span className="font-mono text-xs text-gray-500">{r.fulfillment_code}</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="text"
                              placeholder="Codice (es. Amazon)"
                              value={fulfillCodeInputs[r.id] || ''}
                              onChange={(e) => setFulfillCodeInputs({ ...fulfillCodeInputs, [r.id]: e.target.value })}
                              className="w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                            />
                            <button
                              onClick={() => handleFulfillRedemption(r.id)}
                              disabled={fulfillingId === r.id}
                              className="whitespace-nowrap text-xs font-semibold text-[var(--gold)] hover:text-[var(--ink)] disabled:opacity-50"
                            >
                              {fulfillingId === r.id ? 'Invio...' : 'Evadi con codice'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    )
  }

  return renderRewards()
}
