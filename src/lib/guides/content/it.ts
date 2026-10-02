import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Primi passi', text: 'Crea il tuo account, accedi e scopri la tua dashboard.' },
    promote: { title: 'Promuovere KUMANI', text: 'Invita chi conosci con il tuo link e usa i voucher.' },
    wallet: { title: 'Il Wallet', text: 'Tessera, punti, donazioni, badge e ricevute in un unico posto.' },
    promoteTools: { title: "Strumenti per promuovere", text: "Le guide ai servizi che ti aiutano a far conoscere KUMANI." },
    security: { title: "Sicurezza", text: "Le guide ai servizi che ti aiutano a riconoscere e fermare le truffe." },
    community: { title: "Community", text: "Le guide ai servizi per incontrarsi, aiutarsi e giocare insieme." },
  },
  guides: [
    {
      slug: 'registrazione',
      category: 'start',
      title: 'Come registrarsi',
      summary: 'Crea il tuo account KUMANI in pochi minuti e attivalo con il codice che ricevi via email.',
      minutes: 3,
      steps: [
        {
          title: 'Apri KUMANI e tocca «Inizia Ora»',
          text: 'Dalla homepage tocca il pulsante dorato «Inizia Ora» in alto a destra. Se qualcuno ti ha mandato il suo link di invito, aprilo: il suo codice viene inserito da solo.',
        },
        {
          title: 'Compila i tuoi dati',
          text: 'Scrivi nome, cognome, email e una password di almeno 6 caratteri, poi scegli il tuo Paese e la tua città.',
          tip: 'Usa un’email che controlli spesso: lì arriva il codice per attivare l’account.',
        },
        {
          title: 'Codice invito e voucher (facoltativi)',
          text: 'Se un Kumano ti ha invitato, scrivi il suo codice invito. Se hai ricevuto un voucher KUMANI, inseriscilo nel campo «Codice voucher di attivazione»: il tuo abbonamento si attiva subito. Se hai un negozio, uno studio o un’attività, spunta «Sono un professionista». Poi tocca «Crea il tuo account».',
        },
        {
          title: 'Verifica la tua email',
          text: 'Ti mandiamo un codice via email. Scrivilo nel campo «Codice di verifica» e tocca «Verifica e attiva l’account». Fatto: sei dentro!',
          tip: 'Non trovi l’email? Guarda nella cartella spam oppure tocca «Invia di nuovo il codice».',
        },
      ],
      cta: { label: 'Crea il tuo account', href: '/register' },
    },
    {
      slug: 'accesso',
      category: 'start',
      title: 'Come accedere',
      summary: 'Entra nel tuo account e recupera la password se l’hai dimenticata.',
      minutes: 2,
      steps: [
        {
          title: 'Inserisci email e password',
          text: 'Dalla homepage tocca «Accedi», scrivi l’email e la password che hai scelto quando ti sei registrato e tocca «Accedi».',
        },
        {
          title: 'Hai dimenticato la password?',
          text: 'Tocca «Password dimenticata?» sotto il pulsante di accesso.',
        },
        {
          title: 'Reimposta la password',
          text: 'Scrivi la tua email e tocca «Reimposta Password»: ti mandiamo un codice per sceglierne una nuova. Poi accedi con la nuova password.',
          tip: 'Puoi aggiungere KUMANI alla schermata Home del telefono: si apre come un’app.',
        },
      ],
      cta: { label: 'Vai all’accesso', href: '/login' },
    },
    {
      slug: 'dashboard',
      category: 'start',
      title: 'La tua dashboard',
      summary: 'Cosa trovi nella dashboard e come arrivare ai servizi che usi di più.',
      minutes: 3,
      steps: [
        {
          title: 'La barra in alto',
          text: 'In alto cambi la lingua, apri il tuo profilo, il Wallet ed esci dall’account. La stella ti porta ai tuoi servizi preferiti.',
        },
        {
          title: 'I servizi gratuiti',
          text: 'Nella fascia «Gratis» ci sono i servizi inclusi per tutti gli iscritti, senza limiti di tempo. Tocca «Apri» per usarli e la stellina per metterli tra i preferiti.',
        },
        {
          title: 'I tre livelli dei servizi',
          text: 'I servizi sono divisi in tre livelli: Gratis, Base e Pro. Con l’abbonamento Base o Pro si sbloccano tutti i servizi del livello; con un Pass puoi attivare anche un solo servizio.',
        },
        {
          title: 'Punti, abbonamento e codice invito',
          text: 'Più in basso vedi i KU Karma che accumuli ogni giorno con gli accessi, lo stato del tuo abbonamento (con «Abbonati ora» o «Attiva tramite Voucher») e il tuo codice invito personale.',
        },
        {
          title: 'La Community e le altre pagine',
          text: 'In fondo trovi la tua Community KUMANI e i collegamenti rapidi alle altre pagine: Community, Wallet e Bacheca.',
        },
      ],
      cta: { label: 'Apri la dashboard', href: '/dashboard' },
    },
    {
      slug: 'invito',
      category: 'promote',
      title: 'Invitare con il tuo link',
      summary: 'Condividi il tuo codice o il tuo link di invito e segui chi entra nella tua stella KUMANI.',
      minutes: 3,
      steps: [
        {
          title: 'Il tuo codice invito',
          text: 'Nella dashboard trovi il tuo codice invito personale. Tocca l’icona accanto per copiarlo: chi si iscrive con il tuo link entra nella tua stella KUMANI.',
        },
        {
          title: 'Condividi il link',
          text: 'Nella pagina Community trovi il tuo link già pronto: copialo, tocca «Invita su WhatsApp» oppure «Condividi…» per mandarlo con Instagram, Telegram e le altre app del telefono.',
          tip: 'Un messaggio personale funziona meglio di un messaggio mandato a tutti: racconta perché KUMANI ti è utile.',
        },
        {
          title: 'La tua stella KUMANI',
          text: 'La stella mostra le 5 persone che hai invitato direttamente e quante persone attive ci sono sotto ogni posizione. Chi si registra ma non ha ancora attivato l’abbonamento compare in «Non ancora KUMANI».',
        },
        {
          title: 'Come guadagni i KU Points',
          text: 'Nel Wallet trovi le regole: ricevi KU Points quando una persona che hai invitato attiva l’abbonamento pagando con carta o passa a Pro, e con il Bonus Accoglienza.',
        },
      ],
      cta: { label: 'Apri la tua Community', href: '/dashboard/rete' },
    },
    {
      slug: 'voucher',
      category: 'promote',
      title: 'Creare e usare i voucher',
      summary: 'Trasforma i KU Points in voucher da regalare e attiva un voucher che hai ricevuto.',
      minutes: 3,
      steps: [
        {
          title: 'Riscatta un pacchetto di punti',
          text: 'Nel Wallet, nella sezione dei voucher, spendi i tuoi KU Points per riscattare un pacchetto: ricevi un credito in euro per creare voucher. Sotto ogni pacchetto vedi quanti punti ti mancano.',
        },
        {
          title: 'Crea un voucher',
          text: 'Con il credito scegli il piano (Base o Pro, un anno) e se il voucher è da regalare o da vendere, poi tocca «Crea voucher».',
        },
        {
          title: 'Hai ricevuto un voucher?',
          text: 'Scrivi il codice nel campo «Hai ricevuto un voucher?» e tocca «Riscatta»: il tuo abbonamento si attiva subito. Puoi anche inserirlo quando ti registri.',
        },
      ],
      cta: { label: 'Vai ai voucher', href: '/wallet' },
    },
    {
      slug: 'wallet',
      category: 'wallet',
      title: 'Usare il Wallet',
      summary: 'La tua tessera, i punti, le donazioni, i badge e le ricevute: ecco cosa trovi nel Wallet.',
      minutes: 4,
      steps: [
        {
          title: 'La tua tessera Membership',
          text: 'In cima c’è la tua tessera KUMANI con numero membro, piano attivo e scadenza. Il codice QR si può scaricare con «Scarica QR».',
        },
        {
          title: 'I tuoi punti',
          text: 'Qui vedi i KU Karma, che si guadagnano ogni giorno con gli accessi e l’uso degli strumenti, e i KU Points, che ricevi quando una persona che hai invitato attiva l’abbonamento. I punti non sono denaro e si usano solo dentro la piattaforma.',
        },
        {
          title: 'Dona i tuoi KU Points',
          text: 'Nella sezione Donazioni puoi donare i tuoi KU Points all’associazione sostenuta da KUMANI: ogni 10 punti donati = 1 €, che KUMANI versa all’associazione.',
        },
        {
          title: 'I badge',
          text: 'I badge Kuman Green, Kuman Star e Kuman Black si sbloccano con i KU Points guadagnati in totale. La barra ti dice quanti punti mancano al prossimo.',
        },
        {
          title: 'Ricevute, coupon e sconto sul rinnovo',
          text: 'Più in basso trovi le Ricevute Digitali (piano Pro), i coupon ottenuti nell’Ecosistema e lo sconto sul rinnovo dell’abbonamento che puoi ottenere con i KU Karma.',
        },
      ],
      cta: { label: 'Apri il Wallet', href: '/wallet' },
    },
    {
      slug: "qr-generator",
      category: "promoteTools",
      title: "QR Code Dinamico",
      summary: "Crea il QR code del tuo link di invito, scegli i colori e scaricalo per stamparlo o condividerlo.",
      minutes: 2,
      steps: [
        {
          title: "Il tuo link è già dentro",
          text: "Il QR porta al tuo link di invito personale. Il «Link di destinazione» è bloccato: così chi lo inquadra entra sempre nella tua stella KUMANI."
        },
        {
          title: "Scegli i colori",
          text: "Cambia il «Colore del QR Code» e il «Colore di Sfondo», oppure tocca uno dei «Temi rapidi».",
          tip: "Lascia un buon contrasto tra QR e sfondo: un QR troppo chiaro si legge male."
        },
        {
          title: "Scarica il QR",
          text: "Controlla l’anteprima e tocca «Scarica PNG»: l’immagine è in alta risoluzione, adatta anche alla stampa."
        },
        {
          title: "Dove usarlo",
          text: "Stampalo su biglietti da visita e volantini, condividilo sui social o mettilo nella firma delle tue email."
        }
      ],
      cta: {
        label: "Apri il QR Code Dinamico",
        href: "/marketplace/qr-generator"
      }
    },
    {
      slug: "whatsapp-messages",
      category: "promoteTools",
      title: "Messaggi WhatsApp",
      summary: "Messaggi già pronti con il tuo link di invito: scegli il tono giusto e invialo in pochi secondi.",
      minutes: 2,
      steps: [
        {
          title: "Scegli il messaggio",
          text: "Ci sono 4 messaggi per situazioni diverse: informale, formale, emozionale e dopo un incontro. Il tuo link di invito è già nel testo."
        },
        {
          title: "Copia o invia",
          text: "Tocca «Invia su WhatsApp» per aprire WhatsApp con il messaggio pronto e scegli a chi mandarlo. Oppure tocca «Copia messaggio» e incollalo dove vuoi, anche in un’altra app.",
          tip: "In WhatsApp puoi modificare il testo prima di inviarlo: aggiungi il nome della persona."
        },
        {
          title: "Consigli per messaggi efficaci",
          text: "Personalizza sempre il messaggio, non mandarlo a troppe persone insieme e, dopo, fai seguire una chiamata o un messaggio vocale."
        }
      ],
      cta: {
        label: "Apri Messaggi WhatsApp",
        href: "/marketplace/whatsapp-messages"
      }
    },
    {
      slug: "link-in-bio",
      category: "promoteTools",
      title: "Link in Bio",
      summary: "Crea la tua pagina personale con i tuoi link, da mettere nella bio di Instagram, TikTok e degli altri social.",
      minutes: 3,
      steps: [
        {
          title: "Scrivi la tua bio",
          text: "Nel campo «Testo Bio» scrivi una frase su di te: compare sotto il tuo nome."
        },
        {
          title: "Colore e temi speciali",
          text: "Scegli il colore della pagina. I temi speciali (Aurora boreale, Luna sul lago, Savana al tramonto) li vedi in anteprima toccandoli: i KU Karma si usano solo se decidi di sbloccarli."
        },
        {
          title: "Aggiungi i tuoi link e salva",
          text: "Tocca «Aggiungi Link» per inserire i tuoi link (sito, social, negozio…): il tuo link di invito KUMANI c’è sempre. Poi tocca «Salva Pagina».",
          tip: "Più in basso vedi l’anteprima di come apparirà la pagina."
        },
        {
          title: "Condividi la tua pagina",
          text: "Copia il link della pagina e mettilo nella bio dei tuoi social, oppure tocca «Visita la tua Link in Bio» per vederla. Ricordati di salvare prima di condividere."
        }
      ],
      cta: {
        label: "Apri Link in Bio",
        href: "/marketplace/link-in-bio"
      }
    },
    {
      slug: "spotlight",
      category: "promoteTools",
      title: "Kumano del Giorno",
      summary: "Racconta la tua storia ed entra nella vetrina della community: ogni giorno un Kumano viene messo in evidenza. È riservato agli abbonati attivi.",
      minutes: 3,
      steps: [
        {
          title: "Racconta la tua storia",
          text: "Compila nome o soprannome (mai il cognome), città, nazione, mestiere o passione e una breve storia, da leggere in 20 secondi."
        },
        {
          title: "Scegli i tuoi strumenti preferiti",
          text: "Tocca gli strumenti KUMANI che usi di più: compaiono insieme alla tua storia."
        },
        {
          title: "Consensi e invio",
          text: "Spunta il consenso per essere mostrato alla community (quello per la homepage è facoltativo) e tocca «Salva ed entra in vetrina». Lo Staff KUMANI approva la storia, poi entra nella rotazione del Kumano del Giorno.",
          tip: "Puoi togliere la tua storia dalla vetrina o dalla homepage quando vuoi, da questa stessa pagina."
        }
      ],
      cta: {
        label: "Racconta la tua storia",
        href: "/marketplace/spotlight"
      }
    },
    {
      slug: "events",
      category: "promoteTools",
      title: "KUMANI Events",
      summary: "Trova incontri, workshop e serate della community, iscriviti con un tocco ed entra con il tuo pass.",
      minutes: 3,
      steps: [
        {
          title: "Trova un evento",
          text: "Cerca per città, paese, lingua e data, oppure tocca «Solo online» per gli eventi in rete."
        },
        {
          title: "Iscriviti e ricevi il pass",
          text: "Apri l’evento e tocca «Partecipa»: ricevi subito il pass con il QR, che trovi in «I miei pass». All’ingresso mostralo: l’organizzatore lo inquadra e sei dentro.",
          tip: "Se l’evento è pieno puoi metterti in lista d’attesa: se si libera un posto entri in automatico."
        },
        {
          title: "Organizza un evento",
          text: "Vuoi organizzare tu un incontro nella tua città o online? Tocca «Organizza un evento»."
        },
        {
          title: "Diventa organizzatore verificato",
          text: "Per organizzare eventi bisogna essere un Kumano Verificato: tocca «Diventa organizzatore verificato» e segui i passaggi. Poi, da «I miei eventi», gestisci iscritti e check-in."
        }
      ],
      cta: {
        label: "Apri KUMANI Events",
        href: "/events"
      }
    },
    {
      slug: "antitruffa",
      category: "security",
      title: "Manuale Anti-Truffa",
      summary: "Le truffe più diffuse, con esempi reali e cosa fare subito: leggilo, salvalo e condividilo con chi ami.",
      minutes: 2,
      steps: [
        {
          title: "Scaricalo o stampalo",
          text: "In alto tocca «Scarica o stampa il manuale»: si apre la stampa del telefono o del computer, dove puoi anche salvarlo come PDF."
        },
        {
          title: "Condividilo con chi ami",
          text: "Mandalo a genitori, nonni e amici con WhatsApp, Facebook, Telegram, X, LinkedIn o email, oppure copia il link. Chi si iscrive dal tuo link entra nella tua rete."
        },
        {
          title: "Il test dei 10 secondi",
          text: "Prima di cliccare, rispondere o pagare, fatti le 6 domande del test: se anche una sola risposta è «sì», è quasi certamente una truffa.",
          tip: "Subito sotto ci sono le 6 regole d’oro: bastano quelle per evitare la maggior parte delle truffe."
        },
        {
          title: "Scegli un capitolo",
          text: "Dall’indice vai al capitolo che ti serve: email e SMS, telefonate, alla porta di casa, chat, acquisti, investimenti… Tocca una truffa per aprirla e leggere esempi e cosa fare. In fondo c’è cosa fare subito se sei stato truffato."
        }
      ],
      cta: {
        label: "Apri il Manuale Anti-Truffa",
        href: "/marketplace/antitruffa"
      }
    },
    {
      slug: "verifica-iban",
      category: "security",
      title: "Verifica IBAN",
      summary: "Controlla l’IBAN prima del bonifico: se è scritto correttamente, di che paese è e quali segnali tenere d’occhio.",
      minutes: 2,
      steps: [
        {
          title: "Incolla l’IBAN",
          text: "Incolla l’IBAN che ti hanno dato, con o senza spazi, e tocca «Controlla l’IBAN». Il controllo avviene tutto sul tuo telefono: l’IBAN non viene inviato né salvato."
        },
        {
          title: "Leggi il risultato",
          text: "Vedi se l’IBAN è scritto correttamente e di che paese è. Per gli IBAN italiani trovi anche le sue parti: CIN, ABI (la banca), CAB (la filiale) e numero di conto.",
          tip: "Se c’è un errore ti diciamo dove: per esempio un carattere che manca o due numeri invertiti."
        },
        {
          title: "Per cosa stai pagando?",
          text: "Scegli la risposta più vicina (un privato, una casa vacanze, un negozio online, un investimento…) e il tuo paese: ti mostriamo i segnali a cui fare attenzione."
        },
        {
          title: "Prima di fare il bonifico",
          text: "Ricorda: un IBAN valido non garantisce che il destinatario sia onesto. Leggi i consigli prima di pagare: un bonifico istantaneo non si può annullare."
        }
      ],
      cta: {
        label: "Apri Verifica IBAN",
        href: "/marketplace/verifica-iban"
      }
    },
    {
      slug: "checkmail",
      category: "security",
      title: "CheckMail",
      summary: "Hai ricevuto un’email sospetta? Caricala o copiala: controlliamo mittente, link, allegati e testo e ti diciamo quanto è rischiosa.",
      minutes: 3,
      steps: [
        {
          title: "Scegli come caricare l’email",
          text: "Ci sono tre modi: «Carica il file» (l’email salvata come .eml o .msg, il più completo), «Incolla il sorgente» oppure «Dal telefono». Per ognuno trovi le istruzioni per Gmail, Outlook e gli altri programmi."
        },
        {
          title: "Inserisci l’email e analizzala",
          text: "Dal telefono basta copiare mittente, oggetto e testo con i link, poi toccare «Analizza l’email».",
          tip: "Sotto il pulsante vedi quante analisi ti restano oggi."
        },
        {
          title: "Il livello di rischio",
          text: "Il risultato ti dice se il rischio è basso, medio o alto ed elenca cosa abbiamo trovato: mittente falso, link accorciati, fretta, richieste di dati…"
        },
        {
          title: "Cosa fare",
          text: "Segui i consigli: per esempio non cliccare, non aprire gli allegati e non rispondere. Con «Analizza un’altra email» ricominci.",
          tip: "CheckMail dà indizi, non certezze: nel dubbio contatta l’azienda dai suoi canali ufficiali."
        }
      ],
      cta: {
        label: "Apri CheckMail",
        href: "/marketplace/checkmail"
      }
    },
    {
      slug: "verifoto",
      category: "security",
      title: "VeriFoto",
      summary: "Controlla se una foto è vera o se è stata creata o ritoccata con l’intelligenza artificiale, prima di fidarti.",
      minutes: 2,
      steps: [
        {
          title: "Scegli la foto",
          text: "Tocca «Scegli una foto» e prendi l’immagine da controllare (JPG, PNG o WebP fino a 15 MB). I controlli di base avvengono sul tuo telefono."
        },
        {
          title: "Il rischio che sia AI o ritoccata",
          text: "Vedi un verdetto e una percentuale di rischio: 0–30% basso, 31–69% incerto, 70–100% alto. Sotto trovi gli indizi trovati, come certificati digitali e dati della fotocamera."
        },
        {
          title: "La mappa dei ritocchi",
          text: "Tocca «Mappa dei ritocchi»: le zone molto più chiare del resto possono indicare parti incollate o ritoccate. È un aiuto visivo, non una prova."
        },
        {
          title: "Secondo parere e foto originale",
          text: "Per un controllo in più usa il rilevatore AI: accetta l’invio di una copia ridotta della foto e tocca «Analizza con il rilevatore AI». Con Google Lens o TinEye cerchi se la stessa foto esiste già online.",
          tip: "VeriFoto dà indizi, non certezze: nel dubbio non fidarti."
        }
      ],
      cta: {
        label: "Apri VeriFoto",
        href: "/marketplace/verifoto"
      }
    },
    {
      slug: "documento-sicuro",
      category: "security",
      title: "Documento Sicuro",
      summary: "Prima di mandare la foto di un documento, aggiungi una scritta con scopo e data e copri i dati che non servono.",
      minutes: 3,
      steps: [
        {
          title: "Scegli la foto del documento",
          text: "Tocca «Scegli una foto» per prenderla dalla galleria oppure «Scatta una foto». La foto resta sul tuo telefono: non viene caricata né salvata."
        },
        {
          title: "Copri i dati che non servono",
          text: "Tocca «Copri una zona» e trascina il dito sulla foto per mettere un rettangolo nero su numero del documento, firma o foto, se non te li hanno chiesti.",
          tip: "Ti diciamo anche se la foto contiene dati nascosti, come la posizione GPS: nella copia scaricata non ci sono più."
        },
        {
          title: "Aggiungi la scritta di protezione",
          text: "Scegli per cosa la mandi (affitto, banca, lavoro, acquisto online…) e a chi: la scritta con scopo e data si ripete in diagonale su tutta la foto. Puoi cambiarne testo, visibilità, grandezza e colore.",
          tip: "Usa una scritta diversa per ogni persona: se la copia gira, saprai da dove è uscita."
        },
        {
          title: "Scarica o invia la copia",
          text: "Tocca «Scarica la copia protetta» oppure «Condividi»: ottieni una copia nuova con la scritta e le zone coperte, senza dati nascosti. L’originale non viene toccato."
        }
      ],
      cta: {
        label: "Apri Documento Sicuro",
        href: "/marketplace/documento-sicuro"
      }
    },
    {
      slug: "listings",
      category: "community",
      title: "Bacheca Annunci",
      summary: "Pubblica servizi e prodotti, cerca quello che ti serve e scrivi a chi ha pubblicato.",
      minutes: 3,
      steps: [
        {
          title: "Cerca un annuncio",
          text: "Scrivi cosa cerchi, scegli categoria, nazione e città e tocca «Cerca». Gli annunci in vetrina compaiono per primi."
        },
        {
          title: "Pubblica il tuo annuncio",
          text: "Tocca «Nuovo Annuncio»: pubblicarlo costa alcuni KU Karma, li vedi sul pulsante. Scrivi titolo, categoria e descrizione; prezzo e immagine sono facoltativi.",
          tip: "Se non hai abbastanza KU Karma, accedi ogni giorno per accumularli. Gli annunci valgono 30 giorni, poi puoi ripubblicarli con un clic."
        },
        {
          title: "Dove si trova",
          text: "Scegli nazione e città. Per servizi e consulenze spunta «Disponibile anche online / a distanza»: l’annuncio compare in tutte le città della nazione."
        },
        {
          title: "Vetrina (facoltativa)",
          text: "Puoi mettere subito in evidenza l’annuncio nella sezione In Vetrina con i KU Points, scegliendo per quanti giorni. Poi tocca «Pubblica Annuncio»."
        },
        {
          title: "I tuoi messaggi",
          text: "In «I miei messaggi» trovi le conversazioni con chi ti ha scritto per un annuncio o a cui hai scritto tu. Per la tua privacy i messaggi si cancellano da soli dopo 30 giorni."
        }
      ],
      cta: {
        label: "Apri la Bacheca Annunci",
        href: "/marketplace/listings"
      }
    },
    {
      slug: "timebank",
      category: "community",
      title: "KUMANI Time Bank",
      summary: "Aiuta qualcuno per un’ora e guadagni un’ora, da spendere quando una mano serve a te.",
      minutes: 3,
      steps: [
        {
          title: "1 ora = 1 ora",
          text: "Aiuti qualcuno per un’ora e guadagni un’ora, che spendi quando serve una mano a te. Le ore non valgono denaro e non si convertono in punti o sconti."
        },
        {
          title: "Verifica e partecipa",
          text: "Tocca «Verifica e partecipa»: servono iscrizione da almeno 30 giorni, profilo completo, maggiore età, identità verificata (codice fiscale o documento) e regole accettate. Poi crei il tuo profilo e ricevi le ore di benvenuto.",
          tip: "Puoi verificare l’identità e accettare le regole subito, anche se manca ancora qualche requisito."
        },
        {
          title: "Chiedi o offri aiuto",
          text: "Nella bacheca filtra richieste e offerte per categoria, in presenza o online e città. Pubblica con «Chiedi aiuto» o «Offri aiuto», oppure rispondi con «Mi propongo»: le ore passano da un saldo all’altro quando confermate entrambi."
        },
        {
          title: "Scambi sicuri",
          text: "La prima volta incontratevi in un luogo pubblico o online. Nessuno deve chiederti soldi, regali o dati bancari; niente consulenze professionali né lavori pericolosi. Se qualcosa non va, segnala: lo Staff interviene."
        }
      ],
      cta: {
        label: "Apri la Time Bank",
        href: "/marketplace/timebank"
      }
    },
    {
      slug: "convivio",
      category: "community",
      title: "Kordata",
      summary: "Acquisti di gruppo tra Kumani: insieme si compra meglio, direttamente dal produttore o dal negozio.",
      minutes: 3,
      steps: [
        {
          title: "Insieme si compra meglio",
          text: "Un Kumano propone un acquisto di gruppo da un produttore o un negozio e gli altri aderiscono: raggiunto il numero minimo l’ordine parte e ognuno paga direttamente il fornitore."
        },
        {
          title: "Aderisci a una Kordata",
          text: "In «Aperti» trovi le Kordate attive, divise per categoria (cibo e vino, tecnologia, viaggi ed eventi, casa ed energia…). Apri quella che ti interessa e tocca «Aderisco»: ti avvisiamo quando si raggiunge il minimo. In «I miei» ritrovi quelle a cui partecipi.",
          tip: "Dopo l’adesione vedi chi partecipa e puoi scrivere nella chat del gruppo."
        },
        {
          title: "Proponi una Kordata",
          text: "Tocca «Proponi una Kordata». Per proteggere chi aderisce serve diventare capocordata: abbonamento attivo da almeno 30 giorni, profilo completo, identità verificata e regole del capocordata accettate."
        },
        {
          title: "Come si paga",
          text: "KUMANI non gestisce i pagamenti: raggiunto il minimo, ognuno paga direttamente il fornitore seguendo le istruzioni del capocordata, che risponde di quanto propone."
        }
      ],
      cta: {
        label: "Apri Kordata",
        href: "/marketplace/convivio"
      }
    },
    {
      slug: "affinity",
      category: "community",
      title: "KUMANI Affinity",
      summary: "Un gioco di 20 domande per scoprire il tuo archetipo, sfidare un amico e conoscere persone in sintonia con te.",
      minutes: 3,
      steps: [
        {
          title: "Rispondi a 20 domande",
          text: "Tocca «Inizia il gioco» e rispondi a 20 domande veloci: non ci sono risposte giuste o sbagliate.",
          tip: "Salviamo solo la tua mappa (5 valori) e l’archetipo, mai le singole risposte. Puoi cancellarla quando vuoi."
        },
        {
          title: "Il tuo archetipo e la tua mappa",
          text: "Alla fine scopri il tuo archetipo KUMANI e la tua Mappa di Affinità su 5 valori: avventura, valori, ritmo, curiosità e calore. Puoi condividerla o rigiocare."
        },
        {
          title: "Gioca in Duo",
          text: "Tocca «Invia il link Duo» e mandalo a un amico o al partner: fa il gioco, anche senza iscriversi, e scoprite subito la vostra compatibilità."
        },
        {
          title: "Affinity Amicizie",
          text: "Ogni settimana Kumi ti presenta alcune persone in sintonia con te. Scegli le lingue che parli, aggiungi una frase su di te, dai il consenso e tocca «Attiva le presentazioni». La chat si apre solo se entrambi dite sì.",
          tip: "Partecipano solo persone abbonate e maggiorenni che hanno scelto di farlo. Puoi bloccare, segnalare o mettere in pausa quando vuoi."
        }
      ],
      cta: {
        label: "Apri Affinity",
        href: "/marketplace/affinity"
      }
    },
    {
      slug: "veritas",
      category: "community",
      title: "Veritas",
      summary: "Il gioco “Chi sta mentendo?” da 3 a 8 giocatori: gli amici possono giocare anche senza iscriversi.",
      minutes: 2,
      steps: [
        {
          title: "Crea una stanza",
          text: "Scrivi il tuo soprannome, scegli la lingua delle domande e il numero di turni e tocca «Crea la stanza». Invita gli amici con il link o il codice: si gioca da 3 a 8, anche senza iscriversi."
        },
        {
          title: "Entra con un codice",
          text: "Se un amico ha già creato una stanza, scrivi il suo codice e tocca «Entra nella stanza»."
        },
        {
          title: "Come si gioca",
          text: "A ogni turno arriva una domanda: tutti scrivono la verità, tranne uno che in segreto inventa. Leggete le risposte anonime e votate chi mente. Chi scopre il bugiardo prende 1 punto; il bugiardo prende 1 punto per ogni persona ingannata."
        }
      ],
      cta: {
        label: "Apri Veritas",
        href: "/marketplace/veritas"
      }
    },
  ],
}

export default content
