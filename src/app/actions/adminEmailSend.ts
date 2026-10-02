'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { KUMANI_MAILBOXES } from '@/lib/contactInfo'
import { escapeHtml, sendEmail } from '@/lib/email'
import { SITE_URL } from '@/lib/siteUrl'

// Admin → Invio Email: lo Staff scrive un'email da support@, privacy@ o
// info@kumani.io. Parte con Resend, una per destinatario (nessuno vede gli
// altri indirizzi); le risposte tornano all'indirizzo scelto e quindi, con
// l'inoltro di Cloudflare, nella Gmail di KUMANI. Ogni invio resta nello storico.

const MAX_RECIPIENTS = 20
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Testo scritto dallo Staff → HTML semplice: paragrafi, a capo e link cliccabili
function bodyToHtml(text: string, mailbox: (typeof KUMANI_MAILBOXES)[number]) {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) =>
      escapeHtml(p)
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#b8860b">$1</a>')
        .replace(/\n/g, '<br>'),
    )
    .map((p) => `<p style="margin:0 0 14px">${p}</p>`)
    .join('')
  const site = SITE_URL.replace(/^https?:\/\//, '')
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#171717">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
<div style="background:#171717;border-radius:12px 12px 0 0;padding:18px 24px;color:#d4af37;font-weight:bold;font-size:20px;letter-spacing:2px">KUMANI</div>
<div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px;font-size:15px;line-height:1.6">${paragraphs}
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e7e5e4;font-size:13px;color:#57534e"><b>${escapeHtml(mailbox.name)}</b><br><a href="mailto:${mailbox.address}" style="color:#57534e">${mailbox.address}</a> · <a href="${SITE_URL}" style="color:#57534e">${escapeHtml(site)}</a></p>
</div></div></body></html>`
}

const bodyToText = (text: string, mailbox: (typeof KUMANI_MAILBOXES)[number]) => `${text.trim()}\n\n--\n${mailbox.name}\n${mailbox.address} · ${SITE_URL}`

export type SendEmailForm = { from: string; to: string[]; subject: string; body: string; copyToSelf: boolean }

export async function adminSendEmail(form: SendEmailForm): Promise<{ success: boolean; error?: string; sent?: number; failed?: string[] }> {
  const admin = await verifyAdmin('support.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const mailbox = KUMANI_MAILBOXES.find((m) => m.address === form.from)
  if (!mailbox) return { success: false, error: 'Scegli il mittente' }
  const to = [...new Set(form.to.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (to.length === 0) return { success: false, error: 'Aggiungi almeno un destinatario' }
  if (to.length > MAX_RECIPIENTS) return { success: false, error: `Massimo ${MAX_RECIPIENTS} destinatari per invio` }
  const invalid = to.filter((e) => !EMAIL_RE.test(e))
  if (invalid.length) return { success: false, error: `Indirizzi non validi: ${invalid.join(', ')}` }
  const subject = form.subject.trim()
  const body = form.body.trim()
  if (!subject) return { success: false, error: 'Scrivi l’oggetto' }
  if (body.length < 2) return { success: false, error: 'Scrivi il messaggio' }
  if (subject.length > 200 || body.length > 20_000) return { success: false, error: 'Oggetto o messaggio troppo lunghi' }

  const from = `${mailbox.name} <${mailbox.address}>`
  const html = bodyToHtml(body, mailbox)
  const text = bodyToText(body, mailbox)

  let sent = 0
  const failed: string[] = []
  for (const recipient of to) {
    const res = await sendEmail({ to: recipient, from, replyTo: mailbox.address, subject, html, text })
    if (res.sent) sent++
    else failed.push(`${recipient} (${res.error})`)
  }

  // Copia nella Gmail di KUMANI: arriva all'indirizzo scelto, che la inoltra
  if (form.copyToSelf && sent > 0) {
    const note = `Copia dell'email inviata da ${mailbox.address} a: ${to.join(', ')}`
    await sendEmail({
      to: mailbox.address,
      from,
      subject: `[Copia] ${subject}`,
      html: html.replace('<div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px;font-size:15px;line-height:1.6">', `$&<p style="margin:0 0 16px;padding:8px 12px;background:#fef3c7;border-radius:8px;font-size:13px">${escapeHtml(note)}</p>`),
      text: `${note}\n\n${text}`,
    })
  }

  const { error: logError } = await db()
    .from('admin_sent_emails')
    .insert({ sent_by: admin.id, from_address: mailbox.address, to_addresses: to, subject, body, sent_count: sent, failed })
  if (logError) console.error('Storico email non salvato:', logError.message)

  if (sent === 0) return { success: false, error: `Nessuna email inviata: ${failed.join(', ')}`, sent, failed }
  return { success: true, sent, failed }
}

export type SentEmailRow = {
  id: string
  from_address: string
  to_addresses: string[]
  subject: string
  body: string
  sent_count: number
  failed: string[]
  created_at: string
  sender: string | null
}

export async function adminListSentEmails(): Promise<{ success: boolean; rows?: SentEmailRow[]; error?: string }> {
  if (!(await verifyAdmin('support.read'))) return { success: false, error: 'Non autorizzato' }
  const { data, error } = await db()
    .from('admin_sent_emails')
    .select('id, from_address, to_addresses, subject, body, sent_count, failed, created_at, sent_by')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return { success: false, error: error.code === '42P01' ? 'Esegui la migrazione 20261216100000_admin_sent_emails.sql per lo storico.' : error.message }
  const ids = [...new Set((data ?? []).map((r) => r.sent_by).filter(Boolean))] as string[]
  const { data: people } = ids.length ? await db().from('profiles').select('id, first_name, last_name').in('id', ids) : { data: [] }
  const names = new Map((people ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ')]))
  return {
    success: true,
    rows: (data ?? []).map(({ sent_by, ...r }) => ({ ...r, sender: sent_by ? (names.get(sent_by) ?? null) : null })),
  }
}
