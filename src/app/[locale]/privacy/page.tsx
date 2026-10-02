import Link from '@/components/LocalizedLink'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ArrowLeft, Shield, Lock, AlertTriangle, FileText, Eye } from 'lucide-react'
import { CONTACT_INFO } from '@/lib/contactInfo'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Informativa Privacy',
    description:
      'Informativa sul trattamento dei dati personali degli utenti di Kumani ai sensi del Regolamento (UE) 2016/679 (GDPR).'
  }
}

const LAST_UPDATE = '27 settembre 2026'

// Segnaposto ben visibile per i dati che il titolare deve ancora completare.
function Todo({ children }: { children: ReactNode }) {
  return (
    <span className="bg-yellow-200 text-yellow-900 font-semibold px-1.5 py-0.5 rounded">
      [DA COMPLETARE: {children}]
    </span>
  )
}

// Mostra il valore di contactInfo oppure il segnaposto se non ancora compilato.
function Field({ value, todo }: { value: string | null; todo: string }) {
  return value ? <strong className="text-gray-900">{value}</strong> : <Todo>{todo}</Todo>
}

function PrivacyEmail() {
  const email = CONTACT_INFO.privacyEmail
  return email ? (
    <a href={`mailto:${email}`} className="text-indigo-600 font-semibold hover:underline">
      {email}
    </a>
  ) : (
    <Todo>email dedicata alla privacy</Todo>
  )
}

const SECTIONS = [
  'Titolare del trattamento',
  'Quali dati trattiamo',
  'Finalità e basi giuridiche',
  'Per quanto tempo conserviamo i dati',
  'Fornitori e trasferimenti fuori dall’UE',
  'Cosa vedono gli altri utenti',
  'Minori',
  'I tuoi diritti',
  'Cookie e tecnologie simili',
  'Sicurezza dei dati',
  'Modifiche all’informativa',
  'Contatti'
]

export default function PrivacyPage() {
  const { company } = CONTACT_INFO

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Torna alla home</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-100">
            <FileText className="w-3.5 h-3.5" />
            Aggiornata al {LAST_UPDATE}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Titolo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Lock className="w-4 h-4" />
            Protezione dei dati personali
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Informativa Privacy</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Come Kumani raccoglie, usa e protegge i tuoi dati personali, ai sensi degli articoli 13 e 14 del
            Regolamento (UE) 2016/679 (&ldquo;GDPR&rdquo;) e del D.Lgs. 196/2003 (Codice Privacy).
          </p>
        </div>

        {/* Avviso bozza */}
        <div className="mb-10 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-amber-900 text-sm sm:text-base leading-relaxed">
            <p className="font-bold mb-1">Bozza di base</p>
            <p>
              Bozza di base da far verificare a un consulente privacy prima della pubblicazione definitiva.
              Le parti evidenziate in giallo sono informazioni ancora da completare.
            </p>
          </div>
        </div>

        {/* Indice */}
        <nav className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-10">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Indice</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-indigo-700">
            {SECTIONS.map((title, i) => (
              <li key={title}>
                <a href={`#sez-${i + 1}`} className="hover:underline">
                  {i + 1}. {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-8">
          {/* 1 */}
          <section id="sez-1" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Titolare del trattamento</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>Il titolare del trattamento dei dati personali raccolti tramite la piattaforma Kumani è:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Ragione sociale: <Field value={company.name} todo="ragione sociale del titolare" /></li>
                <li>Sede legale: <Field value={company.address} todo="indirizzo della sede legale" /></li>
                <li>Partita IVA: <Field value={company.vatNumber} todo="partita IVA" /></li>
                <li>PEC: <Field value={company.pec} todo="indirizzo PEC" /></li>
                <li>Email per la privacy: <PrivacyEmail /></li>
              </ul>
              <p>
                Responsabile della protezione dei dati (DPO): <Todo>indicare se è stato nominato un DPO e i suoi recapiti, oppure eliminare questa riga</Todo>
              </p>
            </div>
          </section>

          {/* 2 */}
          <section id="sez-2" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Quali dati trattiamo</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                <strong className="text-gray-900">Account.</strong> Email e password. La password è gestita dal provider di
                autenticazione in forma cifrata: Kumani non la conosce e non può leggerla.
              </p>
              <p>
                <strong className="text-gray-900">Profilo.</strong> Nome, cognome, paese, città, professione o indicazione di
                attività professionale e, se li inserisci, data di nascita, telefono e indirizzo. Per chi usa Preventivi o altri
                strumenti professionali: i dati dell&apos;attività (ragione sociale, partita IVA, recapiti).
              </p>
              <p>
                <strong className="text-gray-900">Verifica dell&apos;identità (solo &ldquo;Kumano Verificato&rdquo;).</strong> Chi
                vuole proporre una Kordata od organizzare un evento verifica l&apos;identità in uno di due modi: con il codice fiscale
                italiano, che viene controllato e conservato in modo riservato (non è visibile agli altri utenti e serve anche a
                impedire account multipli), oppure caricando l&apos;immagine di un documento d&apos;identità. L&apos;immagine è salvata in
                un archivio privato, è esaminata solo dallo Staff incaricato ed è cancellata subito dopo la decisione: conserviamo
                soltanto l&apos;esito, il tipo di documento e il paese di rilascio.
              </p>
              <p>
                <strong className="text-gray-900">Pagamenti.</strong> Abbonamenti e commissioni sono pagati tramite Stripe. Kumani
                non riceve né conserva i dati della tua carta: registra solo lo stato dell&apos;abbonamento (piano, date di inizio e
                scadenza) e lo stato delle commissioni.
              </p>
              <p>
                <strong className="text-gray-900">Contenuti che crei negli strumenti.</strong> I dati che inserisci tu negli strumenti
                dell&apos;Ecosistema KUMANI, ad esempio: note e promemoria (MemoLife), entrate, spese e bollette (Spendly), scadenze e
                rinnovi (Life Calendar), oggetti e luoghi (Findo), ricevute digitali (con nome del destinatario ed eventuale foto),
                preventivi e anagrafica dei tuoi clienti, CV, menu, tessere fedeltà (Kumi Card), pagina Link in Bio, QR code e
                campagne con le relative statistiche di clic, annunci e messaggi della Bacheca, Kordate (adesioni, messaggi,
                recensioni, segnalazioni), viaggi di KUMANI Travel (partecipanti, attività, spese e checklist; dei documenti di
                viaggio solo il tipo e la data di scadenza, mai il numero o una copia), KUMANI Events (iscrizioni, pass, check-in,
                assenze registrate, recensioni e segnalazioni), risposte al test Affinity, mappa di affinità, amicizie e messaggi
                di Affinity Amicizie, partite di Veritas e risultati dei test di Aureya.
              </p>
              <p>
                <strong className="text-gray-900">Dati d&apos;uso.</strong> Punti attività, strumenti utilizzati, accessi giornalieri,
                coupon e premi, oltre ai log tecnici generati dai nostri fornitori (ad esempio indirizzo IP, data e ora delle
                richieste, tipo di browser) per sicurezza e diagnosi dei problemi. Per i QR code e le campagne registriamo anche
                la pagina di provenienza e il tipo di browser di chi li apre, senza identificarlo.
              </p>
              <p>
                <strong className="text-gray-900">Invito e sponsor.</strong> Il codice invito con cui ti sei registrato e il
                collegamento con l&apos;utente che ti ha invitato (e con chi inviti tu), usati per l&apos;organizzazione della community.
              </p>
              <p>
                <strong className="text-gray-900">Messaggi al supporto.</strong> Nome, email, argomento e testo dei messaggi che
                ci invii dal modulo di contatto o scrivendo a support@, privacy@ o info@kumani.io, e le nostre risposte.
              </p>
              <p>
                <strong className="text-gray-900">Dati di terzi inseriti dagli utenti.</strong> Alcuni strumenti permettono di
                inserire dati di altre persone (ad esempio i clienti di un preventivo o il destinatario di una ricevuta). Per questi
                dati l&apos;utente che li inserisce è responsabile di avere una base giuridica adeguata e di informare gli interessati;
                Kumani li tratta solo per fornire lo strumento. <Todo>far valutare al consulente il ruolo di Kumani (responsabile del trattamento) e l&apos;eventuale accordo ex art. 28 GDPR nei Termini</Todo>
              </p>
            </div>
          </section>

          {/* 3 */}
          <section id="sez-3" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Finalità e basi giuridiche</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-gray-900">Fornire il servizio</strong> (account, abbonamento, strumenti, punti, Programma
                  Vantaggi, Kordata, Travel, Events, assistenza). Base giuridica: esecuzione del contratto (art. 6.1.b GDPR).
                </li>
                <li>
                  <strong className="text-gray-900">Adempiere a obblighi di legge</strong> (fiscali, contabili, richieste delle
                  autorità). Base giuridica: obbligo legale (art. 6.1.c).
                </li>
                <li>
                  <strong className="text-gray-900">Sicurezza, antifrode e moderazione</strong> (verifica dell&apos;identità per chi
                  organizza Kordate ed eventi, un solo account per persona, gestione delle segnalazioni, rimozione di contenuti non
                  conformi, tutela dei nostri diritti). Base giuridica: legittimo interesse di Kumani e della community (art. 6.1.f);
                  per la verifica dell&apos;identità anche l&apos;esecuzione del contratto, perché è un requisito per usare quelle funzioni.
                </li>
                <li>
                  <strong className="text-gray-900">Kumano del Giorno in home page.</strong> La tua storia appare nella home
                  pubblica solo se dai il consenso, che puoi revocare in qualsiasi momento con un clic. Base giuridica: consenso
                  (art. 6.1.a).
                </li>
                <li>
                  <strong className="text-gray-900">Comunicazioni di servizio</strong> (messaggi dello Staff nell&apos;app, email di
                  verifica e recupero password). Base giuridica: esecuzione del contratto.
                </li>
                <li>
                  <strong className="text-gray-900">Marketing.</strong> Oggi Kumani non invia comunicazioni promozionali via email.
                  Se in futuro lo farà, chiederà prima il tuo consenso. <Todo>confermare o descrivere eventuali attività di marketing</Todo>
                </li>
              </ul>
              <p>
                Non adottiamo decisioni basate unicamente su trattamenti automatizzati che producono effetti giuridici su di te.
                I livelli e i controlli automatici (ad esempio i requisiti per organizzare eventi) possono sempre essere
                verificati dallo Staff su tua richiesta.
              </p>
            </div>
          </section>

          {/* 4 */}
          <section id="sez-4" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Per quanto tempo conserviamo i dati</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-gray-900">Account, profilo e contenuti degli strumenti:</strong> finché l&apos;account è
                  attivo. Puoi cancellare molti contenuti in autonomia dagli strumenti; con la cancellazione dell&apos;account (richiesta dal
                  profilo) i dati collegati vengono cancellati o resi anonimi in modo irreversibile, salvo quanto indicato sotto. <Todo>tempi di cancellazione dei backup del database</Todo>
                </li>
                <li>
                  <strong className="text-gray-900">Immagine del documento d&apos;identità:</strong> cancellata subito dopo la
                  decisione dello Staff; esito, tipo di documento e paese restano finché l&apos;account è attivo.
                </li>
                <li>
                  <strong className="text-gray-900">Codice fiscale:</strong> finché l&apos;account è attivo, per mantenere la verifica
                  e impedire account multipli.
                </li>
                <li>
                  <strong className="text-gray-900">Dati di pagamento e fatturazione:</strong> per il periodo previsto dalla legge
                  fiscale (di norma 10 anni).
                </li>
                <li>
                  <strong className="text-gray-900">Messaggi al supporto:</strong> <Todo>periodo di conservazione, es. 24 mesi dalla gestione</Todo>
                </li>
                <li>
                  <strong className="text-gray-900">Log tecnici e statistiche di clic:</strong> <Todo>periodo di conservazione dei log presso i fornitori</Todo>
                </li>
                <li>
                  <strong className="text-gray-900">Segnalazioni e provvedimenti di moderazione:</strong> per il tempo necessario a
                  gestirli e a tutelare la community. <Todo>periodo massimo</Todo>
                </li>
              </ul>
            </div>
          </section>

          {/* 5 */}
          <section id="sez-5" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Fornitori e trasferimenti fuori dall&apos;UE</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                I dati sono trattati dal personale autorizzato di Kumani e dai seguenti fornitori, nominati responsabili del
                trattamento (art. 28 GDPR), che li usano solo per erogare i loro servizi:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-gray-900">Supabase</strong> — database, archivio file e autenticazione (incluse le email di verifica e di recupero password).</li>
                <li><strong className="text-gray-900">Vercel</strong> — hosting ed esecuzione dell&apos;applicazione.</li>
                <li><strong className="text-gray-900">Stripe</strong> — pagamenti di abbonamenti e commissioni; tratta i dati della carta come titolare autonomo secondo la propria informativa.</li>
                <li>
                  <strong className="text-gray-900">Anthropic</strong> — funzioni di intelligenza artificiale di KUMANI Menu
                  (traduzioni), OfferMaker e CheckMail (lettura del testo delle email che chiedi di analizzare): riceve solo i
                  testi che invii a queste funzioni, non il tuo profilo, e non li usa per addestrare i suoi modelli.
                </li>
                <li>
                  <strong className="text-gray-900">Resend</strong> — invio delle email di KUMANI: codici di verifica e di recupero
                  password, conferme di pagamento, avvisi e le email che lo staff ti scrive da support@, privacy@ o info@kumani.io.
                </li>
                <li>
                  <strong className="text-gray-900">Cloudflare</strong> — gestione del dominio kumani.io e ricezione delle email
                  inviate ai nostri indirizzi @kumani.io, che inoltra alla casella di posta dello staff.
                </li>
                <li>
                  <strong className="text-gray-900">Google (Gmail)</strong> — casella di posta in cui lo staff legge le email che
                  invii ai nostri indirizzi @kumani.io e da cui ti risponde.
                </li>
                <li>
                  <strong className="text-gray-900">Careerjet</strong> — ricerca di offerte di lavoro in Trova Lavoro: riceve le
                  parole e il luogo che cerchi, insieme all&apos;indirizzo IP e al tipo di browser, come richiesto dal servizio; non
                  riceve il tuo nome né la tua email.
                </li>
              </ul>
              <p>
                Alcuni di questi fornitori hanno sede negli Stati Uniti o possono trattare dati fuori dallo Spazio Economico Europeo.
                In questi casi il trasferimento avviene sulla base della decisione di adeguatezza UE-USA (EU-U.S. Data Privacy
                Framework) per i fornitori certificati o delle Clausole Contrattuali Standard approvate dalla Commissione europea.{' '}
                <Todo>verificare la regione dei server Supabase e Vercel e le garanzie di ciascun fornitore</Todo>
              </p>
              <p>
                I dati possono inoltre essere comunicati alle autorità quando richiesto dalla legge. Kumani non vende i tuoi dati
                e non li cede a terzi per finalità di marketing.
              </p>
            </div>
          </section>

          {/* 6 */}
          <section id="sez-6" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Cosa vedono gli altri utenti</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  In <strong className="text-gray-900">Kordata, KUMANI Events e KUMANI Travel</strong> gli altri partecipanti vedono il
                  tuo nome; le recensioni sono pubblicate con il solo nome.
                </li>
                <li>
                  L&apos;<strong className="text-gray-900">organizzatore di un evento</strong> vede i nomi degli iscritti, i check-in e
                  le eventuali assenze registrate in precedenti eventi con check-in. L&apos;indirizzo esatto dell&apos;evento è mostrato solo agli
                  iscritti.
                </li>
                <li>
                  Le <strong className="text-gray-900">pagine che pubblichi</strong> (Link in Bio, menu, CV condiviso, annunci della
                  Bacheca, tessere fedeltà, ricevute inviate al destinatario) sono visibili a chi ne ha il link o, per gli annunci, agli
                  utenti della Bacheca, con i dati che scegli di inserirvi.
                </li>
                <li>
                  Il <strong className="text-gray-900">Kumano del Giorno</strong> mostra la storia che scrivi (nome, città,
                  professione, strumenti preferiti) nella sezione dedicata e, solo con il tuo consenso, anche in home page.
                </li>
                <li>
                  In <strong className="text-gray-900">Affinity</strong> chi apre il tuo link &ldquo;Gioca in Duo&rdquo; vede nome,
                  archetipo e mappa di affinità; i messaggi di Affinity Amicizie sono visibili solo a te e all&apos;altra persona.
                </li>
                <li>La <strong className="text-gray-900">classifica</strong> dei punti mostra il livello di attività degli utenti.</li>
                <li>Chi ti ha invitato vede che ti sei registrato con il suo codice.</li>
              </ul>
              <p>
                <strong className="text-gray-900">Accesso dello Staff.</strong> Il personale autorizzato di Kumani accede ai dati
                solo quando serve: per gestire segnalazioni e moderazione, verificare i documenti d&apos;identità, rispondere alle
                richieste di assistenza e risolvere problemi tecnici (anche accedendo temporaneamente all&apos;account per conto
                dell&apos;utente). Il codice fiscale non è mai mostrato agli altri utenti.
              </p>
            </div>
          </section>

          {/* 7 */}
          <section id="sez-7" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Minori</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                Il servizio non è rivolto ai minori di 14 anni e non raccogliamo consapevolmente i loro dati.{' '}
                <Todo>confermare l&apos;età minima di iscrizione e le regole per i minorenni (es. abbonamento a pagamento)</Todo>
              </p>
              <p>
                Affinity Amicizie e gli eventi indicati come 18+ sono riservati ai maggiorenni: l&apos;accesso è controllato tramite la
                data di nascita del profilo. Se ritieni che un minore ci abbia fornito dati, scrivici e li cancelleremo.
              </p>
            </div>
          </section>

          {/* 8 */}
          <section id="sez-8" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. I tuoi diritti</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>In qualsiasi momento puoi chiedere:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>l&apos;<strong className="text-gray-900">accesso</strong> ai tuoi dati e una copia degli stessi;</li>
                <li>la <strong className="text-gray-900">rettifica</strong> dei dati inesatti (molti li puoi modificare dal tuo profilo);</li>
                <li>
                  la <strong className="text-gray-900">cancellazione</strong> dei dati e dell&apos;account: puoi chiederla direttamente
                  dal tuo profilo (&ldquo;Elimina il mio account&rdquo;). La richiesta è completata dallo Staff entro 30 giorni e, finché è in
                  attesa, puoi annullarla. L&apos;eventuale abbonamento viene disdetto, i contenuti personali cancellati e il profilo
                  anonimizzato in modo irreversibile: resta solo un segnaposto anonimo nella rete degli inviti e i dati che la legge impone di
                  conservare (ad esempio i documenti contabili dei pagamenti);
                </li>
                <li>la <strong className="text-gray-900">limitazione</strong> del trattamento;</li>
                <li>la <strong className="text-gray-900">portabilità</strong> dei dati che ci hai fornito, in un formato leggibile;</li>
                <li>di <strong className="text-gray-900">opporti</strong> ai trattamenti basati sul legittimo interesse;</li>
                <li>di <strong className="text-gray-900">revocare il consenso</strong> dato (ad esempio per la home page), senza effetti sui trattamenti precedenti.</li>
              </ul>
              <p>
                Per esercitare i diritti scrivi a <PrivacyEmail /> oppure usa la pagina{' '}
                <Link href="/contact" className="text-indigo-600 font-semibold hover:underline">Contatti</Link>{' '}
                scegliendo l&apos;argomento &ldquo;Privacy&rdquo;. Rispondiamo entro un mese (prorogabile nei casi previsti dalla legge) e
                potremmo chiederti di confermare la tua identità.
              </p>
              <p>
                Hai anche il diritto di proporre reclamo al <strong className="text-gray-900">Garante per la protezione dei dati personali</strong>{' '}
                (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold hover:underline">www.garanteprivacy.it</a>)
                o all&apos;autorità del Paese UE in cui risiedi.
              </p>
            </div>
          </section>

          {/* 9 */}
          <section id="sez-9" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Cookie e tecnologie simili</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                Kumani usa <strong className="text-gray-900">solo cookie tecnici</strong>, necessari al funzionamento del servizio,
                per i quali non è richiesto il consenso:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>cookie di sessione e autenticazione, per mantenerti collegato in modo sicuro;</li>
                <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">NEXT_LOCALE</code>, per ricordare la lingua scelta (durata 1 anno);</li>
                <li>
                  cookie della Kumi Card, per ricordare su questo dispositivo le tessere fedeltà del cliente e, per il negozio,
                  la modalità cassa sbloccata con il PIN.
                </li>
              </ul>
              <p>
                Il browser memorizza inoltre alcune preferenze locali (ad esempio se hai chiuso l&apos;invito a installare l&apos;app).
                Non usiamo cookie di profilazione, strumenti di analisi statistica di terze parti né pixel pubblicitari.
                Se in futuro ne introdurremo, aggiorneremo questa informativa e chiederemo il consenso quando necessario.
              </p>
              <p>
                I pagamenti si svolgono sulle pagine di Stripe, che può usare propri cookie secondo la sua informativa.
              </p>
            </div>
          </section>

          {/* 10 */}
          <section id="sez-10" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">10. Sicurezza dei dati</h2>
            </div>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  Regole di accesso a livello di database (Row Level Security): ogni utente può leggere e modificare solo i propri
                  dati e quelli che altri hanno scelto di condividere con lui.
                </li>
                <li>Connessioni cifrate (HTTPS/TLS) tra il tuo dispositivo e i nostri server.</li>
                <li>Documenti d&apos;identità in un archivio privato, accessibile solo allo Staff incaricato e cancellati dopo la verifica.</li>
                <li>Accessi dello Staff limitati alle persone autorizzate e alle sole attività necessarie.</li>
                <li>Password mai conservate in chiaro; PIN della modalità cassa delle tessere fedeltà protetti con funzioni di hash.</li>
              </ul>
              <p>
                Nessun sistema è sicuro al 100%: in caso di violazione dei dati che comporti rischi per te, ti informeremo e
                informeremo il Garante nei casi e nei tempi previsti dalla legge.
              </p>
            </div>
          </section>

          {/* 11 */}
          <section id="sez-11" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Modifiche all&apos;informativa</h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Potremo aggiornare questa informativa quando cambiano i servizi o la normativa. La data dell&apos;ultimo aggiornamento è
              indicata in alto; le modifiche importanti saranno comunicate anche nell&apos;app. Per le regole generali di utilizzo
              consulta i{' '}
              <Link href="/terms" className="text-indigo-600 font-semibold hover:underline">Termini di Servizio</Link>.
            </p>
          </section>

          {/* 12 */}
          <section id="sez-12" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Contatti</h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-4">
              Per qualsiasi domanda su questa informativa o sul trattamento dei tuoi dati scrivi a <PrivacyEmail /> oppure usa la
              pagina <Link href="/contact" className="text-indigo-600 font-semibold hover:underline">Contatti</Link>.
            </p>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
              <Eye className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <p className="text-indigo-800 text-sm leading-relaxed">
                Vogliamo che tu sappia sempre quali dati usiamo e perché. Se qualcosa non è chiaro, scrivici: ti risponderemo
                in modo semplice.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-8 mt-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          © 2026 Kumani — Informativa Privacy, aggiornata al {LAST_UPDATE}.
        </div>
      </footer>
    </div>
  )
}
