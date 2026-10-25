// Comunicazioni a tutti gli iscritti (Admin → Comunicazioni): i testi nella
// lingua di ogni persona. L'italiano è il testo base; le altre lingue stanno
// in translations. Chi usa un'altra lingua senza traduzione la riceve in
// inglese; chi non ha ancora una lingua salvata, in italiano.

export const COMM_LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'] as const
export type CommLocale = (typeof COMM_LOCALES)[number]

export type CommTexts = { push_title: string | null; push_body: string | null; email_subject: string | null; email_preheader: string | null; email_body: string | null }
export type CommWithTexts = CommTexts & { translations?: Partial<Record<CommLocale, Partial<CommTexts>>> | null }

export const isCommLocale = (l: unknown): l is CommLocale => typeof l === 'string' && (COMM_LOCALES as readonly string[]).includes(l)

// Testi per una lingua, campo per campo: lingua → inglese → italiano
export function textsFor(c: CommWithTexts, locale: string | null | undefined): CommTexts & { locale: CommLocale } {
  const base: CommTexts = { push_title: c.push_title, push_body: c.push_body, email_subject: c.email_subject, email_preheader: c.email_preheader, email_body: c.email_body }
  if (!isCommLocale(locale) || locale === 'it') return { ...base, locale: 'it' }
  const own = c.translations?.[locale]
  const en = c.translations?.en
  const pick = <K extends keyof CommTexts>(k: K) => own?.[k] || en?.[k] || base[k]
  const used: CommLocale = own ? locale : en ? 'en' : 'it'
  return { push_title: pick('push_title'), push_body: pick('push_body'), email_subject: pick('email_subject'), email_preheader: pick('email_preheader'), email_body: pick('email_body'), locale: used }
}

// Lingue pronte (l'italiano c'è sempre)
export const readyLocales = (c: CommWithTexts): CommLocale[] => COMM_LOCALES.filter((l) => l === 'it' || !!c.translations?.[l]?.email_body || !!c.translations?.[l]?.push_body)

// «Ciao {nome},» → «Ciao Marco,» o «Ciao,» se il nome manca
export const personalize = (text: string, name: string) => text.replace(/[ \t]?\{nome\}/g, name ? ` ${name}` : '')

// Titoletto: riga corta in MAIUSCOLO, anche con una nota tra parentesi («ANDROID (con Chrome)»)
export function isHeading(line: string) {
  const caps = line.replace(/\s*\([^)]*\)\s*$/, '')
  return line.length < 80 && caps.length > 3 && caps === caps.toUpperCase() && /[A-ZÀ-ÝА-ЯЁ]/.test(caps)
}

// Parti fisse dell'email e della pagina di disiscrizione
export const EMAIL_CHROME: Record<CommLocale, { open: string; why: string; stop: string; pushNote: string; test: string }> = {
  it: { open: 'Apri KUMANI', why: 'Ricevi questa email perché sei iscritto a KUMANI.', stop: 'Non ricevere più queste email', pushNote: 'le notifiche nell’app restano come le hai impostate', test: 'Prova' },
  en: { open: 'Open KUMANI', why: 'You are receiving this email because you signed up to KUMANI.', stop: 'Stop receiving these emails', pushNote: 'in-app notifications stay as you set them', test: 'Test' },
  fr: { open: 'Ouvrir KUMANI', why: 'Vous recevez cet e-mail parce que vous êtes inscrit à KUMANI.', stop: 'Ne plus recevoir ces e-mails', pushNote: 'les notifications de l’app restent comme vous les avez réglées', test: 'Test' },
  es: { open: 'Abrir KUMANI', why: 'Recibes este correo porque estás registrado en KUMANI.', stop: 'No recibir más estos correos', pushNote: 'las notificaciones de la app siguen como las configuraste', test: 'Prueba' },
  pt: { open: 'Abrir a KUMANI', why: 'Recebe este email porque está registado na KUMANI.', stop: 'Deixar de receber estes emails', pushNote: 'as notificações da app ficam como as definiu', test: 'Teste' },
  de: { open: 'KUMANI öffnen', why: 'Du erhältst diese E-Mail, weil du bei KUMANI registriert bist.', stop: 'Diese E-Mails nicht mehr erhalten', pushNote: 'die Benachrichtigungen in der App bleiben, wie du sie eingestellt hast', test: 'Test' },
  ru: { open: 'Открыть KUMANI', why: 'Вы получили это письмо, потому что зарегистрированы в KUMANI.', stop: 'Больше не получать эти письма', pushNote: 'уведомления в приложении останутся такими, как вы их настроили', test: 'Тест' },
}
