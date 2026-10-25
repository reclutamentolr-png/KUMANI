'use client'

import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { adminEmailUsage } from '@/app/actions/adminEmailUsage'
import { EMAIL_ALERT_PCT, type EmailUsage } from '@/lib/emailUsage'

// Admin → Panoramica: email inviate con Resend oggi e nel mese rispetto ai
// limiti del piano gratuito, sempre visibili. Arancione dal 90%, rosso al 100%
// (in quel caso compare anche l'avviso in cima a tutto l'Admin).

function Bar({ label, used, limit, pct }: { label: string; used: number; limit: number; pct: number }) {
  const tone = pct >= 100 ? 'bg-red-500' : pct >= EMAIL_ALERT_PCT ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className={`font-bold ${pct >= EMAIL_ALERT_PCT ? 'text-amber-700' : 'text-gray-900'}`}>
          {used.toLocaleString('it-IT')} / {limit.toLocaleString('it-IT')} <span className="font-normal text-gray-500">({pct}%)</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

export default function EmailUsageCard() {
  const [usage, setUsage] = useState<EmailUsage | null>(null)
  useEffect(() => {
    adminEmailUsage()
      .then(setUsage)
      .catch(() => {})
  }, [])
  if (!usage) return null
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-gray-900">
          <Mail className="h-4 w-4 text-[var(--gold)]" /> Email inviate con Resend (piano gratuito)
        </h3>
        <a href="https://resend.com/emails" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[var(--gold)] hover:underline">
          Apri Resend
        </a>
      </div>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row">
        <Bar label="Oggi" used={usage.today} limit={usage.dayLimit} pct={usage.dayPct} />
        <Bar label="Questo mese" used={usage.month} limit={usage.monthLimit} pct={usage.monthPct} />
      </div>
      <p className="mt-2 text-xs text-gray-500">Contate da KUMANI a ogni invio (mese di ottobre allineato a Resend il 25/10). Al 90% compare l’avviso in cima all’Admin.</p>
    </section>
  )
}
