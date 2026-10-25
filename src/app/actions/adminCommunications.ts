'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { escapeHtml, sendEmail, sendEmailBatch, type SendEmailInput } from '@/lib/email'
import { unsubscribeUrl } from '@/lib/emailUnsubscribe'
import { KUMANI_MAILBOXES } from '@/lib/contactInfo'
import { PUBLIC_SITE_URL } from '@/lib/siteUrl'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { COMM_LOCALES, EMAIL_CHROME, isHeading, personalize, readyLocales, textsFor, type CommLocale } from '@/lib/communications'
import { adminSendPushCampaign } from './push'

// Admin → Comunicazioni: i messaggi a tutti gli iscritti preparati in anticipo
// (notifica push e/o email). Lo Staff li invia quando vuole; ogni canale si
// invia una volta sola e resta nello storico. Le email escludono chi ha scelto
// «Non ricevere più queste email» (email_unsubscribes); le push seguono le
// impostazioni delle notifiche di ciascuno. Ognuno riceve la sua lingua
// (lib/communications: traduzioni e lingue di riserva).

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export type CommunicationRow = {
  id: string
  title: string
  push_title: string | null
  push_body: string | null
  push_url: string | null
  email_subject: string | null
  email_preheader: string | null
  email_body: string | null
  email_from: string
  note: string | null
  created_at: string
  push_sent_at: string | null
  push_result: { recipients?: number; sent?: number; failed?: number; inbox?: number } | null
  email_sent_at: string | null
  email_result: { recipients?: number; sent?: number; failed?: number; excluded?: number; byLocale?: Record<string, number> } | null
  translations: Partial<Record<CommLocale, Record<string, string>>> | null
  // Lingue pronte (calcolate)
  ready?: CommLocale[]
}

export type UnsubscribeRow = { user_id: string; name: string; email: string | null; unsubscribed_at: string; from_title: string | null }

type Person = { id: string; email: string; first_name: string | null; locale: string | null }

// Iscritti che ricevono le email: account attivi con un'email, meno chi si è disiscritto
async function emailAudience(): Promise<{ people: Person[]; excluded: number }> {
  const s = db()
  const { data: rows, error } = await fetchAllRows<{ id: string; email: string | null; first_name: string | null; locale: string | null; is_blocked: boolean | null; deleted_at: string | null }>(
    (from, to) => s.from('profiles').select('id, email, first_name, locale, is_blocked, deleted_at').order('id').range(from, to),
    100000,
  )
  if (error) throw new Error('profiles')
  const { data: off } = await s.from('email_unsubscribes').select('user_id')
  const offSet = new Set((off ?? []).map((r) => r.user_id as string))
  const valid = rows.filter((p) => p.email && /@/.test(p.email) && !p.deleted_at && !p.is_blocked)
  const people = valid.filter((p) => !offSet.has(p.id)).map((p) => ({ id: p.id, email: p.email!.trim().toLowerCase(), first_name: p.first_name, locale: p.locale }))
  return { people, excluded: valid.length - people.length }
}

// Pagina del messaggio completo (src/app/[locale]/messaggio/[id])
const messageUrl = (c: { id: string }) => `/messaggio/${c.id}`

const firstName = (n: string | null) => {
  const v = (n ?? '').trim().split(/\s+/)[0] ?? ''
  return v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : ''
}

// Testo → HTML: paragrafi, righe in MAIUSCOLO come titoletti, link cliccabili
function toHtml(c: CommunicationRow, body: string, unsubUrl: string, preheader: string, locale: CommLocale) {
  const chrome = EMAIL_CHROME[locale]
  const mailbox = KUMANI_MAILBOXES.find((m) => m.address === c.email_from) ?? KUMANI_MAILBOXES[2]
  const para = body
    .trim()
    .split(/\n{2,}/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => {
          const safe = escapeHtml(line).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#b8860b">$1</a>')
          return isHeading(line) ? `<b style="color:#8a6a1f;letter-spacing:.5px">${safe}</b>` : safe
        })
        .join('<br>'),
    )
    .map((p) => `<p style="margin:0 0 14px">${p}</p>`)
    .join('')
  const site = PUBLIC_SITE_URL.replace(/^https?:\/\//, '')
  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#171717">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
<div style="background:#171717;border-radius:12px 12px 0 0;padding:18px 24px;color:#d4af37;font-weight:bold;font-size:20px;letter-spacing:2px">KUMANI</div>
<div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px;font-size:15px;line-height:1.6">${para}
<p style="margin:20px 0 0"><a href="${PUBLIC_SITE_URL}/dashboard" style="display:inline-block;background:#171717;color:#d4af37;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">${escapeHtml(chrome.open)}</a></p>
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e7e5e4;font-size:13px;color:#57534e"><b>${escapeHtml(mailbox.name)}</b> · <a href="${PUBLIC_SITE_URL}" style="color:#57534e">${escapeHtml(site)}</a></p>
</div>
<p style="margin:16px 8px 0;font-size:12px;color:#78716c;text-align:center">${escapeHtml(chrome.why)} <a href="${unsubUrl}" style="color:#78716c">${escapeHtml(chrome.stop)}</a> (${escapeHtml(chrome.pushNote)}).</p>
</div></body></html>`
}

function buildEmail(c: CommunicationRow, person: Person): SendEmailInput & { locale: CommLocale } {
  const mailbox = KUMANI_MAILBOXES.find((m) => m.address === c.email_from) ?? KUMANI_MAILBOXES[2]
  const name = firstName(person.first_name)
  const tx = textsFor(c, person.locale)
  const chrome = EMAIL_CHROME[tx.locale]
  const body = personalize(tx.email_body ?? '', name)
  const unsub = unsubscribeUrl(person.id, c.id, tx.locale)
  return {
    locale: tx.locale,
    to: person.email,
    from: `${mailbox.name} <${mailbox.address}>`,
    replyTo: mailbox.address,
    subject: personalize(tx.email_subject ?? '', name),
    html: toHtml(c, body, unsub, tx.email_preheader ?? '', tx.locale),
    text: `${body.trim()}

${chrome.open}: ${PUBLIC_SITE_URL}/dashboard

--
${mailbox.name} · ${PUBLIC_SITE_URL}
${chrome.stop}: ${unsub}`,
    headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  }
}

export async function adminListCommunications(): Promise<{ items: CommunicationRow[]; emailPeople: number; emailExcluded: number; pushPeople: number; error?: string }> {
  if (!(await verifyAdmin('messages.read'))) return { items: [], emailPeople: 0, emailExcluded: 0, pushPeople: 0, error: 'Non autorizzato' }
  const s = db()
  try {
    const [{ data, error }, audience, { data: subs }] = await Promise.all([
      s.from('staff_communications').select('*').order('created_at', { ascending: false }).limit(200),
      emailAudience(),
      s.from('push_subscriptions').select('user_id'),
    ])
    if (error) return { items: [], emailPeople: 0, emailExcluded: 0, pushPeople: 0, error: error.message }
    const items = ((data ?? []) as CommunicationRow[]).map((c) => ({ ...c, ready: readyLocales(c) }))
    return { items, emailPeople: audience.people.length, emailExcluded: audience.excluded, pushPeople: new Set((subs ?? []).map((r) => r.user_id)).size }
  } catch {
    return { items: [], emailPeople: 0, emailExcluded: 0, pushPeople: 0, error: 'Lettura non riuscita: riprova.' }
  }
}

export async function adminSendCommunicationPush(id: string): Promise<{ success: boolean; error?: string; recipients?: number; sent?: number }> {
  const admin = await verifyAdmin('messages.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const s = db()
  const { data: c } = await s.from('staff_communications').select('*').eq('id', id).maybeSingle<CommunicationRow>()
  if (!c) return { success: false, error: 'Comunicazione non trovata' }
  if (c.push_sent_at) return { success: false, error: 'Notifica già inviata' }
  if (!c.push_title || !c.push_body) return { success: false, error: 'Questa comunicazione non ha la notifica push' }
  // Segnata subito come inviata: un secondo clic non la rimanda
  const { data: claimed } = await s.from('staff_communications').update({ push_sent_at: new Date().toISOString(), sent_by: admin.id }).eq('id', id).is('push_sent_at', null).select('id')
  if (!claimed?.length) return { success: false, error: 'Notifica già inviata' }
  // Una notifica per lingua dei dispositivi; toccandola si apre il messaggio completo
  const { data: subs } = await s.from('push_subscriptions').select('locale')
  const present = new Set((subs ?? []).map((x) => x.locale as string))
  let recipients = 0
  let sent = 0
  let failed = 0
  let firstError: string | undefined
  for (const locale of COMM_LOCALES) {
    if (!present.has(locale)) continue
    const tx = textsFor(c, locale)
    const r = await adminSendPushCampaign({ title: tx.push_title ?? c.push_title, body: tx.push_body ?? c.push_body, url: messageUrl(c), audience: 'all', locale })
    if (!r.success) {
      firstError ??= r.error
      continue
    }
    recipients += r.recipients ?? 0
    sent += r.sent ?? 0
    failed += r.failed ?? 0
  }
  if (!sent && firstError) {
    await s.from('staff_communications').update({ push_sent_at: null }).eq('id', id)
    return { success: false, error: firstError }
  }
  // Anche nel Centro avvisi (campanella) di tutti gli iscritti, con o senza notifiche sul telefono
  const inbox = await addToInbox(c)
  const result = { recipients, sent, failed, inbox }
  await s.from('staff_communications').update({ push_result: result }).eq('id', id)
  return { success: true, recipients, sent }
}

// Avviso nella campanella di ogni account attivo, in tutte le lingue (si vede in quella della pagina)
async function addToInbox(c: CommunicationRow): Promise<number> {
  const s = db()
  const { data: rows, error } = await fetchAllRows<{ id: string; is_blocked: boolean | null; deleted_at: string | null }>(
    (from, to) => s.from('profiles').select('id, is_blocked, deleted_at').order('id').range(from, to),
    100000,
  )
  if (error) return 0
  const texts = Object.fromEntries(
    COMM_LOCALES.map((l) => {
      const tx = textsFor(c, l)
      return [l, { title: tx.push_title ?? c.push_title, body: tx.push_body ?? c.push_body, url: messageUrl(c) }]
    }),
  )
  const users = rows.filter((p) => !p.deleted_at && !p.is_blocked).map((p) => ({ user_id: p.id, category: 'staff', kind: `communication:${c.id}`, texts }))
  let added = 0
  for (let i = 0; i < users.length; i += 500) {
    const { error: e } = await s.from('user_notifications').insert(users.slice(i, i + 500))
    if (!e) added += Math.min(500, users.length - i)
    else console.error('[comunicazioni] campanella:', e.message)
  }
  return added
}

export async function adminSendCommunicationEmail(id: string): Promise<{ success: boolean; error?: string; sent?: number; failed?: number }> {
  const admin = await verifyAdmin('messages.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const s = db()
  const { data: c } = await s.from('staff_communications').select('*').eq('id', id).maybeSingle<CommunicationRow>()
  if (!c) return { success: false, error: 'Comunicazione non trovata' }
  if (c.email_sent_at) return { success: false, error: 'Email già inviata' }
  if (!c.email_subject || !c.email_body) return { success: false, error: 'Questa comunicazione non ha l’email' }
  let audience: Awaited<ReturnType<typeof emailAudience>>
  try {
    audience = await emailAudience()
  } catch {
    return { success: false, error: 'Lettura degli iscritti non riuscita: invio annullato, riprova.' }
  }
  if (!audience.people.length) return { success: false, error: 'Nessun iscritto da raggiungere' }
  const { data: claimed } = await s.from('staff_communications').update({ email_sent_at: new Date().toISOString(), sent_by: admin.id }).eq('id', id).is('email_sent_at', null).select('id')
  if (!claimed?.length) return { success: false, error: 'Email già inviata' }
  const emails = audience.people.map((p) => buildEmail(c, p))
  const byLocale: Record<string, number> = {}
  for (const e of emails) byLocale[e.locale] = (byLocale[e.locale] ?? 0) + 1
  const r = await sendEmailBatch(emails)
  if (r.sent === 0) {
    await s.from('staff_communications').update({ email_sent_at: null }).eq('id', id)
    return { success: false, error: r.error === 'not_configured' ? 'Email non configurate (Resend).' : 'Invio non riuscito: nessuna email è partita, riprova.' }
  }
  await s.from('staff_communications').update({ email_result: { recipients: audience.people.length, sent: r.sent, failed: r.failed, excluded: audience.excluded, byLocale } }).eq('id', id)
  return { success: true, sent: r.sent, failed: r.failed }
}

// Prova: la stessa email solo a chi sta usando l'Admin (non conta come invio)
export async function adminTestCommunicationEmail(id: string, locale: string = 'it'): Promise<{ success: boolean; error?: string; to?: string }> {
  const admin = await verifyAdmin('messages.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const s = db()
  const { data: c } = await s.from('staff_communications').select('*').eq('id', id).maybeSingle<CommunicationRow>()
  if (!c?.email_subject || !c.email_body) return { success: false, error: 'Questa comunicazione non ha l’email' }
  const { data: me } = await s.from('profiles').select('id, email, first_name').eq('id', admin.id).maybeSingle()
  if (!me?.email) return { success: false, error: 'Il tuo account non ha un’email' }
  const email = buildEmail(c, { id: me.id, email: me.email, first_name: me.first_name, locale })
  const r = await sendEmail({ ...email, subject: `[${EMAIL_CHROME[email.locale].test}] ${email.subject}` })
  return r.sent ? { success: true, to: me.email } : { success: false, error: 'Invio della prova non riuscito' }
}

// Anteprima dell'email come la vedrà una persona (nome di esempio)
export async function adminPreviewCommunicationEmail(id: string, locale: string = 'it'): Promise<{ html?: string; error?: string }> {
  const admin = await verifyAdmin('messages.read')
  if (!admin) return { error: 'Non autorizzato' }
  const { data: c } = await db().from('staff_communications').select('*').eq('id', id).maybeSingle<CommunicationRow>()
  if (!c?.email_body) return { error: 'Nessuna email' }
  return { html: buildEmail(c, { id: admin.id, email: 'esempio@kumani.io', first_name: 'Marco', locale }).html }
}

export async function adminEmailUnsubscribes(): Promise<{ rows: UnsubscribeRow[]; error?: string }> {
  if (!(await verifyAdmin('messages.read'))) return { rows: [], error: 'Non autorizzato' }
  const s = db()
  const { data, error } = await s.from('email_unsubscribes').select('user_id, email, unsubscribed_at, communication_id').order('unsubscribed_at', { ascending: false }).limit(1000)
  if (error) return { rows: [], error: error.message }
  const ids = (data ?? []).map((r) => r.user_id as string)
  const comms = [...new Set((data ?? []).map((r) => r.communication_id).filter(Boolean))] as string[]
  const [{ data: people }, { data: titles }] = await Promise.all([
    ids.length ? s.from('profiles').select('id, first_name, last_name, email').in('id', ids) : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null }[] }),
    comms.length ? s.from('staff_communications').select('id, title').in('id', comms) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ])
  const byId = new Map((people ?? []).map((p) => [p.id, p]))
  const titleById = new Map((titles ?? []).map((t) => [t.id, t.title]))
  return {
    rows: (data ?? []).map((r) => {
      const p = byId.get(r.user_id as string)
      return {
        user_id: r.user_id as string,
        name: p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : '',
        email: p?.email ?? (r.email as string | null),
        unsubscribed_at: r.unsubscribed_at as string,
        from_title: r.communication_id ? (titleById.get(r.communication_id as string) ?? null) : null,
      }
    }),
  }
}

// Lo Staff può rimettere una persona tra chi riceve le email (su sua richiesta)
export async function adminResubscribeEmail(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!(await verifyAdmin('messages.write'))) return { success: false, error: 'Non autorizzato' }
  const { error } = await db().from('email_unsubscribes').delete().eq('user_id', userId)
  return error ? { success: false, error: error.message } : { success: true }
}
