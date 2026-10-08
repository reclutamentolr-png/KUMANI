'use client'

import { useState, useEffect } from 'react'
import { notify } from '@/lib/adminNotify'
import {
  listVouchers,
  revokeVoucher,
  createAdminVoucher,
  creditDailyPoints,
  listVoucherUsers,
} from '@/app/actions/admin'
import type { AdminVoucherRow, AdminVoucherUser } from '@/lib/adminTypes'
import {
  X,
  Trash2,
  BadgeCheck,
  Sparkles,
} from 'lucide-react'
import { askConfirm } from '@/lib/confirm'

// Sezione "vouchers" dell'Admin, caricata solo quando la si apre.
export default function AdminVouchersPanel() {
  const [vouchers, setVouchers] = useState<AdminVoucherRow[]>([])
  const [loadingVouchers, setLoadingVouchers] = useState(false)
  const [voucherUsers, setVoucherUsers] = useState<AdminVoucherUser[]>([])
  const [generatingAdminVoucher, setGeneratingAdminVoucher] = useState(false)
  const [lastAdminVoucherCode, setLastAdminVoucherCode] = useState<string | null>(null)
  const [creditForm, setCreditForm] = useState({ userId: '', amount: '' })
  const [creditUserSearch, setCreditUserSearch] = useState('')
  const [creditingPoints, setCreditingPoints] = useState(false)
  const [creditError, setCreditError] = useState<string | null>(null)
  const [creditSuccess, setCreditSuccess] = useState<string | null>(null)

  const loadVouchersData = async (silent = false) => {
    if (!silent) setLoadingVouchers(true)
    const [voucherResult, usersResult] = await Promise.all([listVouchers(), listVoucherUsers()])
    setVouchers(voucherResult.vouchers)
    setVoucherUsers(usersResult.users)
    setLoadingVouchers(false)
  }

  const handleGenerateAdminVoucher = async () => {
    setGeneratingAdminVoucher(true)
    setLastAdminVoucherCode(null)
    const result = await createAdminVoucher()
    setGeneratingAdminVoucher(false)
    if (!result.success) {
      notify(result.error || 'Errore durante la generazione del codice.')
      return
    }
    setLastAdminVoucherCode(result.code)
    await loadVouchersData(true)
  }

  const handleCreditPoints = async () => {
    setCreditError(null)
    setCreditSuccess(null)
    const amount = parseInt(creditForm.amount, 10)
    if (!creditForm.userId || !amount || amount <= 0) {
      setCreditError('Seleziona un utente e un numero di punti valido.')
      return
    }
    setCreditingPoints(true)
    const result = await creditDailyPoints(creditForm.userId, amount)
    setCreditingPoints(false)
    if (!result.success) {
      setCreditError(result.error || 'Errore durante la ricarica punti.')
      return
    }
    setCreditSuccess(`+${amount} KU Karma accreditati.`)
    setCreditForm({ userId: '', amount: '' })
    setCreditUserSearch('')
    await loadVouchersData(true)
  }

  const filteredCreditUsers = (() => {
    const q = creditUserSearch.trim().toLowerCase()
    if (!q) return []
    return voucherUsers
      .filter((u) => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
        return fullName.includes(q) || (u.referral_code || '').toLowerCase().includes(q)
      })
      .slice(0, 8)
  })()

  const selectCreditUser = (u: AdminVoucherUser) => {
    setCreditForm({ ...creditForm, userId: u.id })
    setCreditUserSearch(`${u.first_name || ''} ${u.last_name || ''} — ${u.referral_code}`)
  }

  const clearCreditUser = () => {
    setCreditForm({ ...creditForm, userId: '' })
    setCreditUserSearch('')
  }

  const handleRevokeVoucher = async (voucherId: string) => {
    if (!(await askConfirm('Revocare questo voucher? Solo i voucher non ancora riscattati possono essere revocati.'))) return
    const result = await revokeVoucher(voucherId)
    if (result.success) {
      setVouchers((prev) => prev.map((v) => (v.id === voucherId ? { ...v, status: 'revoked' } : v)))
    } else {
      notify(result.error || 'Errore durante la revoca del voucher.')
    }
  }

  // Dati della sezione all'apertura
  useEffect(() => {
    // Caricamento dei dati della sezione (con il segnale "caricamento"):
    // è proprio il compito di questo effetto
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadVouchersData()
  }, [])

  const renderVouchers = () => {
    const statusOf = (v: AdminVoucherRow) => {
      if (v.status === 'redeemed') return { label: 'Riscattato', className: 'bg-gray-100 text-gray-600' }
      if (v.status === 'revoked') return { label: 'Revocato', className: 'bg-red-100 text-red-700' }
      return { label: 'Disponibile', className: 'bg-green-100 text-green-700' }
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BadgeCheck className="w-7 h-7" />
            Voucher Abbonamento
          </h2>
          <p className="text-gray-600 mt-1">
            I Kumani ricevono questi voucher in premio con le qualifiche (Kuman Green, Star e Black); qui puoi anche
            generarne direttamente in qualità di amministratore (gratis) o caricare KU Karma a un utente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900">Genera Codice Abbonamento</h3>
            <p className="text-sm text-gray-600">
              Crea un voucher di attivazione senza costo in punti. Il codice è generato con un algoritmo
              crittograficamente sicuro (CSPRNG), non prevedibile e non riproducibile da nessuno, e una volta
              attivato non potrà più essere riutilizzato.
            </p>
            <button
              onClick={handleGenerateAdminVoucher}
              disabled={generatingAdminVoucher}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] disabled:opacity-50 font-medium"
            >
              <BadgeCheck className="w-4 h-4" />
              {generatingAdminVoucher ? 'Generazione...' : 'Genera codice'}
            </button>
            {lastAdminVoucherCode && (
              <div className="rounded-lg border border-[var(--gold)]/30 bg-[var(--gold-pale)] p-3">
                <p className="text-xs text-gray-500 mb-1">Codice generato — invialo al Kumano:</p>
                <code className="font-mono text-base font-bold text-gray-900">{lastAdminVoucherCode}</code>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900">Carica KU Karma</h3>
            <p className="text-sm text-gray-600">
              Accredita punti giornalieri direttamente a un utente. Questi punti abilitano solo la pubblicazione di
              annunci in bacheca — non i voucher né il Catalogo Premi, che restano legati solo ai KU Points guadagnati
              realmente.
            </p>
            {creditError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{creditError}</div>
            )}
            {creditSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">{creditSuccess}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cerca per nome o codice..."
                  value={creditUserSearch}
                  onChange={(e) => {
                    setCreditUserSearch(e.target.value)
                    if (creditForm.userId) setCreditForm({ ...creditForm, userId: '' })
                  }}
                  className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none ${
                    creditForm.userId ? 'border-green-400 bg-green-50 pr-8' : 'border-gray-300'
                  }`}
                />
                {creditForm.userId && (
                  <button
                    type="button"
                    onClick={clearCreditUser}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    title="Cambia utente"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {!creditForm.userId && filteredCreditUsers.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {filteredCreditUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => selectCreditUser(u)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--gold-pale)] border-b last:border-0 border-gray-100"
                      >
                        <div className="font-medium text-gray-900">{u.first_name} {u.last_name}</div>
                        <div className="text-xs text-gray-500">{u.referral_code} · {u.daily_points || 0} KU Karma</div>
                      </button>
                    ))}
                  </div>
                )}
                {!creditForm.userId && creditUserSearch.trim() && filteredCreditUsers.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
                    Nessun utente trovato
                  </div>
                )}
              </div>
              <input
                type="number"
                min="1"
                placeholder="Punti da caricare"
                value={creditForm.amount}
                onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              />
            </div>
            <button
              onClick={handleCreditPoints}
              disabled={creditingPoints}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] disabled:opacity-50 font-medium"
            >
              <Sparkles className="w-4 h-4" />
              {creditingPoints ? 'Caricamento...' : 'Carica punti'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Codice</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Creato da</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Riscattato da</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Creato il</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Stato</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loadingVouchers ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Caricamento...</td></tr>
              ) : vouchers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nessun voucher creato ancora</td></tr>
              ) : (
                vouchers.map((v) => {
                  const status = statusOf(v)
                  return (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{v.code}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {v.creator?.first_name} {v.creator?.last_name}
                        <div className="text-xs text-gray-400">{v.creator?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {v.redeemed_by ? (
                          <>
                            {v.redeemer?.first_name} {v.redeemer?.last_name}
                            <div className="text-xs text-gray-400">{v.redeemer?.email}</div>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(v.created_at).toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v.status === 'active' && (
                          <button
                            onClick={() => handleRevokeVoucher(v.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Revoca voucher"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return renderVouchers()
}
