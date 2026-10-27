// CARTE ANTITRUFFA – Passo 2: da un messaggio già giudicato truffa (SVAT,
// CheckMail, Verifica IBAN) a quale carta corrisponde. Regole scritte da noi,
// senza IA: «strong» basta da sola, «weak» ne servono almeno due. Se nessuna
// carta raggiunge la soglia, nessuna cattura (meglio niente che la carta sbagliata).

type Rule = { no: number; strong: RegExp[]; weak: RegExp[] }

// Testo in minuscolo senza accenti e con spazi semplici
export function normalizeScamText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, ' ')
}

const RULES: Rule[] = [
  // 1 Finto Corriere
  {
    no: 1,
    strong: [/pacco .{0,40}(giacenza|in sospeso|bloccat|trattenut)/, /(riconsegna|rispedizione|consegna) .{0,40}(pag|costo|tariffa|1[.,]\d\d ?(€|eur))/],
    weak: [/\bpacc(o|hi)\b/, /spedizion/, /corriere|poste|dhl|gls|brt|sda|ups/, /giacenza/, /indirizzo (incompleto|errato)/, /\b[0-3][.,]\d\d ?(€|eur)/],
  },
  // 2 Falso Bancario
  {
    no: 2,
    strong: [/(antifrode|ufficio sicurezza) .{0,40}banca/, /conto (sicuro|di sicurezza|protetto)/, /(bonifico|movimento|accesso) (sospetto|anomalo|non autorizzato)/],
    weak: [/\bbanca\b|bancari/, /carta (bloccata|sospesa)/, /operatore/, /codice (otp|di sicurezza|dispositivo)/, /verifica (i tuoi|il tuo) (dati|conto)/],
  },
  // 3 Nipote in Difficoltà
  {
    no: 3,
    strong: [/ciao (mamma|papa|nonna|nonno)/, /(nuovo|cambiato) numero .{0,60}(bonifico|soldi|pagare)/],
    weak: [/(mamma|papa|nonna|nonno)/, /numero (nuovo|cambiato)|ho cambiato numero/, /telefono (rotto|caduto)/, /urgente/, /non posso (chiamare|parlare)/],
  },
  // 4 Guru degli Investimenti
  {
    no: 4,
    strong: [/(guadagn|rendiment|profitt).{0,40}(garantit|sicur|al giorno|al mese)/, /(trading|cripto|bitcoin|forex).{0,60}(guadagn|rendiment|profitt)/],
    weak: [/trading|cripto|bitcoin|forex|azioni/, /investiment|investi/, /telegram|whatsapp/, /piattaforma/, /consulente|mentor|esperto/],
  },
  // 5 Recuperatore
  {
    no: 5,
    strong: [/recuper.{0,40}(fondi|soldi|denaro|somme|perdit)/, /(rimborso|risarcimento) .{0,40}(truffa|frode)/],
    weak: [/truffat|frodat|vittima/, /studio legale|avvocat|legale/, /anticipo|spese (legali|di pratica)/, /agenzia/],
  },
  // 6 Falso Ente
  {
    no: 6,
    strong: [/(tassa|commissione|spese) di (sblocco|svincolo)/, /(consob|banca d'italia|agenzia delle entrate|guardia di finanza|polizia).{0,80}(sospes|bloccat|sanzion|versare|pagare)/],
    weak: [/consob|banca d'italia|agenzia delle entrate|guardia di finanza|inps|polizia postale|ministero/, /conto (sospeso|bloccato|congelato)/, /comunicazione ufficiale/, /entro (24|48|72) ore/],
  },
  // 7 Cuore Solitario
  {
    no: 7,
    strong: [/(amore|tesoro|cara|caro) .{0,80}(soldi|bonifico|aiutarmi|biglietto|dogana)/],
    weak: [/amore|tesoro|innamorat|anima gemella/, /aiutarmi|ho bisogno di te/, /militare|missione|piattaforma petrolifera|all'estero/, /dogana|biglietto aereo|ospedale/],
  },
  // 8 Voce Clonata
  {
    no: 8,
    strong: [/(incidente|arrestat|in ospedale).{0,60}(soldi|bonifico|cauzione)/],
    weak: [/incidente|arrestat|ospedale|cauzione/, /sono io/, /non dirlo a nessuno/, /(figlio|figlia|nipote)/],
  },
  // 9 Bollettino Fantasma
  {
    no: 9,
    strong: [/(multa|sanzione|contravvenzione|verbale).{0,60}(non pagat|insolut|pagare|scadenz)/, /pagopa.{0,60}(scadenz|pagare|insolut)/],
    weak: [/multa|sanzione|contravvenzione|verbale|bollettino|pedaggio|autostrad/, /maggiorazione|mora/, /entro (24|48) ore|oggi stesso/],
  },
  // 10 Codice Rubato
  {
    no: 10,
    strong: [/codice .{0,40}(per sbaglio|per errore)/, /(girare|inoltrare|mandarmi|inviami) (il|quel) codice/],
    weak: [/codice (di|a) 6 cifre|codice di verifica|codice whatsapp/, /per sbaglio|per errore/, /\b\d{3}[- ]?\d{3}\b/],
  },
  // 11 Venditore Fantasma
  {
    no: 11,
    strong: [/(ricarica|postepay|paysafecard).{0,60}(anticip|prima della spedizione)/, /pagamento anticipato/],
    weak: [/ricarica|postepay|paysafecard|amazon gift|buono regalo/, /spedisco|spedizione/, /prezzo|offerta|svendo|affare/, /subito|ultimo pezzo/],
  },
  // 12 Compratore Generoso
  {
    no: 12,
    strong: [/(ricevere|riscuotere|incassare) (il pagamento|i soldi|il denaro).{0,60}(link|carta|clicca)/, /(subito|vinted|subito\.it|marketplace).{0,60}(ricevere il pagamento|pagamento ricevuto)/],
    weak: [/ricevere (il pagamento|i soldi)/, /link/, /dati della carta|numero della carta|cvv/, /corriere ritira|ritiro a domicilio/],
  },
  // 13 Lavoro dei Like
  {
    no: 13,
    strong: [/(mettere|metti) (like|mi piace).{0,60}(guadagn|pagat|€|euro)/, /(guadagn|pagat).{0,40}(like|recensioni|follow)/],
    weak: [/like|mi piace|recensioni|follow/, /lavoro (da casa|online|part.time|semplice)/, /\d+ ?(€|euro) al giorno/, /livello|task|missione|deposito|quota/],
  },
  // 14 Abbonamento Trappola
  {
    no: 14,
    strong: [/abbonamento .{0,40}(scadut|sospes|annullat|non rinnovat)/, /(aggiorna|verifica) .{0,30}(metodo di pagamento|dati della carta|carta di credito)/],
    weak: [/abbonamento|iscrizione|account/, /netflix|spotify|disney|prime|amazon|apple|icloud|dazn/, /pagamento (non riuscito|rifiutato)/, /carta/],
  },
  // 15 QR Truccato
  {
    no: 15,
    strong: [/(qr|codice qr).{0,60}(parcheggio|parcometro|sosta|ricarica)/],
    weak: [/\bqr\b|codice qr/, /parcheggio|parcometro|sosta|colonnina/, /inquadra|scansiona/],
  },
  // 16 Finto Rimborso
  {
    no: 16,
    strong: [/rimborso .{0,60}(fiscal|irpef|tasse|imposte|agenzia delle entrate|inps)/, /hai diritto (a|ad) (un )?rimborso/],
    weak: [/rimborso|accredito|restituzione/, /agenzia delle entrate|inps|fisco|irpef/, /dati della carta|iban/],
  },
  // 17 Falso Affitto
  {
    no: 17,
    strong: [/(caparra|deposito|anticipo).{0,60}(affitto|appartamento|casa|stanza|chiavi)/, /(spedisco|mando|invio) (le )?chiavi/],
    weak: [/affitto|appartamento|monolocale|bilocale|stanza/, /caparra|deposito cauzionale/, /sono all'estero|vivo all'estero|lavoro all'estero/, /airbnb|booking/],
  },
  // 18 Lotteria Mai Giocata
  {
    no: 18,
    strong: [/(hai vinto|sei (il|la) vincit|vincitore|vincitrice).{0,80}(spese|spedizione|ritira|riscuoti)/],
    weak: [/hai vinto|vincit|premio|estrazione|lotteria|concorso/, /spese di spedizione|commissione/, /iphone|buono|gift card/],
  },
  // 19 Finto Tecnico
  {
    no: 19,
    strong: [/(computer|pc|dispositivo).{0,40}(virus|infett|compromess|bloccat)/, /(anydesk|teamviewer|quick ?support|assistenza remota)/],
    weak: [/virus|malware|infett|hacker/, /microsoft|windows|apple|supporto tecnico|assistenza tecnica/, /installa|scarica/, /chiama (subito )?il numero/],
  },
  // 20 Finto Operatore
  {
    no: 20,
    strong: [/(codice cliente|codice pod|codice pdr).{0,60}(luce|gas|bolletta|fornitura)/, /bolletta .{0,40}(errat|sbagliat|rimborso|conguaglio)/],
    weak: [/bolletta|fornitura|luce|gas|enel|eni|edison|a2a|hera|iren/, /codice cliente|pod|pdr/, /cambio (fornitore|tariffa)|offerta luce/],
  },
]

// Quale carta è questo messaggio (o null se non si sa con certezza).
// `only`: carte possibili per quel controllo (es. IBAN: solo truffe con bonifico).
export function matchScamCard(text: string, only?: number[]): number | null {
  const t = normalizeScamText(text).slice(0, 20_000)
  if (t.length < 8) return null
  let best: { no: number; score: number } | null = null
  for (const rule of RULES) {
    if (only && !only.includes(rule.no)) continue
    const strong = rule.strong.filter((r) => r.test(t)).length
    const weak = rule.weak.filter((r) => r.test(t)).length
    const score = strong * 3 + weak
    if (strong === 0 && weak < 2) continue
    if (!best || score > best.score) best = { no: rule.no, score }
  }
  return best?.no ?? null
}

// Truffe che passano da un bonifico (Verifica IBAN)
export const IBAN_CARDS = [3, 4, 5, 6, 7, 11, 12, 13, 17]
