'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LoaderCircle, UserPlus } from 'lucide-react'
import { claimLateSponsor } from '@/app/actions/lateSponsor'
import { askConfirm } from '@/lib/confirm'

// Dashboard: chi si è iscritto senza codice può indicare, entro la data
// mostrata, il codice di chi l'ha invitato (una sola volta).
export default function LateSponsorCard({ until }: { until: string }) {
  const t = useTranslations('lateSponsor')
  const locale = useLocale()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date(until))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    if (!(await askConfirm(t('confirm', { code: code.trim().toUpperCase() })))) return
    setBusy(true)
    const r = await claimLateSponsor(code)
    setBusy(false)
    if (r.success) {
      setMessage({ ok: true, text: t('done', { name: r.sponsorName ?? code.trim().toUpperCase() }) })
      router.refresh()
    } else {
      const known = ['invalid_code', 'self', 'expired', 'has_team', 'already'].includes(r.code)
      setMessage({ ok: false, text: t(known ? `error_${r.code}` : 'error_generic') })
    }
  }

  if (message?.ok) return <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">{message.text}</p>

  return (
    <section className="rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-bold text-[var(--ink)]">
        <UserPlus className="h-5 w-5 text-[var(--gold)]" /> {t('title')}
      </h2>
      <p className="mt-1 text-sm text-[var(--ink)]/80">{t('text', { date })}</p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          maxLength={40}
          className="min-w-[200px] flex-1 rounded-xl border border-[var(--gold)]/50 bg-white px-3 py-2.5 text-sm uppercase text-[var(--ink)] outline-none focus:border-[var(--gold)]"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-125 disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('button')}
        </button>
      </form>
      {message && !message.ok && <p className="mt-2 text-sm text-red-700">{message.text}</p>}
    </section>
  )
}
