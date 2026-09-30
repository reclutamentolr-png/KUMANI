// Invio email transazionali con Resend (API HTTP, nessuna libreria).
// Variabili d'ambiente:
// - RESEND_API_KEY: chiave API di Resend
// - EMAIL_FROM: mittente su un dominio verificato in Resend,
//   es. "KUMANI <noreply@kumani.it>"
// Se mancano, l'email non parte (log) e il resto continua a funzionare.

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  text: string
  // Stessa chiave = stessa email: Resend non la rimanda (es. eventi Stripe ripetuti)
  idempotencyKey?: string
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
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
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`❌ Resend ${res.status} per ${input.to}:`, body.slice(0, 300))
      return { sent: false, error: `resend_${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    console.error('❌ Errore invio email con Resend:', err instanceof Error ? err.message : err)
    return { sent: false, error: 'network' }
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
