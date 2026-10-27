// CARTE ANTITRUFFA: le 20 carte del mazzo di partenza. Ogni carta è una
// truffa vera, con l'animale che la rappresenta, l'esca, i segnali, la difesa
// e 3 domande. I testi delle carte sono per ora in italiano (anche nelle
// altre lingue): le traduzioni arriveranno con l'accensione del servizio.

export type ScamChannel = 'sms' | 'tel' | 'wa' | 'social' | 'email' | 'annunci' | 'qr'

export type ScamQuestion = { q: string; options: [string, string, string]; correct: 0 | 1 | 2 }

export type ScamCard = {
  no: number
  name: string
  animal: string
  channel: ScamChannel
  danger: 1 | 2 | 3 | 4 | 5
  bait: string
  move: string
  signs: [string, string, string]
  defense: string
  // 5 domande: ogni volta se ne fanno 3, scelte dal server (quiz.ts)
  quiz: ScamQuestion[]
}

export const SCAM_CHANNELS: ScamChannel[] = ['sms', 'tel', 'wa', 'social', 'email', 'annunci', 'qr']

// Colore della figura e dello sfondo per canale
export const CHANNEL_COLORS: Record<ScamChannel, { color: string; bg: string }> = {
  sms: { color: '#3aa5a0', bg: '#d9f1ef' },
  tel: { color: '#d0574a', bg: '#f8e0dc' },
  wa: { color: '#4d9e4a', bg: '#e0f1db' },
  social: { color: '#8a5cc7', bg: '#ece2f8' },
  email: { color: '#3f7cc4', bg: '#dde9f7' },
  annunci: { color: '#e08a2c', bg: '#fbe9d3' },
  qr: { color: '#5f6b73', bg: '#e3e7ea' },
}

export const SCAM_CARDS: ScamCard[] = [
  {
    no: 1,
    name: 'Il Finto Corriere',
    animal: 'Volpe travestita da corriere',
    channel: 'sms',
    danger: 3,
    bait: 'Il tuo pacco è in giacenza. Paga 1,99 € per la riconsegna: link',
    move: 'Non toccare il link: controlla la spedizione nell’app del negozio.',
    signs: ['Non aspetti nessun pacco, o non dice quale', 'Chiede pochi euro per «sbloccarlo»', 'Il link non è il sito del corriere'],
    defense: 'Cancella l’SMS. Se aspetti un pacco, controlla dall’app del negozio dove l’hai comprato.',
    quiz: [
      { q: 'Ti arriva un SMS: «Il tuo pacco è in giacenza, paga 1,99 €». Cosa fai?', options: ['Tocco il link e pago, sono pochi euro', 'Cancello e controllo dall’app del negozio', 'Rispondo all’SMS per chiedere spiegazioni'], correct: 1 },
      { q: 'Qual è il segnale più chiaro della truffa?', options: ['Il messaggio è scritto in italiano', 'Arriva di mattina', 'Chiede pochi euro per sbloccare il pacco'], correct: 2 },
      { q: 'Perché chiedono solo 1,99 €?', options: ['Per farti inserire i dati della carta', 'Perché la spedizione costa poco', 'Per un errore del corriere'], correct: 0 },
      { q: 'Il link dell’SMS porta a un sito con il logo del corriere. Basta per fidarsi?', options: ['Sì, il logo è quello vero', 'No, logo e colori si copiano facilmente', 'Sì, se c’è il lucchetto'], correct: 1 },
      { q: 'Se aspetti davvero un pacco, come controlli la spedizione?', options: ['Dall’app o dal sito del negozio dove hai comprato', 'Dal link nell’SMS', 'Rispondendo all’SMS'], correct: 0 },
    ],
  },
  {
    no: 2,
    name: 'Il Falso Bancario',
    animal: 'Lupo in giacca e cravatta',
    channel: 'tel',
    danger: 5,
    bait: 'Sono dell’antifrode della sua banca: c’è un bonifico sospetto, spostiamo i soldi su un conto sicuro.',
    move: 'Riattacca e chiama tu la banca dal numero sul retro della carta.',
    signs: ['Ti mette fretta e paura', 'Ti chiede codici o di fare un bonifico', 'Il numero sembra quello della banca'],
    defense: 'Riattacca. Chiama tu la banca dal numero sul retro della carta. La banca non ti chiede mai di spostare soldi.',
    quiz: [
      { q: 'Ti chiama «l’antifrode della banca» e ti dice di spostare i soldi su un conto sicuro. Cosa fai?', options: ['Faccio subito il bonifico', 'Gli do il codice per confermare', 'Riattacco e chiamo la banca dal numero sul retro della carta'], correct: 2 },
      { q: 'Sul telefono compare il numero vero della banca. Puoi fidarti?', options: ['No: il numero che compare si può falsificare', 'Sì, il numero non mente', 'Sì, se l’operatore è gentile'], correct: 0 },
      { q: 'Una banca vera ti chiede mai di spostare i soldi su un altro conto?', options: ['Sì, quando c’è un pericolo', 'Mai', 'Solo per telefono'], correct: 1 },
      { q: 'L’operatore conosce il tuo nome e la tua banca. Vuol dire che è vero?', options: ['Sì, solo la banca lo sa', 'No, questi dati i truffatori li trovano o li comprano', 'Sì, se è gentile'], correct: 1 },
      { q: 'Ti chiede il codice arrivato per SMS «per bloccare il bonifico». Cosa fai?', options: ['Glielo leggo', 'Lo scrivo in chat', 'Non lo do a nessuno e riattacco'], correct: 2 },
    ],
  },
  {
    no: 3,
    name: 'Il Nipote in Difficoltà',
    animal: 'Camaleonte che cambia colore',
    channel: 'wa',
    danger: 4,
    bait: 'Ciao mamma, ho rotto il telefono, questo è il mio numero nuovo. Mi serve un bonifico urgente.',
    move: 'Chiama il numero vecchio prima di pagare.',
    signs: ['Numero sconosciuto che dice di essere un familiare', 'Non può chiamare, solo scrivere', 'Chiede soldi subito'],
    defense: 'Chiama il numero che conosci. Fai una domanda che solo lui o lei sa. Nessun bonifico prima.',
    quiz: [
      { q: '«Ciao mamma, ho cambiato numero, mi serve un bonifico urgente.» Qual è la prima cosa da fare?', options: ['Chiamo il numero vecchio che conosco', 'Faccio il bonifico, è urgente', 'Chiedo l’IBAN per scritto'], correct: 0 },
      { q: 'Perché chi scrive dice che non può telefonare?', options: ['Il telefono è rotto davvero', 'Per risparmiare', 'Perché la voce lo tradirebbe'], correct: 2 },
      { q: 'Un buon modo per capire se è davvero lui o lei?', options: ['Chiedere che ore sono', 'Fare una domanda che sa solo lui o lei', 'Chiedere una foto qualsiasi'], correct: 1 },
      { q: 'Il messaggio dice «non dirlo a papà, ti spiego dopo». Che segnale è?', options: ['Di truffa: vuole isolarti', 'Di un segreto di famiglia', 'Di fretta normale'], correct: 0 },
      { q: 'Hai già fatto il bonifico. Qual è la prima cosa da fare?', options: ['Aspettare che si faccia vivo', 'Chiamare subito la banca per bloccarlo, poi denunciare', 'Mandare un altro bonifico'], correct: 1 },
    ],
  },
  {
    no: 4,
    name: 'Il Guru degli Investimenti',
    animal: 'Pavone con occhiali e catena d’oro',
    channel: 'social',
    danger: 5,
    bait: 'Ho trasformato 250 € in 10.000 € in un mese. Scrivimi in privato, ti insegno come.',
    move: 'Controlla il nome nell’elenco Consob degli autorizzati.',
    signs: ['Guadagni sicuri e velocissimi', 'Ti porta su WhatsApp o Telegram', 'Mostra screenshot di soldi'],
    defense: 'Nessuno garantisce guadagni. Verifica il nome sul sito Consob e non installare app che ti consiglia.',
    quiz: [
      { q: '«Ho trasformato 250 € in 10.000 € in un mese.» Si può fare in modo sicuro?', options: ['Sì, con il trading', 'No, nessuno può garantire guadagni così', 'Sì, con le criptovalute'], correct: 1 },
      { q: 'Dove controlli se chi offre investimenti è autorizzato?', options: ['Nell’elenco della Consob', 'Sul suo profilo social', 'Nei commenti dei clienti'], correct: 0 },
      { q: 'Ti chiede di passare su Telegram e installare un’app per investire. Cosa fai?', options: ['Installo per provare', 'Installo ma metto pochi soldi', 'Non installo niente e chiudo'], correct: 2 },
      { q: 'Ti mostrano screenshot di conti pieni di soldi. Sono una prova?', options: ['Sì, i numeri non mentono', 'No, si falsificano in un minuto', 'Sì, se sono tanti'], correct: 1 },
      { q: 'Dopo i primi guadagni ti chiedono una tassa per prelevare. È…', options: ['Normale con guadagni alti', 'Il segnale che i soldi non esistono', 'Una tassa dello Stato'], correct: 1 },
    ],
  },
  {
    no: 5,
    name: 'Il Recuperatore',
    animal: 'Avvoltoio con la valigetta',
    channel: 'email',
    danger: 4,
    bait: 'Possiamo recuperare i soldi che ha perso. Serve solo un anticipo per le spese legali.',
    move: 'Chi ti ha truffato una volta ti cerca di nuovo: non pagare.',
    signs: ['Ti contatta dopo che sei stato truffato', 'Chiede soldi prima di recuperare', 'Usa nomi da studio legale o ente'],
    defense: 'Non pagare anticipi. Rivolgiti alla Polizia Postale o a un avvocato che scegli tu.',
    quiz: [
      { q: 'Dopo una truffa ti scrive chi promette di recuperare i soldi in cambio di un anticipo. È…', options: ['Un aiuto vero', 'Un servizio della banca', 'Una seconda truffa'], correct: 2 },
      { q: 'Come fanno a sapere che sei stato truffato?', options: ['Dalle liste dei truffatori stessi', 'Dalla Polizia', 'Dal giornale'], correct: 0 },
      { q: 'A chi ti rivolgi davvero per farti aiutare?', options: ['A chi ti ha scritto', 'Alla Polizia Postale o a un avvocato scelto da te', 'Al primo sito trovato online'], correct: 1 },
      { q: 'Chi promette il recupero usa il nome di un avvocato o di un ente vero. Cosa fai?', options: ['Mi fido del nome', 'Cerco io il contatto ufficiale e verifico', 'Pago subito per non perdere tempo'], correct: 1 },
      { q: 'Ti garantiscono di recuperare tutto in pochi giorni. È credibile?', options: ['Sì, se pago in anticipo', 'No: nessuno può garantirlo', 'Sì, se c’è un avvocato'], correct: 1 },
    ],
  },
  {
    no: 6,
    name: 'Il Falso Ente',
    animal: 'Serpente con il berretto da ufficiale',
    channel: 'email',
    danger: 4,
    bait: 'Comunicazione ufficiale: il suo conto è sospeso. Versi la tassa di sblocco entro 48 ore.',
    move: 'Gli enti veri non chiedono soldi via email.',
    signs: ['Logo di un ente e tono minaccioso', 'Chiede una «tassa» per sbloccare', 'Indirizzo email strano'],
    defense: 'Non rispondere. Cerca tu il sito ufficiale dell’ente e controlla da lì.',
    quiz: [
      { q: 'Email «ufficiale»: il conto è sospeso, paga la tassa di sblocco entro 48 ore. Cosa fai?', options: ['Cerco io il sito ufficiale dell’ente e controllo da lì', 'Pago per non perdere il conto', 'Rispondo all’email'], correct: 0 },
      { q: 'Un ente pubblico chiede soldi via email per sbloccare un conto?', options: ['Sì, spesso', 'Solo con il logo', 'Mai'], correct: 2 },
      { q: 'Cosa guardi per primo?', options: ['Il logo', 'L’indirizzo email di chi scrive', 'Il colore del testo'], correct: 1 },
      { q: 'L’email arriva da un indirizzo come «consob-avvisi@gmail.com». Cosa pensi?', options: ['È un ufficio distaccato', 'Un ente vero non scrive da indirizzi gratuiti', 'Va bene, c’è scritto Consob'], correct: 1 },
      { q: 'L’email minaccia sanzioni se non paghi entro 48 ore. A cosa serve la fretta?', options: ['A non farti ragionare e controllare', 'È previsto dalla legge', 'A farti un favore'], correct: 0 },
    ],
  },
  {
    no: 7,
    name: 'Il Cuore Solitario',
    animal: 'Coccodrillo con le lacrime',
    channel: 'social',
    danger: 5,
    bait: 'Non ci siamo mai visti ma mi sento così vicino a te… ho un problema e solo tu puoi aiutarmi.',
    move: 'Se non vi siete mai visti in video, non mandare soldi.',
    signs: ['Si innamora in fretta', 'Non fa mai videochiamate', 'Prima o poi arriva un’emergenza di soldi'],
    defense: 'Chiedi una videochiamata. Parlane con qualcuno di fiducia. Mai soldi a chi non hai incontrato.',
    quiz: [
      { q: 'Una persona conosciuta online, mai vista in video, ti chiede soldi per un’emergenza. Cosa fai?', options: ['Li mando, ci vogliamo bene', 'Mando solo metà', 'Non mando soldi e ne parlo con qualcuno di fiducia'], correct: 2 },
      { q: 'Qual è un segnale tipico?', options: ['Evita sempre la videochiamata', 'Fa tante videochiamate', 'Vive nella tua città'], correct: 0 },
      { q: 'Quando arriva di solito la richiesta di soldi?', options: ['Il primo giorno', 'Dopo settimane passate a conquistare la tua fiducia', 'Mai'], correct: 1 },
      { q: 'Ti chiede i soldi del biglietto aereo per venire da te. Cosa fai?', options: ['Pago, così finalmente ci conosciamo', 'Non mando soldi a chi non ho mai incontrato', 'Pago la metà'], correct: 1 },
      { q: 'Le sue foto sembrano quelle di un modello o di una modella. Come controlli?', options: ['Le cerco con la ricerca per immagini', 'Gli chiedo se sono vere', 'Non serve controllare'], correct: 0 },
    ],
  },
  {
    no: 8,
    name: 'La Voce Clonata',
    animal: 'Pappagallo che imita le voci',
    channel: 'tel',
    danger: 5,
    bait: 'Papà sono io, ho avuto un incidente, passami subito dei soldi, non posso parlare.',
    move: 'Usa la parola d’ordine di famiglia.',
    signs: ['La voce è quella giusta ma qualcosa stona', 'Urgenza e chiamata breve', 'Chiede di non dirlo a nessuno'],
    defense: 'Riattacca e richiama. Decidete in famiglia una parola d’ordine che solo voi sapete.',
    quiz: [
      { q: 'Una voce identica a quella di tuo figlio ti chiede soldi subito. Cosa fai?', options: ['Pago, la voce è la sua', 'Riattacco e lo richiamo io', 'Chiedo di mandarmi l’IBAN'], correct: 1 },
      { q: 'Cosa aiuta la famiglia contro questa truffa?', options: ['Cambiare suoneria', 'Non rispondere mai', 'Una parola d’ordine che sapete solo voi'], correct: 2 },
      { q: 'Oggi una voce si può copiare con pochi secondi di registrazione?', options: ['Sì', 'No, è impossibile', 'Solo nei film'], correct: 0 },
      { q: 'Dici che richiami tu e la persona insiste di no. Che segnale è?', options: ['Di truffa', 'Di fretta normale', 'Di telefono scarico'], correct: 0 },
      { q: 'Da dove prendono la voce da copiare?', options: ['Da video e audio pubblicati online', 'Solo dalla polizia', 'Non si può copiare'], correct: 0 },
    ],
  },
  {
    no: 9,
    name: 'Il Bollettino Fantasma',
    animal: 'Fantasma con il bollettino',
    channel: 'sms',
    danger: 3,
    bait: 'Risulta una multa non pagata. Paga entro 24 ore per evitare la maggiorazione.',
    move: 'Controlla le multe solo dal sito ufficiale, scritto da te.',
    signs: ['Arriva via SMS con un link', 'Scadenza strettissima: 24 ore', 'Non dice targa, data o luogo'],
    defense: 'Non pagare dal link. Le multe vere arrivano per raccomandata o PEC: controlla dal sito ufficiale.',
    quiz: [
      { q: 'SMS: «Multa non pagata, paga entro 24 ore». Cosa fai?', options: ['Pago dal link', 'Inoltro a un amico', 'Controllo dal sito ufficiale scritto da me'], correct: 2 },
      { q: 'Come arrivano di solito le multe vere?', options: ['Per raccomandata o PEC', 'Per SMS con un link', 'Su WhatsApp'], correct: 0 },
      { q: 'Cosa manca quasi sempre nell’SMS falso?', options: ['Il prezzo', 'Targa, data e luogo', 'Il link'], correct: 1 },
      { q: 'Il link della «multa» apre una pagina che chiede la carta. Cosa fai?', options: ['Pago, è poco', 'Chiudo e controllo dal sito ufficiale', 'Pago metà adesso'], correct: 1 },
      { q: 'Hai già inserito i dati della carta. Cosa fai subito?', options: ['Aspetto la ricevuta', 'Blocco la carta chiamando la banca', 'Riprovo con un’altra carta'], correct: 1 },
    ],
  },
  {
    no: 10,
    name: 'Il Codice Rubato',
    animal: 'Gazza ladra',
    channel: 'wa',
    danger: 4,
    bait: 'Scusa, ti ho mandato un codice di 6 cifre per sbaglio, me lo giri?',
    move: 'I codici di 6 cifre non si danno a nessuno.',
    signs: ['Ti arriva un codice che non hai chiesto', 'Subito dopo qualcuno te lo chiede', 'Spesso il messaggio sembra di un amico'],
    defense: 'Non girare mai il codice: serve a rubarti WhatsApp o il conto. Attiva la verifica in due passaggi.',
    quiz: [
      { q: 'Un amico ti scrive: «Ti ho mandato un codice per sbaglio, me lo giri?». Cosa fai?', options: ['Lo giro, è un amico', 'Non lo giro mai', 'Lo giro solo a metà'], correct: 1 },
      { q: 'A cosa serve quel codice?', options: ['A un concorso', 'A niente', 'A rubarti WhatsApp o il conto'], correct: 2 },
      { q: 'Cosa ti protegge in più?', options: ['La verifica in due passaggi', 'Cambiare la foto del profilo', 'Spegnere il telefono'], correct: 0 },
      { q: 'Il codice dice «non condividerlo con nessuno». Vale anche con un amico?', options: ['Sì, con nessuno', 'No, con un amico si può', 'Solo con i parenti'], correct: 0 },
      { q: 'Ti hanno già rubato WhatsApp. Cosa fai?', options: ['Aspetto che passi', 'Rientro con il mio numero e avviso i contatti', 'Pago chi me lo chiede'], correct: 1 },
    ],
  },
  {
    no: 11,
    name: 'Il Venditore Fantasma',
    animal: 'Gatto prestigiatore',
    channel: 'annunci',
    danger: 3,
    bait: 'Prezzo bassissimo, ma solo con pagamento anticipato su ricarica.',
    move: 'Paga di persona o con il pagamento protetto del sito.',
    signs: ['Prezzo molto più basso degli altri', 'Vuole solo ricarica o bonifico anticipato', 'Non può farti vedere l’oggetto'],
    defense: 'Incontra il venditore o usa il pagamento protetto del sito. Mai ricariche a sconosciuti.',
    quiz: [
      { q: 'Prezzo bassissimo, ma si paga solo con una ricarica anticipata. Cosa fai?', options: ['Pago subito prima che finisca', 'Pago di persona o con il pagamento protetto', 'Mando metà'], correct: 1 },
      { q: 'Il venditore non può farti vedere l’oggetto. È un segnale…', options: ['Di truffa', 'Di timidezza', 'Di spedizione veloce'], correct: 0 },
      { q: 'Quale pagamento eviti con uno sconosciuto?', options: ['I contanti di persona', 'Il pagamento protetto del sito', 'La ricarica di una carta prepagata'], correct: 2 },
      { q: 'Il venditore ti mette fretta: «ci sono altre 3 persone interessate». Che segnale è?', options: ['Di truffa: vuole farti pagare senza pensare', 'Di un buon affare', 'Di onestà'], correct: 0 },
      { q: 'Ti manda la foto di un documento per rassicurarti. Basta?', options: ['Sì, è un documento', 'No, può essere rubato o falso', 'Sì, se è a colori'], correct: 1 },
    ],
  },
  {
    no: 12,
    name: 'Il Compratore Generoso',
    animal: 'Iena sorridente',
    channel: 'annunci',
    danger: 3,
    bait: 'Ti pago subito: clicca il link e inserisci la carta per ricevere i soldi.',
    move: 'Per ricevere soldi non serve mai la tua carta.',
    signs: ['Paga subito senza trattare', 'Ti manda un link per «ricevere»', 'Ti chiede i dati della carta o un codice'],
    defense: 'Per ricevere basta l’IBAN, mai PIN o codici. Chiudi la pagina e blocca il contatto.',
    quiz: [
      { q: 'Chi compra ti manda un link per «ricevere» i soldi e ti chiede la carta. È…', options: ['Normale', 'Più veloce', 'Una truffa'], correct: 2 },
      { q: 'Per ricevere un pagamento cosa basta?', options: ['Il PIN della carta', 'Il tuo IBAN', 'Il codice di 6 cifre'], correct: 1 },
      { q: 'Paga subito senza nemmeno trattare. Che segnale è?', options: ['Di possibile truffa', 'Di fortuna', 'Di serietà'], correct: 0 },
      { q: 'Ti arriva un’email: «pagamento in attesa, conferma con la tua carta». Cosa fai?', options: ['Confermo', 'È falsa: per ricevere non serve la carta', 'Rispondo all’email'], correct: 1 },
      { q: 'Il compratore vuole mandare un suo corriere e pagare con un link. Cosa fai?', options: ['Accetto', 'Uso solo il pagamento protetto della piattaforma', 'Gli do indirizzo e carta'], correct: 1 },
    ],
  },
  {
    no: 13,
    name: 'Il Lavoro dei Like',
    animal: 'Ragno con la rete',
    channel: 'wa',
    danger: 4,
    bait: 'Guadagna 50 € al giorno mettendo like. Per salire di livello versa una quota.',
    move: 'Un lavoro vero non ti chiede soldi.',
    signs: ['Guadagni facili per compiti semplici', 'I primi euro arrivano davvero', 'Poi chiede di versare per «salire di livello»'],
    defense: 'Fermati alla prima richiesta di soldi. I primi euro pagati servono solo a farti fidare.',
    quiz: [
      { q: '«50 € al giorno mettendo like»: i primi soldi arrivano davvero. Perché?', options: ['Il lavoro è vero', 'Per farti fidare prima di chiederti soldi', 'Per errore'], correct: 1 },
      { q: 'Ti chiedono di versare una quota per salire di livello. Cosa fai?', options: ['Mi fermo subito', 'Verso, poi guadagno di più', 'Verso poco'], correct: 0 },
      { q: 'Un lavoro vero ti chiede soldi per lavorare?', options: ['Sì', 'Solo all’inizio', 'Mai'], correct: 2 },
      { q: 'Ti aggiungono a un gruppo con tanti «colleghi» entusiasti. Chi sono?', options: ['Colleghi veri', 'Spesso complici o account finti', 'Dipendenti dell’azienda'], correct: 1 },
      { q: 'Per sbloccare i guadagni ti chiedono una quota più alta. Cosa fai?', options: ['Pago per riavere tutto', 'Mi fermo: più pago, più perdo', 'Chiedo uno sconto'], correct: 1 },
    ],
  },
  {
    no: 14,
    name: 'L’Abbonamento Trappola',
    animal: 'Pianta carnivora',
    channel: 'email',
    danger: 2,
    bait: 'Il tuo abbonamento è scaduto: aggiorna subito i dati della carta.',
    move: 'Controlla l’abbonamento dall’app, non dall’email.',
    signs: ['Logo noto ma indirizzo email strano', 'Dice che il servizio si blocca', 'Link per «aggiornare la carta»'],
    defense: 'Apri tu l’app o il sito del servizio. Se è tutto a posto, l’email era falsa.',
    quiz: [
      { q: 'Email: «abbonamento scaduto, aggiorna la carta». Cosa fai?', options: ['Clicco e aggiorno', 'Rispondo all’email', 'Apro io l’app del servizio'], correct: 2 },
      { q: 'Qual è il primo segnale da guardare?', options: ['L’indirizzo email strano', 'Il logo', 'L’orario di arrivo'], correct: 0 },
      { q: 'Nell’app è tutto a posto. L’email era…', options: ['Un promemoria vero', 'Falsa', 'Un errore innocuo'], correct: 1 },
      { q: 'L’email ha il logo giusto e chiede di «verificare il pagamento». Il logo garantisce qualcosa?', options: ['Sì', 'No, i loghi si copiano', 'Solo se è a colori'], correct: 1 },
      { q: 'Hai inserito la carta sul sito falso. Cosa fai?', options: ['Niente', 'Blocco la carta e cambio la password', 'Aspetto l’addebito'], correct: 1 },
    ],
  },
  {
    no: 15,
    name: 'Il QR Truccato',
    animal: 'Geco con l’adesivo',
    channel: 'qr',
    danger: 3,
    bait: 'Un adesivo con QR sopra quello vero, sul parcometro o su un volantino.',
    move: 'Guarda se il QR è un adesivo appiccicato sopra.',
    signs: ['Adesivo sopra il QR originale', 'Il sito chiede subito la carta', 'L’indirizzo non è quello del gestore'],
    defense: 'Paga dall’app ufficiale del parcheggio o alla cassa. Nel dubbio, non inquadrare.',
    quiz: [
      { q: 'Sul parcometro il QR sembra un adesivo messo sopra quello vero. Cosa fai?', options: ['Inquadro lo stesso', 'Pago dall’app ufficiale o alla cassa', 'Lo stacco e inquadro quello sotto'], correct: 1 },
      { q: 'Il sito del QR chiede subito la carta e l’indirizzo è strano. È…', options: ['Sospetto', 'Normale', 'Più sicuro'], correct: 0 },
      { q: 'Dove si trovano i QR truccati?', options: ['Solo su internet', 'Da nessuna parte', 'Su parcometri, volantini e colonnine'], correct: 2 },
      { q: 'Il QR di un volantino ti porta a pagare una multa. Cosa fai?', options: ['Pago', 'Controllo la multa dal sito ufficiale', 'Lo inquadro di nuovo'], correct: 1 },
      { q: 'Prima di pagare da un QR, cosa guardi sul telefono?', options: ['L’indirizzo del sito che si apre', 'Il colore del QR', 'Niente'], correct: 0 },
    ],
  },
  {
    no: 16,
    name: 'Il Finto Rimborso',
    animal: 'Corvo con la lettera',
    channel: 'email',
    danger: 3,
    bait: 'Hai diritto a un rimborso fiscale: inserisci la carta per riceverlo.',
    move: 'I rimborsi veri arrivano senza chiederti la carta.',
    signs: ['Rimborso che non aspettavi', 'Chiede i dati della carta per accreditare', 'Scadenza a breve'],
    defense: 'Controlla dal tuo cassetto fiscale sul sito ufficiale. Nessun ente ti chiede la carta per pagarti.',
    quiz: [
      { q: 'Email: «Hai diritto a un rimborso, inserisci la carta». Cosa fai?', options: ['Inserisco la carta', 'Controllo dal cassetto fiscale sul sito ufficiale', 'Rispondo con i miei dati'], correct: 1 },
      { q: 'Per pagarti un rimborso, un ente ti chiede la carta?', options: ['Sì', 'Solo per importi piccoli', 'Mai'], correct: 2 },
      { q: 'Qual è un segnale tipico?', options: ['Un rimborso che non aspettavi, con una scadenza vicina', 'Un’email lunga', 'Un logo colorato'], correct: 0 },
      { q: 'Dove controlli se hai davvero un rimborso fiscale?', options: ['Nel tuo cassetto fiscale sul sito ufficiale', 'Nel link dell’email', 'Rispondendo all’email'], correct: 0 },
      { q: 'Ti chiedono anche il PIN della carta «per accreditare». Cosa pensi?', options: ['Serve davvero', 'Nessuno chiede il PIN: è una truffa', 'Va bene se è un ente'], correct: 1 },
    ],
  },
  {
    no: 17,
    name: 'Il Falso Affitto',
    animal: 'Paguro in una casa non sua',
    channel: 'annunci',
    danger: 4,
    bait: 'Casa bellissima a poco. Sono all’estero: mandami la caparra e ti spedisco le chiavi.',
    move: 'Niente caparra prima di aver visto la casa.',
    signs: ['Prezzo molto basso in una bella zona', 'Il proprietario è all’estero', 'Chiede la caparra prima della visita'],
    defense: 'Visita la casa e verifica chi è il proprietario. Paga solo con il contratto firmato.',
    quiz: [
      { q: 'Casa bella a poco, proprietario all’estero, caparra prima della visita. Cosa fai?', options: ['Pago la caparra', 'Pago metà', 'Niente soldi prima di vedere la casa'], correct: 2 },
      { q: 'Cosa verifichi?', options: ['Chi è davvero il proprietario', 'Il colore delle pareti', 'Quante foto ci sono'], correct: 0 },
      { q: 'Quando paghi?', options: ['Prima della visita', 'Con il contratto firmato', 'Quando lo chiede lui'], correct: 1 },
      { q: 'Le foto della casa sono bellissime e professionali. Come controlli?', options: ['Le cerco con la ricerca per immagini', 'Mi fido', 'Chiedo altre foto e pago'], correct: 0 },
      { q: 'Ti chiedono di pagare con una ricarica o un trasferimento di denaro. Cosa fai?', options: ['Pago', 'Mi fermo: è il pagamento preferito dai truffatori', 'Pago la metà'], correct: 1 },
    ],
  },
  {
    no: 18,
    name: 'La Lotteria Mai Giocata',
    animal: 'Scimmia con la ruota della fortuna',
    channel: 'sms',
    danger: 2,
    bait: 'Hai vinto un premio! Paga solo le spese di spedizione.',
    move: 'Non si vince a un gioco a cui non hai giocato.',
    signs: ['Premio da un concorso mai fatto', 'Spese di spedizione da pagare', 'Link per inserire i dati'],
    defense: 'Cancella il messaggio. I premi veri non chiedono soldi per essere consegnati.',
    quiz: [
      { q: 'Hai vinto un premio a un concorso a cui non hai partecipato. Cosa fai?', options: ['Cancello il messaggio', 'Pago la spedizione', 'Inserisco i dati per sicurezza'], correct: 0 },
      { q: 'I premi veri chiedono soldi per la consegna?', options: ['Sì', 'No', 'A volte, pochi'], correct: 1 },
      { q: 'A cosa serve chiederti pochi euro?', options: ['A coprire le spese', 'A niente', 'A rubare i dati della carta'], correct: 2 },
      { q: 'Il messaggio dice che il premio scade tra un’ora. Perché?', options: ['Per metterti fretta e non farti ragionare', 'È la regola del concorso', 'Per favorirti'], correct: 0 },
      { q: 'Per ritirare il premio ti chiedono i dati della carta. Cosa fai?', options: ['Li do', 'Non li do e cancello il messaggio', 'Do solo il numero'], correct: 1 },
    ],
  },
  {
    no: 19,
    name: 'Il Finto Tecnico',
    animal: 'Tarlo nel computer',
    channel: 'tel',
    danger: 4,
    bait: 'Il suo computer ha un virus. Installi questo programma, la aiuto io.',
    move: 'Riattacca: nessuna azienda ti chiama per un virus.',
    signs: ['Chiamata non richiesta su un problema al PC', 'Ti chiede di installare un programma', 'Vuole vedere il tuo schermo'],
    defense: 'Riattacca e non installare niente. Se l’hai già fatto, spegni il computer e fallo controllare.',
    quiz: [
      { q: '«Il suo computer ha un virus, installi questo programma.» Cosa fai?', options: ['Installo', 'Gli do la password', 'Riattacco e non installo niente'], correct: 2 },
      { q: 'Un’azienda ti telefona per un virus sul tuo computer?', options: ['Mai', 'Sì', 'Solo le grandi aziende'], correct: 0 },
      { q: 'Se hai già installato il programma?', options: ['Aspetto', 'Spengo il computer e lo faccio controllare', 'Continuo a usarlo'], correct: 1 },
      { q: 'Sul computer compare un avviso con un numero da chiamare per un virus. Cosa fai?', options: ['Chiamo', 'Non chiamo e chiudo il browser', 'Pago l’assistenza'], correct: 1 },
      { q: 'Il «tecnico» vuole vedere il tuo conto in banca «per controllare». Cosa fai?', options: ['Lo apro', 'Mai: riattacco', 'Solo per un minuto'], correct: 1 },
    ],
  },
  {
    no: 20,
    name: 'Il Finto Operatore',
    animal: 'Anguilla elettrica',
    channel: 'tel',
    danger: 3,
    bait: 'La sua bolletta è sbagliata: mi dia il codice cliente e il codice della fornitura.',
    move: 'Il codice cliente non si dà al telefono.',
    signs: ['Chiamata su una bolletta «sbagliata»', 'Chiede codice cliente o codice POD', 'Vuole che tu dica «sì»'],
    defense: 'Non dare codici e non dire «sì». Chiama tu il numero scritto sulla bolletta.',
    quiz: [
      { q: '«La bolletta è sbagliata, mi dia il codice cliente.» Cosa fai?', options: ['Glielo do', 'Non do codici e chiamo il numero sulla bolletta', 'Do solo il codice POD'], correct: 1 },
      { q: 'Perché vogliono che tu dica «sì»?', options: ['Per registrare il consenso a un contratto', 'Per cortesia', 'Per sapere se senti'], correct: 0 },
      { q: 'Dove trovi il numero vero del fornitore?', options: ['Nell’SMS che hai ricevuto', 'Te lo dà chi chiama', 'Sulla bolletta'], correct: 2 },
      { q: 'Ti promettono un rimborso se cambi fornitore subito, al telefono. Cosa fai?', options: ['Accetto', 'Non decido al telefono: controllo con calma', 'Do i codici per sapere quanto'], correct: 1 },
      { q: 'Ti arriva un contratto che non hai chiesto. Cosa fai?', options: ['Pago la prima bolletta', 'Contatto il fornitore e uso il diritto di ripensamento', 'Lo ignoro'], correct: 1 },
    ],
  },
]

export const SCAM_CARD_COUNT = SCAM_CARDS.length

// Scudi dell'album: quante carte servono
export const SHIELDS = [
  { key: 'bronze', cards: 5 },
  { key: 'silver', cards: 10 },
  { key: 'gold', cards: 20 },
] as const

// Scudo verde: carte catturate davvero da un controllo (truffe fermate)
export const GREEN_SHIELD_CAPTURES = 3

// Indirizzo pubblico della carta: «Il Finto Corriere» → «finto-corriere»
export function cardSlug(card: Pick<ScamCard, 'name'>): string {
  return card.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(il|la|lo|l['’])\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const cardBySlug = (slug: string) => SCAM_CARDS.find((c) => cardSlug(c) === slug) ?? null

// Mese della carta del mese ('2026-11'), sul calendario italiano
export const monthKey = (day: string) => day.slice(0, 7)
