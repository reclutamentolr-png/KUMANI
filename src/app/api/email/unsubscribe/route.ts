import { createClient as createServiceClient } from '@supabase/supabase-js'
import { validUnsubscribe } from '@/lib/emailUnsubscribe'
import { escapeHtml } from '@/lib/email'

// «Non ricevere più queste email»: il link dell'email apre una pagina con la
// conferma (GET non cambia nulla: alcuni programmi di posta aprono i link da
// soli); la conferma, o il «disiscriviti» del programma di posta
// (List-Unsubscribe-Post), arriva in POST. Le notifiche push non cambiano.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const page = (title: string, text: string, form = '') =>
  new Response(
    `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} · KUMANI</title></head>
<body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#171717">
<div style="max-width:520px;margin:40px auto;padding:0 16px">
<div style="background:#171717;border-radius:12px 12px 0 0;padding:18px 24px;color:#d4af37;font-weight:bold;font-size:20px;letter-spacing:2px">KUMANI</div>
<div style="background:#fff;border-radius:0 0 12px 12px;padding:24px;font-size:15px;line-height:1.6">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1><p style="margin:0 0 16px">${text}</p>${form}
<p style="margin:24px 0 0;font-size:13px;color:#57534e"><a href="https://kumani.io" style="color:#57534e">kumani.io</a></p>
</div></div></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )

const button = (label: string, action: string, query: string, primary: boolean) =>
  `<form method="post" action="/api/email/unsubscribe?${escapeHtml(query)}" style="margin:0 0 10px"><input type="hidden" name="action" value="${action}"><button type="submit" style="border:0;border-radius:10px;padding:12px 18px;font-size:15px;font-weight:bold;cursor:pointer;${primary ? 'background:#171717;color:#fff' : 'background:#f5f5f4;color:#171717'}">${escapeHtml(label)}</button></form>`

const params = (req: Request) => {
  const url = new URL(req.url)
  const u = url.searchParams.get('u') ?? ''
  const t = url.searchParams.get('t') ?? ''
  const c = url.searchParams.get('c') ?? ''
  return { u, t, c: /^[0-9a-f-]{36}$/i.test(c) ? c : null, query: url.searchParams.toString() }
}

const invalid = () => page('Link non valido', 'Questo link non è valido o è incompleto. Puoi scriverci a <a href="mailto:support@kumani.io">support@kumani.io</a>.')

export async function GET(req: Request) {
  const { u, t, query } = params(req)
  if (!validUnsubscribe(u, t)) return invalid()
  const { data } = await db().from('email_unsubscribes').select('user_id').eq('user_id', u).maybeSingle()
  if (data)
    return page(
      'Non ricevi più le nostre email',
      'Hai già scelto di non ricevere le comunicazioni di KUMANI via email. Le notifiche nell’app restano come le hai impostate.',
      button('Voglio di nuovo ricevere le email', 'resubscribe', query, false),
    )
  return page(
    'Non vuoi più ricevere le nostre email?',
    'Confermando non riceverai più le comunicazioni di KUMANI via email (novità, aggiornamenti, messaggi a tutti gli iscritti). Le email necessarie per il tuo account, come pagamenti e accesso, continueranno ad arrivare. Le notifiche nell’app restano come le hai impostate.',
    button('Sì, non inviatemi più email', 'unsubscribe', query, true),
  )
}

export async function POST(req: Request) {
  const { u, t, c, query } = params(req)
  if (!validUnsubscribe(u, t)) return invalid()
  const form = await req.formData().catch(() => null)
  const action = form?.get('action') === 'resubscribe' ? 'resubscribe' : 'unsubscribe'
  const s = db()
  if (action === 'resubscribe') {
    await s.from('email_unsubscribes').delete().eq('user_id', u)
    return page('Ben ritrovato!', 'Riceverai di nuovo le comunicazioni di KUMANI via email.')
  }
  const { data: profile } = await s.from('profiles').select('email').eq('id', u).maybeSingle()
  const { error } = await s.from('email_unsubscribes').upsert({ user_id: u, email: profile?.email ?? null, communication_id: c }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (error) return page('Qualcosa non ha funzionato', 'Non siamo riusciti a salvare la tua scelta: riprova tra poco o scrivici a <a href="mailto:support@kumani.io">support@kumani.io</a>.')
  return page(
    'Fatto: niente più email',
    'Non riceverai più le comunicazioni di KUMANI via email. Le notifiche nell’app restano come le hai impostate.',
    button('Ho cambiato idea: voglio ricevere le email', 'resubscribe', query, false),
  )
}
