'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, Gift, LoaderCircle, Share2 } from 'lucide-react'
import AdminUserPicker from '@/components/admin/AdminUserPicker'
import ScaledVoucherFront from '@/components/voucherCard/ScaledVoucherFront'
import { adminGiftSubscription } from '@/app/actions/adminGiftSubscription'
import type { StaffUserHit } from '@/app/actions/admin'
import { CARD_CUSTOM_MAX, CARD_DESIGNS, CARD_NAME_MAX, CARD_PHRASES, type CardOptions } from '@/lib/voucherCard'
import type { VoucherPrintTexts } from '@/components/voucherPrint/VoucherPrintCard'
import { askConfirm } from '@/lib/confirm'

// Admin → Voucher e coupon → Coupon per la community: «Regala un
// abbonamento» a un Kumano scelto. Un anno di Base o Pro, con il biglietto:
// il Kumano riceve l'avviso (campanella e telefono), lo trova nel Wallet e lo
// attiva dal biglietto con un tocco.
export default function AdminGiftSubscriptionPanel() {
  const tp = useTranslations('voucherPrint')
  const [person, setPerson] = useState<StaffUserHit | null>(null)
  const [plan, setPlan] = useState<'base' | 'pro'>('base')
  const [o, setO] = useState<Omit<CardOptions, 'to'>>({ design: 'A', phrase: 'p2', custom: '', from: 'KUMANI' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ code: string; link: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const name = person?.first_name?.trim() || ''
  const phrase = o.phrase === 'custom' ? o.custom.trim() || tp('customPlaceholder') : tp(`phrases.${o.phrase}`)
  const texts: VoucherPrintTexts = {
    voucher: tp('card.voucher'),
    gift: tp('card.gift'),
    oneYear: tp('card.oneYear'),
    planLine: tp(plan === 'pro' ? 'card.planPro' : 'card.planBase'),
    codeLabel: tp('card.codeLabel'),
    codeShort: tp('card.codeShort'),
    howToLong: '',
    howToShort: '',
    scan: '',
  }

  const send = async () => {
    if (!person) return setError('Scegli a chi regalarlo')
    const who = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email || 'questo utente'
    if (!(await askConfirm(`Regalare un anno di KUMANI ${plan === 'pro' ? 'Pro' : 'Base'} a ${who}? Riceverà subito l’avviso con il biglietto.`))) return
    setBusy(true)
    setError(null)
    setResult(null)
    const r = await adminGiftSubscription({ userId: person.id, plan, design: o.design, phrase: o.phrase, custom: o.custom, from: o.from })
    setBusy(false)
    if (!r.success) return setError(r.error)
    setResult({ code: r.code, link: r.link, name: who })
  }

  const chip = (on: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-300 bg-white text-gray-800 hover:border-[var(--gold)]'}`
  const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]'

  return (
    <div className="rounded-xl border-2 border-[var(--gold)]/50 bg-gradient-to-br from-[var(--gold-pale)]/60 to-white p-6 shadow-sm">
      <h3 className="flex items-center gap-2 font-bold text-gray-900">
        <Gift className="h-5 w-5 text-[var(--gold)]" /> Regala un abbonamento
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        Un anno di KUMANI Base o Pro a un Kumano scelto, con il biglietto. Riceve subito l’avviso (campanella e notifica sul telefono), lo trova nel
        Wallet e lo attiva dal biglietto con un tocco. Parte dall’account KUMANI.
      </p>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">A chi</label>
            <AdminUserPicker
              scope="coupons"
              selected={person}
              onSelect={(u) => {
                setPerson(u)
                setResult(null)
              }}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Piano</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPlan('base')} aria-pressed={plan === 'base'} className={chip(plan === 'base')}>
                Base · 1 anno
              </button>
              <button type="button" onClick={() => setPlan('pro')} aria-pressed={plan === 'pro'} className={chip(plan === 'pro')}>
                Pro · 1 anno
              </button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Grafica</p>
            <div className="flex flex-wrap gap-2">
              {CARD_DESIGNS.map((d) => (
                <button key={d} type="button" onClick={() => setO({ ...o, design: d })} aria-pressed={o.design === d} className={chip(o.design === d)}>
                  {tp(`designs.${d}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="gift-phrase" className="mb-2 block text-sm font-medium text-gray-700">
              Frase
            </label>
            <select id="gift-phrase" value={o.phrase} onChange={(e) => setO({ ...o, phrase: e.target.value as CardOptions['phrase'] })} className={field}>
              {CARD_PHRASES.map((p) => (
                <option key={p} value={p}>
                  {tp(`phrases.${p}`)}
                </option>
              ))}
              <option value="custom">{tp('phraseCustom')}</option>
            </select>
            {o.phrase === 'custom' && (
              <textarea value={o.custom} onChange={(e) => setO({ ...o, custom: e.target.value })} maxLength={CARD_CUSTOM_MAX} rows={2} placeholder={tp('customPlaceholder')} className={`${field} mt-2`} />
            )}
          </div>
          <div>
            <label htmlFor="gift-from" className="mb-2 block text-sm font-medium text-gray-700">
              Da
            </label>
            <input id="gift-from" value={o.from} onChange={(e) => setO({ ...o, from: e.target.value })} maxLength={CARD_NAME_MAX} className={field} />
          </div>
        </div>

        {/* Anteprima del biglietto */}
        <div className="rounded-2xl bg-[var(--ink)] p-4 text-center">
          {name && <p className="mb-2 font-serif text-lg font-semibold text-[var(--gold-bright)]">Per {name}</p>}
          <ScaledVoucherFront design={o.design} plan={plan} texts={texts} />
          <p className="mt-3 font-serif text-base italic leading-snug text-[#f5e8bd]">«{phrase}»</p>
          {o.from.trim() && <p className="mt-1 font-serif text-sm font-semibold text-[var(--gold-bright)]">da {o.from.trim()}</p>}
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={send}
        disabled={busy || !person}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 font-bold text-[var(--ink)] shadow disabled:opacity-50"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Regala e avvisa
      </button>

      {result && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-bold">🎁 Regalo inviato a {result.name}: ha ricevuto l’avviso e lo trova nel Wallet.</p>
          <p className="mt-1">
            Codice <span className="font-mono font-semibold">{result.code}</span>. Se vuoi, mandagli anche il biglietto su WhatsApp:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`🎁 ${name ? `${name}, h` : 'H'}o un regalo per te: un anno di KUMANI ${plan === 'pro' ? 'Pro' : 'Base'}! Aprilo qui: ${result.link}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white"
            >
              <Share2 className="h-4 w-4" /> WhatsApp
            </a>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(result.link).catch(() => {})
                setCopied(true)
                setTimeout(() => setCopied(false), 2500)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 font-semibold"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copiato' : 'Copia il link'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
