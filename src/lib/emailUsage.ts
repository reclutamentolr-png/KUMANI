import { createClient as createServiceClient } from '@supabase/supabase-js'

// Email partite con Resend contate da KUMANI (tabella email_usage, giorno per
// giorno in ora italiana) e limiti del piano (system_settings). La chiave di
// Resend del sito può solo inviare, quindi il conteggio lo teniamo noi.
// Non comprende le email di accesso che Supabase invia per conto suo.

export type EmailUsage = { today: number; month: number; dayLimit: number; monthLimit: number; dayPct: number; monthPct: number }

export const EMAIL_ALERT_PCT = 90

export async function getEmailUsage(): Promise<EmailUsage | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date())
  const monthStart = `${today.slice(0, 7)}-01`
  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    db.from('email_usage').select('day, sent').gte('day', monthStart),
    db.from('system_settings').select('key, value').in('key', ['resend_daily_limit', 'resend_monthly_limit']),
  ])
  if (error) return null
  const limit = (key: string, fallback: number) => {
    const n = Number(String(settings?.find((s) => s.key === key)?.value ?? '').replace(/"/g, ''))
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  const dayLimit = limit('resend_daily_limit', 100)
  const monthLimit = limit('resend_monthly_limit', 3000)
  const todaySent = rows?.find((r) => r.day === today)?.sent ?? 0
  const month = (rows ?? []).reduce((sum, r) => sum + (r.sent ?? 0), 0)
  return { today: todaySent, month, dayLimit, monthLimit, dayPct: Math.round((todaySent / dayLimit) * 100), monthPct: Math.round((month / monthLimit) * 100) }
}
