'use client'

import { useEffect, useState } from 'react'
import { MailWarning } from 'lucide-react'
import { adminEmailUsage } from '@/app/actions/adminEmailUsage'
import { EMAIL_ALERT_PCT, type EmailUsage } from '@/lib/emailUsage'

// In cima all'Admin: compare solo quando le email inviate arrivano al 90% dei
// limiti gratuiti di Resend (giorno o mese), per controllare e se serve
// passare al piano a pagamento prima che le email si fermino.
export default function EmailQuotaAlert() {
  const [usage, setUsage] = useState<EmailUsage | null>(null)

  useEffect(() => {
    adminEmailUsage()
      .then(setUsage)
      .catch(() => {})
  }, [])

  if (!usage || (usage.dayPct < EMAIL_ALERT_PCT && usage.monthPct < EMAIL_ALERT_PCT)) return null
  const full = usage.dayPct >= 100 || usage.monthPct >= 100
  return (
    <div className={`flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 ${full ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`} role="alert">
      <MailWarning className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">{full ? 'Limite gratuito delle email raggiunto' : 'Email gratuite quasi finite'}</p>
        <p>
          Oggi {usage.today} di {usage.dayLimit} ({usage.dayPct}%) · questo mese {usage.month} di {usage.monthLimit} ({usage.monthPct}%).{' '}
          {full ? 'Oltre il limite Resend non invia: le email possono non arrivare.' : 'Controlla l’uso e, se serve, passa al piano a pagamento.'}
        </p>
        <p className="mt-1 text-xs opacity-80">Contate da KUMANI: non comprendono le email di accesso inviate da Supabase.</p>
      </div>
      <a href="https://resend.com/settings/billing" target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:underline">
        Apri Resend
      </a>
    </div>
  )
}
