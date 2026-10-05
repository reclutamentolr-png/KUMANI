// Email temporanee / usa e getta: non accettate in registrazione (servono
// a creare account in serie, per esempio per ripetere la prova Pro).
// Elenco dei servizi più diffusi; si controlla il dominio e i suoi
// sottodomini (es. "abc.mailinator.com").
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', '20minutemail.com', '33mail.com', 'anonaddy.me', 'burnermail.io', 'byom.de',
  'mail-temp.com', 'deadaddress.com', 'discard.email', 'discardmail.com', 'dispostable.com', 'dropmail.me', 'emailondeck.com',
  'emailfake.com', 'fakeinbox.com', 'fakemail.net', 'getairmail.com', 'getnada.com', 'guerrillamail.biz', 'guerrillamail.com',
  'guerrillamail.de', 'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com', 'grr.la',
  'harakirimail.com', 'inboxbear.com', 'incognitomail.org', 'jetable.org', 'mailcatch.com', 'maildrop.cc', 'mailinator.com',
  'mailinator.net', 'mailinator2.com', 'mailnesia.com', 'mailpoof.com', 'mailsac.com', 'mailtemp.info', 'mintemail.com',
  'moakt.com', 'mohmal.com', 'mytemp.email', 'mytrashmail.com', 'nada.email', 'emailnax.com', 'nowmymail.com', 'owlymail.com',
  'pokemail.net', 'sharklasers.com', 'spam4.me', 'spamgourmet.com', 'spambox.us', 'spamdecoy.net', 'temp-mail.io', 'temp-mail.org',
  'tempail.com', 'tempinbox.com', 'tempmail.com', 'tempmail.net', 'tempmail.plus', 'tempmailo.com', 'tempr.email', 'throwawaymail.com',
  'trashmail.com', 'trashmail.de', 'trashmail.net', 'trash-mail.com', 'tmail.ws', 'tmpmail.net', 'tmpmail.org', 'yopmail.com', 'yopmail.fr',
  'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc', 'mail.tm', 'emltmp.com', 'inboxkitten.com', 'mailforspam.com',
  'tempmailaddress.com', 'emailtemporanea.com', 'emailtemporanea.net', 'fakemailgenerator.com', 'minuteinbox.com', 'luxusmail.org',
  'disposablemail.com', 'getairmail.cf', 'mailbox.in.ua', 'spamex.com', 'mvrht.net', 'chacuo.net', 'linshiyouxiang.net',
])

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  if (!domain) return false
  const parts = domain.split('.')
  // Il dominio e ogni dominio "padre" (sottodomini compresi)
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join('.'))) return true
  }
  return false
}
