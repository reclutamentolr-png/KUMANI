import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Primi passi', text: 'Crea il tuo account, accedi e scopri la tua dashboard.' },
    promote: { title: 'Promuovere KUMANI', text: 'Invita chi conosci con il tuo link e usa i voucher.' },
    wallet: { title: 'Il Wallet', text: 'Tessera, punti, donazioni, badge e ricevute in un unico posto.' },
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
          text: 'Nel Wallet trovi le regole: ricevi KU Points quando una persona che hai invitato attiva l’abbonamento pagando con carta o passa a Pro, e con il Bonus Struttura.',
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
  ],
}

export default content
