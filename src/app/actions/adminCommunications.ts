'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { escapeHtml, sendEmail, sendEmailChunk, type SendEmailInput } from '@/lib/email'
import { getEmailUsage } from '@/lib/emailUsage'
import { unsubscribeUrl } from '@/lib/emailUnsubscribe'
import { KUMANI_MAILBOXES } from '@/lib/contactInfo'
import { PUBLIC_SITE_URL } from '@/lib/siteUrl'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { COMM_LOCALES, EMAIL_CHROME, isHeading, personalize, readyLocales, textsFor, type CommLocale } from '@/lib/communications'
import { emailBodyToText, isEmailLayout, parseEmailBody, renderLettera, renderRivista, type EmailLayout } from '@/lib/emailBlocks'
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
  email_result: { recipients?: number; sent?: number; failed?: number; excluded?: number; pending?: number; stopped?: string; byLocale?: Record<string, number> } | null
  translations: Partial<Record<CommLocale, Record<string, string>>> | null
  // Grafica dell'email e destinatari (tutti o solo chi ha un piano attivo)
  email_layout: EmailLayout
  audience: CommAudience
  // Lingue pronte (calcolate)
  ready?: CommLocale[]
}

export type UnsubscribeRow = { user_id: string; name: string; email: string | null; unsubscribed_at: string; from_title: string | null }

type Person = { id: string; email: string; first_name: string | null; locale: string | null }
export type CommAudience = 'all' | 'subscribers'

type PlanRow = { subscription_status: string | null; subscription_expires_at: string | null }
// Piano attivo e non scaduto (come i destinatari «attivi» delle notifiche)
const hasPlan = (p: PlanRow) => p.subscription_status === 'active' && (!p.subscription_expires_at || new Date(p.subscription_expires_at).getTime() > Date.now())

// Iscritti che ricevono le email: account attivi con un'email, meno chi si è
// disiscritto; con «subscribers» solo chi ha un piano attivo
async function emailAudience(audience: CommAudience = 'all'): Promise<{ people: Person[]; excluded: number }> {
  const s = db()
  const { data: rows, error } = await fetchAllRows<{ id: string; email: string | null; first_name: string | null; locale: string | null; is_blocked: boolean | null; deleted_at: string | null } & PlanRow>(
    (from, to) => s.from('profiles').select('id, email, first_name, locale, is_blocked, deleted_at, subscription_status, subscription_expires_at').order('id').range(from, to),
    100000,
  )
  if (error) throw new Error('profiles')
  // Chi non vuole email: se l'elenco non si legge, l'invio si ferma (mai email a chi si è disiscritto)
  const { data: off, error: offError } = await fetchAllRows<{ user_id: string }>((from, to) => s.from('email_unsubscribes').select('user_id').order('user_id').range(from, to), 100000)
  if (offError) throw new Error('unsubscribes')
  const offSet = new Set(off.map((r) => r.user_id))
  const valid = rows.filter((p) => p.email && /@/.test(p.email) && !p.deleted_at && !p.is_blocked && (audience === 'all' || hasPlan(p)))
  // Un'email sola per indirizzo, anche se due account lo condividono
  const seen = new Set<string>()
  const people = valid
    .filter((p) => !offSet.has(p.id))
    .map((p) => ({ id: p.id, email: p.email!.trim().toLowerCase(), first_name: p.first_name, locale: p.locale }))
    .filter((p) => (seen.has(p.email) ? false : (seen.add(p.email), true)))
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
  const subject = personalize(tx.email_subject ?? '', name)
  const layout = isEmailLayout(c.email_layout) ? c.email_layout : 'classic'
  // Grafica a blocchi («Rivista», «Lettera») o testo semplice («Classica»)
  const frame = { preheader: tx.email_preheader ?? '', unsubUrl: unsub, siteUrl: PUBLIC_SITE_URL, openLabel: chrome.open, why: chrome.why, stop: chrome.stop, pushNote: chrome.pushNote, locale: tx.locale, subject }
  const html =
    layout === 'rivista' ? renderRivista(parseEmailBody(body), frame)
    : layout === 'lettera' ? renderLettera(parseEmailBody(body), frame)
    : toHtml(c, body, unsub, tx.email_preheader ?? '', tx.locale)
  const plain = layout === 'classic' ? body.trim() : emailBodyToText(body)
  return {
    locale: tx.locale,
    to: person.email,
    from: `${mailbox.name} <${mailbox.address}>`,
    replyTo: mailbox.address,
    subject,
    html,
    text: `${plain}

${chrome.open}: ${PUBLIC_SITE_URL}/dashboard

--
${mailbox.name} · ${PUBLIC_SITE_URL}
${chrome.stop}: ${unsub}`,
    headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  }
}

export async function adminListCommunications(): Promise<{ items: CommunicationRow[]; emailPeople: number; emailExcluded: number; emailSubscribers: number; pushPeople: number; error?: string }> {
  if (!(await verifyAdmin('messages.read'))) return { items: [], emailPeople: 0, emailExcluded: 0, emailSubscribers: 0, pushPeople: 0, error: 'Non autorizzato' }
  const s = db()
  try {
    const [{ data, error }, audience, subscribers, subs] = await Promise.all([
      s.from('staff_communications').select('*').order('created_at', { ascending: false }).limit(200),
      emailAudience(),
      emailAudience('subscribers'),
      fetchAllRows<{ user_id: string }>((from, to) => s.from('push_subscriptions').select('user_id, id').order('id').range(from, to), 100000),
    ])
    if (error) return { items: [], emailPeople: 0, emailExcluded: 0, emailSubscribers: 0, pushPeople: 0, error: error.message }
    const items = ((data ?? []) as CommunicationRow[]).map((c) => ({ ...c, ready: readyLocales(c) }))
    return { items, emailPeople: audience.people.length, emailExcluded: audience.excluded, emailSubscribers: subscribers.people.length, pushPeople: new Set(subs.data.map((r) => r.user_id)).size }
  } catch {
    return { items: [], emailPeople: 0, emailExcluded: 0, emailSubscribers: 0, pushPeople: 0, error: 'Lettura non riuscita: riprova.' }
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
  // Prima la campanella di tutti (non si duplica se si riprova), poi le notifiche sul telefono
  const inbox = await addToInbox(c)
  // Una notifica per lingua dei dispositivi; toccandola si apre il messaggio completo
  const { data: subs } = await fetchAllRows<{ locale: string }>((from, to) => s.from('push_subscriptions').select('locale, id').order('id').range(from, to), 100000)
  const present = new Set(subs.map((x) => x.locale))
  let recipients = 0
  let sent = 0
  let failed = 0
  let firstError: string | undefined
  for (const locale of COMM_LOCALES) {
    if (!present.has(locale)) continue
    const tx = textsFor(c, locale)
    const r = await adminSendPushCampaign({ title: tx.push_title ?? c.push_title, body: tx.push_body ?? c.push_body, url: messageUrl(c), audience: c.audience === 'subscribers' ? 'active' : 'all', locale, skipInbox: true })
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
  const result = { recipients, sent, failed, inbox }
  await s.from('staff_communications').update({ push_result: result }).eq('id', id)
  return { success: true, recipients, sent }
}

// Avviso nella campanella di ogni account attivo, in tutte le lingue (si vede in quella della pagina)
async function addToInbox(c: CommunicationRow): Promise<number> {
  const s = db()
  const { data: rows, error } = await fetchAllRows<{ id: string; is_blocked: boolean | null; deleted_at: string | null } & PlanRow>(
    (from, to) => s.from('profiles').select('id, is_blocked, deleted_at, subscription_status, subscription_expires_at').order('id').range(from, to),
    100000,
  )
  if (error) return 0
  const texts = Object.fromEntries(
    COMM_LOCALES.map((l) => {
      const tx = textsFor(c, l)
      return [l, { title: tx.push_title ?? c.push_title, body: tx.push_body ?? c.push_body, url: messageUrl(c) }]
    }),
  )
  // Chi ce l'ha già (un invio ripetuto) non la riceve due volte
  const kind = `communication:${c.id}`
  const { data: already } = await fetchAllRows<{ user_id: string }>((from, to) => s.from('user_notifications').select('user_id, id').eq('kind', kind).order('id').range(from, to), 100000)
  const has = new Set(already.map((r) => r.user_id))
  const users = rows.filter((p) => !p.deleted_at && !p.is_blocked && !has.has(p.id) && (c.audience !== 'subscribers' || hasPlan(p))).map((p) => ({ user_id: p.id, category: 'staff', kind, texts }))
  let added = has.size
  for (let i = 0; i < users.length; i += 500) {
    const { error: e } = await s.from('user_notifications').insert(users.slice(i, i + 500))
    if (!e) added += Math.min(500, users.length - i)
    else console.error('[comunicazioni] campanella:', e.message)
  }
  return added
}

// Invio dell'email a tutti, ripetibile: chi l'ha già ricevuta è nel registro
// (staff_communication_deliveries) e non la riceve di nuovo. Si manda solo
// quanto permette il limite di Resend di oggi; il resto con «Invia ai mancanti».
export async function adminSendCommunicationEmail(id: string): Promise<{ success: boolean; error?: string; sent?: number; pending?: number }> {
  const admin = await verifyAdmin('messages.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const s = db()
  const { data: c } = await s.from('staff_communications').select('*').eq('id', id).maybeSingle<CommunicationRow>()
  if (!c) return { success: false, error: 'Comunicazione non trovata' }
  if (!c.email_subject || !c.email_body) return { success: false, error: 'Questa comunicazione non ha l’email' }
  // Un invio alla volta (il blocco scade da solo dopo 15 minuti)
  const lockLimit = new Date(Date.now() - 15 * 60_000).toISOString()
  const { data: locked } = await s
    .from('staff_communications')
    .update({ email_lock_at: new Date().toISOString() })
    .eq('id', id)
    .or(`email_lock_at.is.null,email_lock_at.lt.${lockLimit}`)
    .select('id')
  if (!locked?.length) return { success: false, error: 'Invio già in corso: aspetta qualche minuto e aggiorna.' }
  const started = Date.now()
  try {
    let audience: Awaited<ReturnType<typeof emailAudience>>
    try {
      audience = await emailAudience(c.audience === 'subscribers' ? 'subscribers' : 'all')
    } catch {
      return { success: false, error: 'Lettura degli iscritti non riuscita: invio annullato, riprova.' }
    }
    const { data: done, error: doneError } = await fetchAllRows<{ user_id: string }>(
      (from, to) => s.from('staff_communication_deliveries').select('user_id').eq('communication_id', id).order('user_id').range(from, to),
      100000,
    )
    if (doneError) return { success: false, error: 'Lettura del registro non riuscita: invio annullato, riprova.' }
    const delivered = new Set(done.map((r) => r.user_id))
    const pending = audience.people.filter((p) => !delivered.has(p.id))
    if (!pending.length) return { success: false, error: 'L’email è già arrivata a tutti gli iscritti.' }
    // Quante ne permette ancora il piano di Resend, oggi e questo mese
    const usage = await getEmailUsage()
    const room = usage ? Math.max(0, Math.min(usage.dayLimit - usage.today, usage.monthLimit - usage.month)) : pending.length
    if (room === 0)
      return { success: false, error: `Limite gratuito di Resend raggiunto (oggi ${usage?.today}/${usage?.dayLimit}, mese ${usage?.month}/${usage?.monthLimit}): riprova domani con «Invia ai mancanti».` }
    const targets = pending.slice(0, room)
    let sentNow = 0
    let stopped: string | undefined
    const byLocale: Record<string, number> = { ...(c.email_result?.byLocale ?? {}) }
    for (let i = 0; i < targets.length; i += 100) {
      // Margine sul tempo massimo della richiesta: il resto si manda dopo
      if (Date.now() - started > 90_000) {
        stopped = 'time'
        break
      }
      const chunk = targets.slice(i, i + 100)
      const emails = chunk.map((p) => buildEmail(c, p))
      const r = await sendEmailChunk(emails, `comm-${id}-${chunk[0].id}-${chunk.length}`)
      if (!r.ok) {
        stopped = r.error ?? 'error'
        break
      }
      const { error: logError } = await s
        .from('staff_communication_deliveries')
        .upsert(
          chunk.map((p) => ({ communication_id: id, user_id: p.id })),
          { onConflict: 'communication_id,user_id', ignoreDuplicates: true },
        )
      if (logError) console.error('[comunicazioni] registro invii:', logError.message)
      sentNow += chunk.length
      for (const e of emails) byLocale[e.locale] = (byLocale[e.locale] ?? 0) + 1
    }
    if (pending.length > targets.length && !stopped) stopped = 'quota'
    const total = delivered.size + sentNow
    const missing = Math.max(0, audience.people.length - total)
    await s
      .from('staff_communications')
      .update({
        ...(sentNow > 0 && !c.email_sent_at ? { email_sent_at: new Date().toISOString(), sent_by: admin.id } : {}),
        email_result: { recipients: audience.people.length, sent: total, pending: missing, excluded: audience.excluded, byLocale, ...(stopped ? { stopped } : {}) },
      })
      .eq('id', id)
    if (sentNow === 0) {
      const why = stopped === 'quota' ? 'limite di Resend raggiunto' : stopped === 'not_configured' ? 'email non configurate (Resend)' : 'nessuna email è partita'
      return { success: false, error: `Invio non riuscito: ${why}. Riprova più tardi.` }
    }
    return { success: true, sent: sentNow, pending: missing }
  } finally {
    await s.from('staff_communications').update({ email_lock_at: null }).eq('id', id)
  }
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

// Grafica e destinatari si cambiano finché nessun canale è partito
export async function adminSetCommunicationOptions(id: string, options: { email_layout?: EmailLayout; audience?: CommAudience }): Promise<{ success: boolean; error?: string }> {
  if (!(await verifyAdmin('messages.write'))) return { success: false, error: 'Non autorizzato' }
  const patch: Record<string, string> = {}
  if (options.email_layout !== undefined) {
    if (!isEmailLayout(options.email_layout)) return { success: false, error: 'Grafica non valida' }
    patch.email_layout = options.email_layout
  }
  if (options.audience !== undefined) {
    if (options.audience !== 'all' && options.audience !== 'subscribers') return { success: false, error: 'Destinatari non validi' }
    patch.audience = options.audience
  }
  if (!Object.keys(patch).length) return { success: true }
  const { data, error } = await db().from('staff_communications').update(patch).eq('id', id).is('push_sent_at', null).is('email_sent_at', null).select('id')
  if (error) return { success: false, error: error.message }
  return data?.length ? { success: true } : { success: false, error: 'Già inviata: non si può più cambiare' }
}
