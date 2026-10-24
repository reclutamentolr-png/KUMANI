import type { SolveGuide } from './types'

// Le guide di KUMANI Risolvi (italiano). Prima tornata: 6 guide che portano
// a un servizio KUMANI. Ogni modifica ai passi: nuova `version` e nuova
// `reviewedAt`. Indicazioni generali con fonti ufficiali: niente consulenza
// legale, fiscale o tecnica su misura.

const MANUALE = { label: 'Leggi il Manuale Anti-Truffa', href: '/app/antitruffa', tool: 'antitruffa' }

export const SOLVE_GUIDES_IT: SolveGuide[] = [
  {
    id: 'messaggio-sospetto',
    version: '1',
    category: 'sicurezza',
    icon: 'MessageSquareWarning',
    title: 'Mi è arrivato un messaggio sospetto',
    subtitle: 'In pochi minuti capisci se è una truffa e cosa fare subito.',
    minutes: '3–5',
    questions: [
      {
        id: 'canale',
        text: 'Cosa ti è arrivato?',
        options: [
          { value: 'sms', label: 'Un SMS' },
          { value: 'chat', label: 'Un messaggio WhatsApp o Telegram' },
          { value: 'email', label: 'Un’email' },
          { value: 'telefonata', label: 'Una telefonata' },
          { value: 'social', label: 'Un annuncio o un profilo social' },
        ],
      },
      {
        id: 'fatto',
        text: 'Hai già fatto qualcosa?',
        options: [
          { value: 'niente', label: 'Non ho fatto niente' },
          { value: 'cliccato', label: 'Ho cliccato un link' },
          { value: 'dati', label: 'Ho dato dati o codici (carta, password, codici SMS, SPID)' },
          { value: 'soldi', label: 'Ho mandato soldi (bonifico, ricarica, criptovalute)' },
        ],
      },
    ],
    urgent: [
      {
        showIf: { q: 'fatto', anyOf: ['dati', 'soldi'] },
        title: 'Agisci adesso, poi torna qui',
        items: [
          'Carta o conto: chiama la tua banca al numero ufficiale (sul retro della carta o nell’app della banca, mai quello del messaggio) e fai bloccare carta e operazioni.',
          'Bonifico appena fatto: chiedi alla banca di provare a richiamarlo. Prima chiami, più è facile.',
          'Password o codici: cambia subito la password dell’account coinvolto da un dispositivo che usi solo tu e attiva la verifica in due passaggi.',
          'SPID: contatta il tuo gestore SPID per bloccarlo.',
          'Denuncia: alla Polizia Postale (commissariatodips.it) o in un ufficio di polizia, con screenshot e ricevute.',
        ],
      },
    ],
    steps: [
      { id: 'non-rispondere', title: 'Non rispondere e non richiamare', body: 'Non rispondere al messaggio e non richiamare il numero o l’indirizzo che ti ha scritto: confermeresti che il tuo contatto è attivo.' },
      {
        id: 'segnali',
        title: 'Controlla i segnali tipici',
        body: 'Fretta («entro oggi»), minacce (conto bloccato, multa, pacco fermo), premi inattesi, richiesta di codici o di pagare con ricarica, buoni regalo o criptovalute.',
      },
      {
        id: 'controlla-link',
        title: 'Controlla il link o il mittente senza aprirlo',
        body: 'Copia il link, l’indirizzo email o il numero e incollalo nel controllo di KUMANI: ti dice se è già segnalato e quali segnali ha.',
        link: { label: 'Incollalo qui', href: '/controlla' },
      },
      {
        id: 'iban',
        title: 'C’è un IBAN? Verificalo prima di pagare',
        body: 'Se il messaggio chiede un bonifico, controlla l’IBAN: paese della banca, scrittura corretta e segnalazioni della community.',
        link: { label: 'Verifica IBAN', href: '/app/verifica-iban', tool: 'verifica-iban' },
      },
      {
        id: 'richiama-tu',
        title: 'Riaggancia e richiama tu',
        body: 'Chiama l’ente o la banca al numero ufficiale che trovi da solo. Banche, Poste e forze dell’ordine non chiedono mai codici e non ti chiedono di spostare soldi su un «conto sicuro».',
        showIf: { q: 'canale', anyOf: ['telefonata'] },
      },
      {
        id: 'segnala',
        title: 'Segnalalo alla community',
        body: 'Numero, sito, IBAN o email: una segnalazione protegge anche gli altri iscritti.',
        link: { label: 'Rete Anti-Truffa', href: '/app/rete-antitruffa', tool: 'rete-antitruffa' },
      },
      { id: 'screenshot', title: 'Fai uno screenshot, poi elimina il messaggio', body: 'Lo screenshot serve se devi fare denuncia o reclamo alla banca.' },
    ],
    finish: { question: 'Problema risolto?', ifNo: [MANUALE, { label: 'Polizia Postale – Commissariato online', href: 'https://www.commissariatodips.it' }] },
    services: [
      { label: 'Verifica IBAN', href: '/app/verifica-iban', tool: 'verifica-iban' },
      { label: 'Rete Anti-Truffa', href: '/app/rete-antitruffa', tool: 'rete-antitruffa' },
      { label: 'CheckMail', href: '/app/checkmail', tool: 'checkmail' },
      { label: 'SVAT – controllo siti', href: '/app/svat', tool: 'svat' },
    ],
    sources: [
      { label: 'Polizia Postale – Commissariato di PS online', url: 'https://www.commissariatodips.it' },
      { label: 'Banca d’Italia', url: 'https://www.bancaditalia.it' },
      { label: 'CERT-AgID', url: 'https://cert-agid.gov.it' },
    ],
    reviewedAt: '2026-10-21',
    note: 'Indicazioni generali: non sostituiscono la tua banca né le forze dell’ordine.',
  },
  {
    id: 'dati-in-giro',
    version: '1',
    category: 'sicurezza',
    icon: 'KeyRound',
    title: 'La mia email o la mia password potrebbe essere finita in giro',
    subtitle: 'Scopri se i tuoi dati sono usciti in una fuga di dati e metti al sicuro i tuoi account.',
    minutes: '5–10',
    questions: [
      {
        id: 'motivo',
        text: 'Cosa ti ha fatto venire il dubbio?',
        options: [
          { value: 'avviso', label: 'Un’azienda o un sito mi ha avvisato di una fuga di dati' },
          { value: 'messaggi', label: 'Ricevo email o SMS strani con il mio nome o i miei dati' },
          { value: 'accesso', label: 'Qualcuno è entrato (o ha provato a entrare) in un mio account' },
          { value: 'controllo', label: 'Nessun motivo preciso, voglio solo controllare' },
        ],
      },
      {
        id: 'stessa',
        text: 'Usi la stessa password su più siti?',
        options: [
          { value: 'si', label: 'Sì' },
          { value: 'no', label: 'No' },
          { value: 'non-so', label: 'Non lo so' },
        ],
      },
    ],
    urgent: [
      {
        showIf: { q: 'motivo', anyOf: ['accesso'] },
        title: 'Metti al sicuro l’account adesso',
        items: [
          'Cambia la password da un dispositivo che usi solo tu, con una password nuova mai usata altrove.',
          'Esci da tutti i dispositivi: nelle impostazioni di sicurezza dell’account cerca «Esci da tutte le sessioni».',
          'Controlla email e numero di recupero: chi entra spesso li cambia per tenersi l’account.',
          'Se è la tua email, controlla che non ci siano inoltri automatici o regole che non hai creato tu.',
          'Se c’entrano banca o carta, chiama la banca al numero ufficiale.',
          'Se non riesci più a entrare, usa solo la procedura di recupero ufficiale del servizio, mai chi ti scrive offrendo aiuto.',
        ],
      },
    ],
    steps: [
      {
        id: 'email',
        title: 'Controlla la tua email',
        body: 'Scopri in quali fughe di dati è comparsa e quali dati sono usciti (password, telefono, indirizzo…).',
        link: { label: 'Scudo Dati', href: '/app/scudo-dati', tool: 'scudo-dati' },
      },
      {
        id: 'password',
        title: 'Controlla se la tua password è già circolata',
        body: 'In Scudo Dati, «La tua password»: il controllo avviene sul tuo telefono e la password non viene inviata.',
        link: { label: 'Scudo Dati', href: '/app/scudo-dati', tool: 'scudo-dati' },
      },
      { id: 'importanti', title: 'Cambia subito le password importanti', body: 'Parti dall’email (con l’email si recupera tutto il resto) e dalla banca.' },
      {
        id: 'riusata',
        title: 'Cambiala ovunque l’hai usata',
        body: 'Se un sito perde la tua password, i truffatori la provano su tutti gli altri.',
        showIf: { q: 'stessa', anyOf: ['si', 'non-so'] },
      },
      {
        id: 'gestore',
        title: 'Una password diversa per ogni sito',
        body: 'Il modo più semplice è il gestore di password già presente sul telefono (iPhone: app Password; Android e Chrome: Gestore delle password di Google): le crea e le ricorda per te.',
      },
      { id: 'due-passaggi', title: 'Attiva la verifica in due passaggi', body: 'Su email, banca e social: anche con la password, nessuno entra senza il codice sul tuo telefono.' },
      {
        id: 'su-misura',
        title: 'Attenzione ai messaggi «su misura»',
        body: 'Nei prossimi mesi chi ha i tuoi dati può usarli per truffe credibili, con il tuo nome o un acquisto vero. Al primo dubbio segui la guida «Mi è arrivato un messaggio sospetto».',
        link: { label: 'Apri la guida', href: '/risolvi/messaggio-sospetto' },
      },
      {
        id: 'google',
        title: 'Togli telefono e indirizzo dai risultati di Google',
        body: 'In Scudo Dati trovi come chiedere a Google di togliere i tuoi dati personali dalle ricerche.',
        showIf: { q: 'motivo', anyOf: ['messaggi'] },
        link: { label: 'Scudo Dati', href: '/app/scudo-dati', tool: 'scudo-dati' },
      },
    ],
    finish: { question: 'Account al sicuro?', ifNo: [MANUALE, { label: 'Garante per la protezione dei dati personali', href: 'https://www.garanteprivacy.it' }] },
    services: [{ label: 'Scudo Dati', href: '/app/scudo-dati', tool: 'scudo-dati' }],
    sources: [
      { label: 'Garante per la protezione dei dati personali', url: 'https://www.garanteprivacy.it' },
      { label: 'CERT-AgID', url: 'https://cert-agid.gov.it' },
      { label: 'XposedOrNot (archivio delle fughe di dati)', url: 'https://xposedornot.com' },
      { label: 'Have I Been Pwned', url: 'https://haveibeenpwned.com' },
    ],
    reviewedAt: '2026-10-21',
    note: 'KUMANI non ti chiederà mai la tua password: in questa guida non devi scriverla da nessuna parte, tranne nel controllo di Scudo Dati, che la verifica senza inviarla.',
  },
  {
    id: 'foto-documento',
    version: '1',
    category: 'sicurezza',
    icon: 'FileLock2',
    title: 'Devo mandare la foto di un documento',
    subtitle: 'Carta d’identità, patente, codice fiscale: come mandarli senza regalarli a un truffatore.',
    minutes: '3–5',
    questions: [
      {
        id: 'chi',
        text: 'Chi ti chiede il documento?',
        options: [
          { value: 'ente', label: 'Una banca, un ente o un’azienda che conosco' },
          { value: 'casa-lavoro', label: 'Un’agenzia per un affitto o un datore di lavoro' },
          { value: 'privato', label: 'Un privato per una compravendita' },
          { value: 'sconosciuto', label: 'Qualcuno conosciuto online' },
        ],
      },
      {
        id: 'inviato',
        text: 'L’hai già mandato?',
        options: [
          { value: 'no', label: 'Non ancora' },
          { value: 'si', label: 'Sì, e ora ho dei dubbi' },
        ],
      },
    ],
    urgent: [
      {
        showIf: { q: 'inviato', anyOf: ['si'] },
        title: 'Se pensi di averlo mandato a un truffatore',
        items: [
          'Conserva la chat, il numero o il profilo e la data dell’invio.',
          'Fai denuncia alla Polizia Postale (commissariatodips.it) o in un ufficio di polizia: serve se il documento venisse usato a tuo nome.',
          'Avvisa la tua banca e chiedi di fare attenzione a richieste o aperture di conti a tuo nome.',
          'Nei mesi successivi controlla la tua posizione nella Centrale dei Rischi della Banca d’Italia (gratuita): vedi se qualcuno ha chiesto finanziamenti a tuo nome.',
        ],
      },
    ],
    steps: [
      {
        id: 'verifica-chi',
        title: 'Verifica chi te lo chiede',
        body: 'Per enti e aziende usa i canali ufficiali (sito, app, PEC), non un numero o un link ricevuto in chat.',
        showIf: { q: 'chi', anyOf: ['ente', 'casa-lavoro'] },
      },
      {
        id: 'mai-sconosciuti',
        title: 'A chi conosci solo online, non mandarlo',
        body: 'Nessun motivo valido (lavoro facile, vincita, affetto, pacco) richiede la foto del tuo documento a chi non hai mai incontrato. È uno dei modi più usati per rubare l’identità.',
        showIf: { q: 'chi', anyOf: ['sconosciuto'] },
        link: MANUALE,
      },
      {
        id: 'compravendita',
        title: 'Per una compravendita tra privati di solito non serve',
        body: 'Per vendere o comprare un oggetto basta incontrarsi o usare il pagamento della piattaforma. Il documento serve per il passaggio di proprietà di un’auto, da fare in agenzia o al PRA.',
        showIf: { q: 'chi', anyOf: ['privato'] },
      },
      { id: 'solo-necessario', title: 'Manda solo quello che serve', body: 'Se basta il fronte, non mandare il retro. Niente selfie con il documento in mano se non è richiesto da un servizio ufficiale.' },
      {
        id: 'filigrana',
        title: 'Aggiungi una filigrana con scopo e data',
        body: 'Esempio: «Solo per contratto affitto via Roma – 21/10/2026». Se la foto finisce altrove, non è riutilizzabile. Oscura i dati che non servono.',
        link: { label: 'Documento Sicuro', href: '/app/documento-sicuro', tool: 'documento-sicuro' },
      },
      { id: 'canale-sicuro', title: 'Usa un canale sicuro e poi cancella', body: 'Meglio l’area riservata o la PEC dell’ente che la chat. Dopo l’invio, cancella la foto dalla chat se possibile.' },
    ],
    finish: { question: 'Hai mandato il documento in sicurezza?', ifNo: [MANUALE, { label: 'Polizia Postale – Commissariato online', href: 'https://www.commissariatodips.it' }] },
    services: [
      { label: 'Documento Sicuro', href: '/app/documento-sicuro', tool: 'documento-sicuro' },
      { label: 'Manuale Anti-Truffa', href: '/app/antitruffa', tool: 'antitruffa' },
    ],
    sources: [
      { label: 'Polizia Postale – Commissariato di PS online', url: 'https://www.commissariatodips.it' },
      { label: 'Banca d’Italia – Centrale dei Rischi', url: 'https://www.bancaditalia.it' },
      { label: 'Garante per la protezione dei dati personali', url: 'https://www.garanteprivacy.it' },
    ],
    reviewedAt: '2026-10-21',
    note: 'Indicazioni generali sulla protezione dei dati personali.',
  },
  {
    id: 'auto-usata',
    version: '1',
    category: 'auto',
    icon: 'Car',
    title: 'Compro o vendo un’auto usata senza farmi fregare',
    subtitle: 'I controlli da fare prima di pagare o di consegnare le chiavi.',
    minutes: '5–10',
    questions: [
      {
        id: 'ruolo',
        text: 'Cosa devi fare?',
        options: [
          { value: 'compro', label: 'Compro un’auto usata' },
          { value: 'vendo', label: 'Vendo la mia auto' },
        ],
      },
      {
        id: 'controparte',
        text: 'Con chi tratti?',
        options: [
          { value: 'privato', label: 'Con un privato' },
          { value: 'concessionario', label: 'Con un concessionario o un’attività' },
        ],
      },
    ],
    steps: [
      { id: 'vedere-prima', title: 'Prima vedi l’auto, poi paghi', body: 'Niente caparre o anticipi per un’auto che non hai visto dal vivo, soprattutto se il venditore «è all’estero».', showIf: { q: 'ruolo', anyOf: ['compro'] } },
      {
        id: 'visura',
        title: 'Fai la visura al PRA',
        body: 'Sul sito dell’ACI vedi intestatario, fermi amministrativi e ipoteche: un’auto con fermo non si può vendere liberamente.',
        showIf: { q: 'ruolo', anyOf: ['compro'] },
        link: { label: 'ACI – visure PRA', href: 'https://www.aci.it' },
      },
      {
        id: 'revisione-km',
        title: 'Controlla revisione e chilometri',
        body: 'Sul Portale dell’Automobilista vedi la data dell’ultima revisione e i km registrati: se i km di oggi sono meno di quelli dell’ultima revisione, il contachilometri è stato manomesso.',
        showIf: { q: 'ruolo', anyOf: ['compro'] },
        link: { label: 'Portale dell’Automobilista', href: 'https://www.ilportaledellautomobilista.it' },
      },
      { id: 'prova', title: 'Prova su strada e controllo di un meccanico', body: 'Se puoi, fai vedere l’auto a un meccanico di fiducia prima di decidere.', showIf: { q: 'ruolo', anyOf: ['compro'] } },
      {
        id: 'iban-venditore',
        title: 'Verifica l’IBAN prima del bonifico',
        body: 'L’intestatario del conto deve essere il venditore. Controlla l’IBAN e le segnalazioni della community.',
        showIf: { q: 'ruolo', anyOf: ['compro'] },
        link: { label: 'Verifica IBAN', href: '/app/verifica-iban', tool: 'verifica-iban' },
      },
      {
        id: 'annuncio',
        title: 'Pubblica l’annuncio senza dati sensibili',
        body: 'Niente targa leggibile nelle foto, niente documenti. Puoi pubblicarlo anche in Bacheca KUMANI, controllata dallo Staff.',
        showIf: { q: 'ruolo', anyOf: ['vendo'] },
        link: { label: 'Bacheca', href: '/app/listings', tool: 'listings' },
      },
      {
        id: 'acquirenti-strani',
        title: 'Attento agli acquirenti «troppo comodi»',
        body: 'Chi compra senza vedere l’auto, paga più del prezzo e chiede la differenza, o manda un link per «ricevere il pagamento» è quasi sempre un truffatore.',
        showIf: { q: 'ruolo', anyOf: ['vendo'] },
      },
      {
        id: 'pagamento-vero',
        title: 'Consegna le chiavi solo a soldi arrivati',
        body: 'Controlla l’accredito sul tuo conto, non uno screenshot. Un assegno circolare va verificato chiamando la banca che l’ha emesso al suo numero ufficiale.',
        showIf: { q: 'ruolo', anyOf: ['vendo'] },
      },
      {
        id: 'passaggio',
        title: 'Passaggio di proprietà in regola',
        body: 'Si fa con atto autenticato in un’agenzia di pratiche auto, allo sportello ACI o in Comune, e va registrato al PRA entro 60 giorni. Finché non è registrato, multe e bollo possono arrivare al vecchio proprietario.',
        showIf: { q: 'controparte', anyOf: ['privato'] },
      },
      {
        id: 'contratto-concessionario',
        title: 'Con un concessionario: tutto per iscritto',
        body: 'Prezzo, km, interventi fatti e garanzia sull’usato vanno scritti nel contratto. Il concessionario si occupa di solito del passaggio di proprietà: chiedi la ricevuta.',
        showIf: [
          { q: 'ruolo', anyOf: ['compro'] },
          { q: 'controparte', anyOf: ['concessionario'] },
        ],
      },
      {
        id: 'vendo-concessionario',
        title: 'Vendi a un concessionario: tutto per iscritto',
        body: 'Fatti scrivere il prezzo concordato e chiedi la ricevuta del passaggio di proprietà: finché non è registrato, multe e bollo possono arrivare a te.',
        showIf: [
          { q: 'ruolo', anyOf: ['vendo'] },
          { q: 'controparte', anyOf: ['concessionario'] },
        ],
      },
      {
        id: 'garage',
        title: 'Segna subito le scadenze della nuova auto',
        body: 'Bollo, assicurazione e revisione con i promemoria.',
        showIf: { q: 'ruolo', anyOf: ['compro'] },
        link: { label: 'Garage', href: '/app/garage', tool: 'garage' },
      },
    ],
    finish: { question: 'Tutto fatto in sicurezza?', ifNo: [MANUALE, { label: 'Rete Anti-Truffa', href: '/app/rete-antitruffa', tool: 'rete-antitruffa' }] },
    services: [
      { label: 'Verifica IBAN', href: '/app/verifica-iban', tool: 'verifica-iban' },
      { label: 'Bacheca', href: '/app/listings', tool: 'listings' },
      { label: 'Garage', href: '/app/garage', tool: 'garage' },
    ],
    sources: [
      { label: 'ACI – Pubblico Registro Automobilistico', url: 'https://www.aci.it' },
      { label: 'Portale dell’Automobilista', url: 'https://www.ilportaledellautomobilista.it' },
    ],
    reviewedAt: '2026-10-21',
    note: 'Indicazioni generali: per casi particolari (eredità, leasing, auto estere) rivolgiti a un’agenzia di pratiche auto o all’ACI.',
  },
  {
    id: 'bolletta-alta',
    version: '1',
    category: 'soldi',
    icon: 'Receipt',
    title: 'La bolletta è più alta del solito',
    subtitle: 'Capisci da dove arriva l’importo e come contestarlo se è sbagliato.',
    minutes: '5–10',
    questions: [
      {
        id: 'tipo',
        text: 'Che bolletta è?',
        options: [
          { value: 'luce-gas', label: 'Luce o gas' },
          { value: 'acqua', label: 'Acqua' },
          { value: 'telefono', label: 'Telefono o internet' },
        ],
      },
      {
        id: 'lettura',
        text: 'Nella bolletta i consumi sono…',
        options: [
          { value: 'stimati', label: 'Stimati' },
          { value: 'reali', label: 'Letti (effettivi)' },
          { value: 'non-so', label: 'Non lo so' },
        ],
      },
    ],
    steps: [
      { id: 'periodo', title: 'Controlla il periodo', body: 'Quanti giorni copre la bolletta? Se è più lunga del solito, l’importo sale anche con gli stessi consumi.' },
      {
        id: 'conguaglio',
        title: 'Cerca la parola «conguaglio»',
        body: 'Il conguaglio sistema la differenza tra consumi stimati in passato e consumi reali: può far salire molto una singola bolletta.',
        showIf: { q: 'tipo', anyOf: ['luce-gas', 'acqua'] },
      },
      {
        id: 'autolettura',
        title: 'Leggi il contatore e comunica l’autolettura',
        body: 'Fai una foto al contatore con la data e comunica la lettura al fornitore (app, sito o numero verde): le prossime bollette saranno sui consumi veri.',
        showIf: [
          { q: 'lettura', anyOf: ['stimati', 'non-so'] },
          { q: 'tipo', anyOf: ['luce-gas', 'acqua'] },
        ],
      },
      { id: 'confronto', title: 'Confronta con lo stesso periodo dell’anno scorso', body: 'D’inverno il gas, d’estate il condizionatore: il paragone giusto è con gli stessi mesi.', showIf: { q: 'tipo', anyOf: ['luce-gas', 'acqua'] } },
      {
        id: 'servizi-extra',
        title: 'Cerca servizi o costi che non hai chiesto',
        body: 'Abbonamenti a contenuti, servizi aggiuntivi o costi di modem e rate: si possono contestare se non li hai attivati tu.',
        showIf: { q: 'tipo', anyOf: ['telefono'] },
      },
      { id: 'prezzo', title: 'Controlla se è cambiato il prezzo', body: 'Il fornitore deve comunicarti in anticipo le modifiche delle condizioni. Cerca nelle bollette e nelle email precedenti.' },
      {
        id: 'prescrizione',
        title: 'Importi molto vecchi',
        body: 'Per luce, gas e acqua gli importi riferiti a più di 2 anni prima possono essere prescritti: se ne trovi, chiedilo al fornitore per iscritto.',
        showIf: { q: 'tipo', anyOf: ['luce-gas', 'acqua'] },
      },
      { id: 'reclamo', title: 'Se è sbagliata, fai reclamo scritto', body: 'Al fornitore, con il modulo sul sito o via PEC, allegando bolletta e foto del contatore. Conserva la ricevuta. Se l’importo è giusto ma alto, puoi chiedere la rateizzazione.' },
      {
        id: 'conciliazione-energia',
        title: 'Nessuna risposta o risposta che non ti convince?',
        body: 'Per luce e gas c’è il Servizio Conciliazione di ARERA, gratuito e online.',
        showIf: { q: 'tipo', anyOf: ['luce-gas'] },
        link: { label: 'Sportello per il consumatore – ARERA', href: 'https://www.sportelloperilconsumatore.it' },
      },
      {
        id: 'conciliazione-tlc',
        title: 'Nessuna risposta o risposta che non ti convince?',
        body: 'Per telefono e internet c’è la conciliazione gratuita online di AGCOM (ConciliaWeb).',
        showIf: { q: 'tipo', anyOf: ['telefono'] },
        link: { label: 'ConciliaWeb – AGCOM', href: 'https://conciliaweb.agcom.it' },
      },
      {
        id: 'tieni-traccia',
        title: 'Tieni traccia delle bollette',
        body: 'Segna importi e scadenze: così noti subito una bolletta fuori dal normale.',
        link: { label: 'Casa – utenze e bollette', href: '/app/casa', tool: 'casa' },
      },
    ],
    finish: { question: 'Hai capito da dove arriva l’importo?', ifNo: [{ label: 'Sportello per il consumatore – ARERA', href: 'https://www.sportelloperilconsumatore.it' }, { label: 'Check-up dei conti', href: '/app/fincheck', tool: 'fincheck' }] },
    services: [
      { label: 'Casa – utenze e bollette', href: '/app/casa', tool: 'casa' },
      { label: 'Spendly', href: '/app/spendly', tool: 'spendly' },
      { label: 'Check-up dei conti', href: '/app/fincheck', tool: 'fincheck' },
    ],
    sources: [
      { label: 'ARERA – Autorità di Regolazione per Energia Reti e Ambiente', url: 'https://www.arera.it' },
      { label: 'Sportello per il consumatore Energia e Ambiente', url: 'https://www.sportelloperilconsumatore.it' },
      { label: 'AGCOM – ConciliaWeb', url: 'https://conciliaweb.agcom.it' },
    ],
    reviewedAt: '2026-10-21',
    note: 'Indicazioni generali: tempi e modalità del reclamo sono indicati nel contratto e nella bolletta del tuo fornitore.',
  },
  {
    id: 'scadenze-auto',
    version: '1',
    category: 'auto',
    icon: 'CalendarClock',
    title: 'Non voglio più dimenticare bollo, assicurazione e revisione',
    subtitle: 'Trova le date giuste e fatti avvisare in tempo.',
    minutes: '5',
    questions: [
      {
        id: 'veicolo',
        text: 'Che veicolo hai?',
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'moto', label: 'Moto o scooter' },
        ],
      },
      {
        id: 'nuovo',
        text: 'È stato immatricolato negli ultimi 4 anni?',
        options: [
          { value: 'si', label: 'Sì, è nuovo o quasi' },
          { value: 'no', label: 'No' },
          { value: 'non-so', label: 'Non lo so' },
        ],
      },
    ],
    steps: [
      { id: 'libretto', title: 'Prendi libretto e polizza', body: 'Ti servono targa, data di prima immatricolazione (sul libretto) e scadenza dell’assicurazione (sulla polizza o nell’app della compagnia).' },
      {
        id: 'assicurazione',
        title: 'Assicurazione',
        body: 'Segna la data di scadenza. Dopo la scadenza la copertura resta valida per 15 giorni, ma non contarci: rinnova o cambia prima.',
      },
      {
        id: 'bollo',
        title: 'Bollo',
        body: 'La scadenza dipende dalla Regione e dal mese di immatricolazione. Sul sito dell’ACI o della tua Regione trovi importo e scadenza inserendo la targa.',
        link: { label: 'ACI – calcolo del bollo', href: 'https://www.aci.it' },
      },
      {
        id: 'revisione-prima',
        title: 'Prima revisione',
        body: 'La prima revisione si fa entro 4 anni dalla prima immatricolazione, nel mese indicato sul libretto.',
        showIf: { q: 'nuovo', anyOf: ['si', 'non-so'] },
      },
      {
        id: 'revisione',
        title: 'Revisione ogni 2 anni',
        body: 'Dopo la prima, la revisione si fa ogni 2 anni. Sul Portale dell’Automobilista vedi la data dell’ultima revisione con la targa.',
        link: { label: 'Portale dell’Automobilista', href: 'https://www.ilportaledellautomobilista.it' },
      },
      { id: 'tagliando', title: 'Tagliando', body: 'Non è un obbligo di legge, ma tiene valida la garanzia della casa: la frequenza è nel libretto di manutenzione.', showIf: { q: 'veicolo', anyOf: ['auto'] } },
      { id: 'patente', title: 'Anche la patente scade', body: 'La data è sul fronte della patente: aggiungila insieme alle altre.' },
      {
        id: 'promemoria',
        title: 'Metti tutto in Garage con i promemoria',
        body: 'Inserisci il veicolo e le date: KUMANI ti avvisa prima di ogni scadenza.',
        link: { label: 'Garage', href: '/app/garage', tool: 'garage' },
      },
    ],
    finish: { question: 'Hai segnato tutte le scadenze?', ifNo: [{ label: 'Portale dell’Automobilista', href: 'https://www.ilportaledellautomobilista.it' }, { label: 'ACI', href: 'https://www.aci.it' }] },
    services: [
      { label: 'Garage', href: '/app/garage', tool: 'garage' },
      { label: 'MemoLife – agenda', href: '/app/memolife', tool: 'memolife' },
    ],
    sources: [
      { label: 'Portale dell’Automobilista (Ministero delle Infrastrutture e dei Trasporti)', url: 'https://www.ilportaledellautomobilista.it' },
      { label: 'ACI', url: 'https://www.aci.it' },
    ],
    reviewedAt: '2026-10-21',
    note: 'Indicazioni generali per auto e moto ad uso privato: veicoli commerciali, taxi e mezzi pesanti hanno scadenze diverse.',
  },
]

export const solveGuideBySlug = (slug: string) => SOLVE_GUIDES_IT.find((g) => g.id === slug) ?? null
