import { createClient as createServiceClient } from '@supabase/supabase-js'
import { validUnsubscribe } from '@/lib/emailUnsubscribe'
import { escapeHtml } from '@/lib/email'
import { isCommLocale, type CommLocale } from '@/lib/communications'

// «Non ricevere più queste email»: il link dell'email apre una pagina con la
// conferma (GET non cambia nulla: alcuni programmi di posta aprono i link da
// soli); la conferma, o il «disiscriviti» del programma di posta
// (List-Unsubscribe-Post), arriva in POST. Le notifiche push non cambiano.
// La pagina parla la lingua dell'email (parametro l).

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

type Texts = { invalidT: string; invalidX: string; askT: string; askX: string; askB: string; alreadyT: string; alreadyX: string; backB: string; doneT: string; doneX: string; againT: string; againX: string; errT: string; errX: string }

const T: Record<CommLocale, Texts> = {
  it: {
    invalidT: 'Link non valido',
    invalidX: 'Questo link non è valido o è incompleto. Puoi scriverci a',
    askT: 'Non vuoi più ricevere le nostre email?',
    askX: 'Confermando non riceverai più le comunicazioni di KUMANI via email (novità, aggiornamenti, messaggi a tutti gli iscritti). Le email necessarie per il tuo account, come pagamenti e accesso, continueranno ad arrivare. Le notifiche nell’app restano come le hai impostate.',
    askB: 'Sì, non inviatemi più email',
    alreadyT: 'Non ricevi più le nostre email',
    alreadyX: 'Hai già scelto di non ricevere le comunicazioni di KUMANI via email. Le notifiche nell’app restano come le hai impostate.',
    backB: 'Voglio di nuovo ricevere le email',
    doneT: 'Fatto: niente più email',
    doneX: 'Non riceverai più le comunicazioni di KUMANI via email. Le notifiche nell’app restano come le hai impostate.',
    againT: 'Ben ritrovato!',
    againX: 'Riceverai di nuovo le comunicazioni di KUMANI via email.',
    errT: 'Qualcosa non ha funzionato',
    errX: 'Non siamo riusciti a salvare la tua scelta: riprova tra poco o scrivici a',
  },
  en: {
    invalidT: 'Invalid link',
    invalidX: 'This link is not valid or is incomplete. You can write to us at',
    askT: 'Don’t want our emails any more?',
    askX: 'If you confirm, you will no longer receive KUMANI news by email (updates and messages to all members). Emails needed for your account, such as payments and sign-in, will still arrive. In-app notifications stay as you set them.',
    askB: 'Yes, stop sending me emails',
    alreadyT: 'You no longer receive our emails',
    alreadyX: 'You have already chosen not to receive KUMANI news by email. In-app notifications stay as you set them.',
    backB: 'I want to receive emails again',
    doneT: 'Done: no more emails',
    doneX: 'You will no longer receive KUMANI news by email. In-app notifications stay as you set them.',
    againT: 'Welcome back!',
    againX: 'You will receive KUMANI news by email again.',
    errT: 'Something went wrong',
    errX: 'We couldn’t save your choice: try again shortly or write to us at',
  },
  fr: {
    invalidT: 'Lien non valide',
    invalidX: 'Ce lien n’est pas valide ou est incomplet. Vous pouvez nous écrire à',
    askT: 'Vous ne voulez plus recevoir nos e-mails ?',
    askX: 'En confirmant, vous ne recevrez plus les communications de KUMANI par e-mail (nouveautés et messages à tous les inscrits). Les e-mails nécessaires à votre compte, comme les paiements et la connexion, continueront d’arriver. Les notifications de l’app restent comme vous les avez réglées.',
    askB: 'Oui, ne m’envoyez plus d’e-mails',
    alreadyT: 'Vous ne recevez plus nos e-mails',
    alreadyX: 'Vous avez déjà choisi de ne plus recevoir les communications de KUMANI par e-mail. Les notifications de l’app restent comme vous les avez réglées.',
    backB: 'Je veux à nouveau recevoir les e-mails',
    doneT: 'C’est fait : plus d’e-mails',
    doneX: 'Vous ne recevrez plus les communications de KUMANI par e-mail. Les notifications de l’app restent comme vous les avez réglées.',
    againT: 'Content de vous revoir !',
    againX: 'Vous recevrez à nouveau les communications de KUMANI par e-mail.',
    errT: 'Un problème est survenu',
    errX: 'Nous n’avons pas pu enregistrer votre choix : réessayez bientôt ou écrivez-nous à',
  },
  es: {
    invalidT: 'Enlace no válido',
    invalidX: 'Este enlace no es válido o está incompleto. Puedes escribirnos a',
    askT: '¿No quieres recibir más nuestros correos?',
    askX: 'Si confirmas, ya no recibirás las comunicaciones de KUMANI por correo (novedades y mensajes a todos los registrados). Los correos necesarios para tu cuenta, como pagos y acceso, seguirán llegando. Las notificaciones de la app siguen como las configuraste.',
    askB: 'Sí, no me enviéis más correos',
    alreadyT: 'Ya no recibes nuestros correos',
    alreadyX: 'Ya elegiste no recibir las comunicaciones de KUMANI por correo. Las notificaciones de la app siguen como las configuraste.',
    backB: 'Quiero volver a recibir los correos',
    doneT: 'Hecho: no más correos',
    doneX: 'Ya no recibirás las comunicaciones de KUMANI por correo. Las notificaciones de la app siguen como las configuraste.',
    againT: '¡Bienvenido de nuevo!',
    againX: 'Volverás a recibir las comunicaciones de KUMANI por correo.',
    errT: 'Algo no ha funcionado',
    errX: 'No hemos podido guardar tu elección: inténtalo de nuevo en un rato o escríbenos a',
  },
  pt: {
    invalidT: 'Link inválido',
    invalidX: 'Este link não é válido ou está incompleto. Pode escrever-nos para',
    askT: 'Já não quer receber os nossos emails?',
    askX: 'Ao confirmar, deixa de receber as comunicações da KUMANI por email (novidades e mensagens a todos os registados). Os emails necessários para a sua conta, como pagamentos e acesso, continuam a chegar. As notificações da app ficam como as definiu.',
    askB: 'Sim, não me enviem mais emails',
    alreadyT: 'Já não recebe os nossos emails',
    alreadyX: 'Já escolheu não receber as comunicações da KUMANI por email. As notificações da app ficam como as definiu.',
    backB: 'Quero voltar a receber os emails',
    doneT: 'Feito: sem mais emails',
    doneX: 'Deixa de receber as comunicações da KUMANI por email. As notificações da app ficam como as definiu.',
    againT: 'Bem-vindo de volta!',
    againX: 'Vai voltar a receber as comunicações da KUMANI por email.',
    errT: 'Algo correu mal',
    errX: 'Não conseguimos guardar a sua escolha: tente de novo daqui a pouco ou escreva-nos para',
  },
  de: {
    invalidT: 'Ungültiger Link',
    invalidX: 'Dieser Link ist ungültig oder unvollständig. Du kannst uns schreiben an',
    askT: 'Keine E-Mails mehr von uns?',
    askX: 'Wenn du bestätigst, erhältst du keine Mitteilungen von KUMANI mehr per E-Mail (Neuigkeiten und Nachrichten an alle Mitglieder). E-Mails, die für dein Konto nötig sind, wie Zahlungen und Anmeldung, kommen weiterhin. Die Benachrichtigungen in der App bleiben, wie du sie eingestellt hast.',
    askB: 'Ja, keine E-Mails mehr',
    alreadyT: 'Du erhältst keine E-Mails mehr von uns',
    alreadyX: 'Du hast bereits entschieden, keine Mitteilungen von KUMANI per E-Mail zu erhalten. Die Benachrichtigungen in der App bleiben, wie du sie eingestellt hast.',
    backB: 'Ich möchte wieder E-Mails erhalten',
    doneT: 'Erledigt: keine E-Mails mehr',
    doneX: 'Du erhältst keine Mitteilungen von KUMANI mehr per E-Mail. Die Benachrichtigungen in der App bleiben, wie du sie eingestellt hast.',
    againT: 'Schön, dass du wieder da bist!',
    againX: 'Du erhältst wieder Mitteilungen von KUMANI per E-Mail.',
    errT: 'Etwas hat nicht funktioniert',
    errX: 'Wir konnten deine Wahl nicht speichern: versuche es gleich noch einmal oder schreib uns an',
  },
  ru: {
    invalidT: 'Ссылка недействительна',
    invalidX: 'Эта ссылка недействительна или неполная. Вы можете написать нам на',
    askT: 'Больше не хотите получать наши письма?',
    askX: 'После подтверждения вы больше не будете получать рассылки KUMANI по почте (новости и сообщения для всех участников). Письма, необходимые для вашего аккаунта, например об оплате и входе, продолжат приходить. Уведомления в приложении останутся такими, как вы их настроили.',
    askB: 'Да, больше не присылайте письма',
    alreadyT: 'Вы больше не получаете наши письма',
    alreadyX: 'Вы уже отказались от рассылок KUMANI по почте. Уведомления в приложении останутся такими, как вы их настроили.',
    backB: 'Я снова хочу получать письма',
    doneT: 'Готово: писем больше не будет',
    doneX: 'Вы больше не будете получать рассылки KUMANI по почте. Уведомления в приложении останутся такими, как вы их настроили.',
    againT: 'С возвращением!',
    againX: 'Вы снова будете получать рассылки KUMANI по почте.',
    errT: 'Что-то пошло не так',
    errX: 'Не удалось сохранить ваш выбор: попробуйте чуть позже или напишите нам на',
  },
}

const SUPPORT = '<a href="mailto:support@kumani.io">support@kumani.io</a>.'

const page = (lang: CommLocale, title: string, text: string, form = '') =>
  new Response(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} · KUMANI</title></head>
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
  const l = url.searchParams.get('l')
  return { u, t, c: /^[0-9a-f-]{36}$/i.test(c) ? c : null, lang: (isCommLocale(l) ? l : 'it') as CommLocale, query: url.searchParams.toString() }
}

export async function GET(req: Request) {
  const { u, t, lang, query } = params(req)
  const x = T[lang]
  if (!validUnsubscribe(u, t)) return page(lang, x.invalidT, `${escapeHtml(x.invalidX)} ${SUPPORT}`)
  const { data } = await db().from('email_unsubscribes').select('user_id').eq('user_id', u).maybeSingle()
  if (data) return page(lang, x.alreadyT, escapeHtml(x.alreadyX), button(x.backB, 'resubscribe', query, false))
  return page(lang, x.askT, escapeHtml(x.askX), button(x.askB, 'unsubscribe', query, true))
}

export async function POST(req: Request) {
  const { u, t, c, lang, query } = params(req)
  const x = T[lang]
  if (!validUnsubscribe(u, t)) return page(lang, x.invalidT, `${escapeHtml(x.invalidX)} ${SUPPORT}`)
  const form = await req.formData().catch(() => null)
  const action = form?.get('action') === 'resubscribe' ? 'resubscribe' : 'unsubscribe'
  const s = db()
  if (action === 'resubscribe') {
    await s.from('email_unsubscribes').delete().eq('user_id', u)
    return page(lang, x.againT, escapeHtml(x.againX))
  }
  const { data: profile } = await s.from('profiles').select('email').eq('id', u).maybeSingle()
  const { error } = await s.from('email_unsubscribes').upsert({ user_id: u, email: profile?.email ?? null, communication_id: c }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (error) return page(lang, x.errT, `${escapeHtml(x.errX)} ${SUPPORT}`)
  return page(lang, x.doneT, escapeHtml(x.doneX), button(x.backB, 'resubscribe', query, false))
}
