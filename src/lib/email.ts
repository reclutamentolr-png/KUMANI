// Invio email transazionali con Resend (API HTTP, nessuna libreria).
// Variabili d'ambiente:
// - RESEND_API_KEY: chiave API di Resend
// - EMAIL_FROM: mittente su un dominio verificato in Resend,
//   es. "KUMANI <noreply@kumani.io>"
// Se mancano, l'email non parte (log) e il resto continua a funzionare.

import { createClient as createServiceClient } from '@supabase/supabase-js'

// Conteggio delle email partite (email_usage): l'Admin avvisa al 90% dei
// limiti del piano gratuito di Resend. Non blocca mai l'invio.
async function recordUsage(n: number) {
  if (n <= 0 || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  try {
    await createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }).rpc('email_usage_add', { p_n: n })
  } catch {
    // il conteggio è facoltativo
  }
}

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  text: string
  // Stessa chiave = stessa email: Resend non la rimanda (es. eventi Stripe ripetuti)
  idempotencyKey?: string
  // Mittente diverso da EMAIL_FROM (es. "KUMANI Supporto <support@kumani.io>") e indirizzo per le risposte
  from?: string
  replyTo?: string
  // Intestazioni in più (es. List-Unsubscribe per le comunicazioni a tutti)
  headers?: Record<string, string>
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = input.from ?? process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.warn(`✉️ Email non inviata a ${input.to} (RESEND_API_KEY o EMAIL_FROM mancanti): ${input.subject}`)
    return { sent: false, error: 'not_configured' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.headers ? { headers: input.headers } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`❌ Resend ${res.status} per ${input.to}:`, body.slice(0, 300))
      return { sent: false, error: `resend_${res.status}` }
    }
    const data = (await res.json().catch(() => null)) as { id?: string } | null
    await recordUsage(1)
    return { sent: true, id: data?.id }
  } catch (err) {
    console.error('❌ Errore invio email con Resend:', err instanceof Error ? err.message : err)
    return { sent: false, error: 'network' }
  }
}

// Fino a 100 email diverse in una chiamata sola (API batch di Resend): per le
// comunicazioni a tutti gli iscritti, una per persona (nessuno vede gli altri)
export async function sendEmailBatch(items: SendEmailInput[]): Promise<{ sent: number; failed: number; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const defaultFrom = process.env.EMAIL_FROM
  // Basta la chiave: il mittente predefinito serve solo per le email che non ne hanno uno
  if (!apiKey || items.some((e) => !e.from && !defaultFrom)) return { sent: 0, failed: items.length, error: 'not_configured' }
  let sent = 0
  let failed = 0
  let lastError: string | undefined
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100)
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          chunk.map((e) => ({
            from: e.from ?? defaultFrom,
            to: [e.to],
            subject: e.subject,
            html: e.html,
            text: e.text,
            ...(e.replyTo ? { reply_to: e.replyTo } : {}),
            ...(e.headers ? { headers: e.headers } : {}),
          })),
        ),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error(`❌ Resend batch ${res.status}:`, body.slice(0, 300))
        failed += chunk.length
        lastError = `resend_${res.status}`
        continue
      }
      sent += chunk.length
    } catch (err) {
      console.error('❌ Errore invio email (batch):', err instanceof Error ? err.message : err)
      failed += chunk.length
      lastError = 'network'
    }
  }
  await recordUsage(sent)
  return { sent, failed, error: lastError }
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
