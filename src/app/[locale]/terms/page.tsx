import Link from '@/components/LocalizedLink'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  Shield,
  Ticket,
  AlertTriangle,
  CheckCircle2,
  Scale,
  FileText
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Termini di Servizio e Regolamento Programma Vantaggi',
  description:
    'Termini di servizio della piattaforma Kumani e regolamento trasparente del Programma Vantaggi: punti, bonus, coupon e iniziative esclusive.'
}

const LAST_UPDATE = '27 settembre 2026'

export default function TermsPage() {
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
            Aggiornato al {LAST_UPDATE}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Titolo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Scale className="w-4 h-4" />
            Documento ufficiale
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Termini di Servizio e Regolamento Programma Vantaggi
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Questo documento descrive le regole di utilizzo della piattaforma Kumani e disciplina in modo trasparente
            il Programma Vantaggi: punti, bonus, coupon e iniziative esclusive.
          </p>
        </div>

        {/* Indice */}
        <nav className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-10">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Indice</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-indigo-700">
            <li><a href="#sez-1" className="hover:underline">1. Oggetto e ambito di applicazione</a></li>
            <li><a href="#sez-2" className="hover:underline">2. Registrazione e account</a></li>
            <li><a href="#sez-3" className="hover:underline">3. Abbonamento e corrispettivi</a></li>
            <li><a href="#sez-4" className="hover:underline">4. Servizi dell&apos;Ecosistema KUMANI</a></li>
            <li><a href="#sez-5" className="hover:underline">5. Bacheca annunci e contenuti degli utenti</a></li>
            <li><a href="#sez-6" className="hover:underline">6. Punti e classifica di attività</a></li>
            <li><a href="#sez-7" className="hover:underline">7. Regolamento Programma Vantaggi</a></li>
            <li><a href="#sez-8" className="hover:underline">8. Esclusione di compensi da reclutamento</a></li>
            <li><a href="#sez-9" className="hover:underline">9. Privacy e dati personali</a></li>
            <li><a href="#sez-10" className="hover:underline">10. Limitazioni di responsabilità</a></li>
            <li><a href="#sez-11" className="hover:underline">11. Modifiche, manutenzione e continuità</a></li>
            <li><a href="#sez-12" className="hover:underline">12. Recesso, sospensione e chiusura</a></li>
            <li><a href="#sez-13" className="hover:underline">13. Legge applicabile, foro e utilizzo fuori dall&apos;Italia</a></li>
            <li><a href="#sez-14" className="hover:underline">14. Contatti</a></li>
          </ol>
        </nav>

        <div className="space-y-8">
          {/* 1 */}
          <section id="sez-1" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Oggetto e ambito di applicazione</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                I presenti Termini di Servizio (di seguito, i &ldquo;Termini&rdquo;) disciplinano l&apos;accesso e l&apos;utilizzo della
                piattaforma Kumani (di seguito, &ldquo;Kumani&rdquo; o la &ldquo;Piattaforma&rdquo;),
                compresi l&apos;Ecosistema KUMANI (l&apos;insieme degli strumenti digitali offerti dalla Piattaforma, collegati tra loro), gli strumenti in esso inclusi e il Programma Vantaggi descritto all&apos;articolo 7.
              </p>
              <p>
                Registrandosi o utilizzando la Piattaforma, l&apos;utente accetta integralmente i presenti Termini.
                Se non si intende accettarli, anche in parte, è necessario non utilizzare i servizi.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section id="sez-2" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Registrazione e account</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                L&apos;accesso ai servizi riservati richiede la creazione di un account con dati reali, aggiornati e completi.
                È consentito un solo account per persona: la creazione di account multipli o falsi costituisce violazione grave dei Termini.
                Per continuare a usare la Piattaforma è necessario completare il profilo; una volta completato, i dati anagrafici
                (nome, cognome, data di nascita, recapiti e residenza, professione) possono essere modificati solo tramite richiesta
                motivata dal proprio profilo, esaminata dallo Staff, a tutela della sicurezza della community.
              </p>
              <p>
                L&apos;utente è responsabile della custodia delle proprie credenziali e di tutte le attività svolte con il proprio account.
                La Piattaforma può sospendere o chiudere account in caso di frode, abuso degli strumenti o violazione dei presenti Termini.
              </p>
            </div>
          </section>

          {/* 3 */}
          <section id="sez-3" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Abbonamento e corrispettivi</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                L&apos;accesso all&apos;Ecosistema KUMANI e ai suoi strumenti è offerto in abbonamento ai prezzi pubblicati sulla Piattaforma
                (attualmente piano Base 49€/anno e piano Pro 149€/anno). Il piano Pro include gli strumenti del piano Base; alcuni strumenti
                sono gratuiti per tutti gli iscritti. Il periodo di prova gratuito del piano Pro, quando offerto, dà accesso ai soli strumenti
                Pro e gratuiti e non si rinnova in automatico. Non sono previsti costi nascosti né corrispettivi ulteriori per le funzionalità incluse.
              </p>
              <p>
                I pagamenti sono gestiti da provider terzi autorizzati. L&apos;abbonamento si rinnova automaticamente salvo disdetta:
                l&apos;utente può annullare in qualsiasi momento e continuerà a usufruire dei servizi fino al termine del periodo già pagato.
              </p>
              <p>
                Alla scadenza del piano i contenuti restano salvati e consultabili dal titolare, ma non si possono creare o modificare
                contenuti degli strumenti non più inclusi. Le pagine pubbliche collegate (ad esempio Link in bio e CV) non sono più
                visibili ai visitatori finché il piano non viene rinnovato; le Ricevute Digitali, che sono condivise con un&apos;altra
                parte, restano consultabili online per 12 mesi dalla scadenza del piano.
              </p>
            </div>
          </section>

          {/* 4 */}
          <section id="sez-4" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Servizi dell&apos;Ecosistema KUMANI</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                La Piattaforma mette a disposizione strumenti digitali quali, a titolo esemplificativo: generatore di QR code dinamici,
                pagina Link in Bio, template di messaggistica, strumenti di organizzazione personale (MemoLife, Spendly, Life Calendar),
                strumenti per professionisti (piano Pro), strumenti di gruppo (Kordata, KUMANI Travel, KUMANI Events), bacheca annunci e ulteriori
                funzionalità che potranno essere aggiunte o aggiornate nel tempo. Gli strumenti dell&apos;Ecosistema possono scambiarsi
                dati dello stesso utente (ad esempio le scadenze mostrate in un&apos;unica agenda) solo per il funzionamento dei servizi.
              </p>
              <p>
                <strong className="text-gray-900">Eventi della community (KUMANI Events).</strong> Gli eventi sono organizzati dagli
                utenti verificati, che ne sono gli unici responsabili (svolgimento, sicurezza del luogo, autorizzazioni e obblighi fiscali).
                La Piattaforma fornisce gli strumenti (pubblicazione, iscrizioni, pass e check-in), approva i primi eventi di ogni
                organizzatore e può rimuovere eventi o sospendere organizzatori in caso di segnalazioni fondate. Sono vietati eventi a
                scopo politico o religioso proselitistico, gioco d&apos;azzardo e contenuti per adulti non dichiarati come 18+.
                Organizzatori e partecipanti accettano un codice di condotta basato su rispetto reciproco e assenza di molestie.
              </p>
              <p>
                Il prezzo eventualmente indicato dall&apos;organizzatore è dichiarato a titolo informativo e si paga direttamente
                all&apos;organizzatore: la Piattaforma non incassa somme per conto dei partecipanti. A evento concluso la Piattaforma
                applica all&apos;organizzatore una commissione di gestione pari alla percentuale pubblicata al momento della creazione
                dell&apos;evento, calcolata sul prezzo dichiarato per il numero di iscritti; finché la commissione non è pagata
                l&apos;organizzatore non può pubblicare nuovi eventi. Gli importi inferiori al minimo pagabile con carta si sommano ai
                successivi. I dati degli iscritti sono visibili solo all&apos;organizzatore e usati solo per la gestione dell&apos;evento.
                Dopo l&apos;evento i partecipanti possono lasciare una recensione (voto e commento, pubblicati con il solo nome):
                la media delle recensioni e lo storico degli eventi determinano il livello dell&apos;organizzatore, che può anche
                essere ridotto in caso di valutazioni basse o eventi rimossi dallo Staff. Quando l&apos;organizzatore usa il check-in,
                le assenze degli iscritti sono registrate e mostrate agli organizzatori dei loro eventi successivi.
              </p>
              <p>
                Un evento può ripetersi su più date (serie): ogni data è un evento a sé, con iscrizioni, check-in, recensioni e
                commissione propri. Se l&apos;organizzatore ha una Kumi Card attiva e lo indica nell&apos;evento, chi fa il check-in
                riceve in automatico un timbro sulla Kumi Card dell&apos;organizzatore, secondo le regole di quella tessera: la
                tessera viene creata e collegata all&apos;account del partecipante, che la ritrova nella scheda dell&apos;evento, e
                l&apos;organizzatore vede tra i clienti della sua Kumi Card il nome e l&apos;iniziale del cognome, i timbri e i premi
                ritirati. L&apos;informazione è indicata nella scheda dell&apos;evento prima dell&apos;iscrizione.
              </p>
              <p>
                <strong className="text-gray-900">Acquisti di gruppo (Kordata).</strong> Le Kordate sono proposte da utenti verificati
                (capocordata) e il pagamento avviene direttamente tra partecipanti e fornitore: la Piattaforma non incassa somme per
                conto terzi. Quando una Kordata con un fornitore professionista iscritto alla Piattaforma diventa &ldquo;ordinata&rdquo;,
                la Piattaforma applica al fornitore una commissione di gestione pari alla percentuale comunicata al momento della sua
                accettazione, calcolata sul prezzo di gruppo per le quantità prenotate; finché la commissione non è pagata il fornitore
                non può accettare nuove Kordate. Gli importi inferiori al minimo pagabile con carta si sommano ai successivi.
              </p>
              <p>
                <strong className="text-gray-900">Verifica dell&apos;identità.</strong> Per proporre Kordate od organizzare eventi è
                richiesta un&apos;identità verificata: tramite codice fiscale italiano oppure tramite un documento d&apos;identità
                (passaporto, carta d&apos;identità, patente o permesso di soggiorno) esaminato dallo Staff. L&apos;immagine del documento
                è conservata in un archivio privato, è visibile solo allo Staff incaricato e viene cancellata subito dopo la verifica:
                la Piattaforma conserva soltanto l&apos;esito (approvata o respinta), il tipo di documento e il paese di rilascio.
              </p>
              <p>
                I servizi sono forniti nello stato in cui si trovano e secondo disponibilità. La Piattaforma non costituisce proposta di
                investimento, opportunità di lavoro né promessa di guadagno: ogni risultato dipende dall&apos;utilizzo autonomo degli strumenti da parte dell&apos;utente.
              </p>
            </div>
          </section>

          {/* 5 */}
          <section id="sez-5" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Bacheca annunci e contenuti degli utenti</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                Gli utenti sono esclusivamente responsabili dei contenuti pubblicati (annunci, immagini, contatti e offerte).
                Sono vietati contenuti illeciti, ingannevoli, offensivi o che violino diritti di terzi.
              </p>
              <p>
                La Piattaforma svolge un ruolo di mera messa a disposizione degli spazi digitali: non è parte dei rapporti,
                degli accordi o delle transazioni che nascono tra gli utenti e può rimuovere contenuti non conformi senza preavviso.
              </p>
            </div>
          </section>

          {/* 6 */}
          <section id="sez-6" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Punti e classifica di attività</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                L&apos;utilizzo dei servizi (accessi giornalieri, strumenti utilizzati, annunci pubblicati) fa maturare punti attività.
                La classifica pubblica rappresenta il livello di attività sulla Piattaforma e non costituisce in alcun modo
                promessa di guadagno o diritto a corrispettivi in denaro.
              </p>
            </div>
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-800 text-sm leading-relaxed">
                <strong>Trasparenza:</strong> i punti si maturano esclusivamente utilizzando i servizi della Piattaforma.
                Nessun punto, bonus o vantaggio è riconosciuto per il semplice reclutamento o la semplice registrazione di altri utenti.
              </p>
            </div>
          </section>

          {/* 7 */}
          <section id="sez-7" className="bg-white rounded-2xl border-2 border-indigo-200 p-6 sm:p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">7. Regolamento Programma Vantaggi (Bonus e Coupon)</h2>
            </div>

            <div className="text-gray-600 space-y-4 text-sm sm:text-base leading-relaxed">
              <p>
                <strong className="text-gray-900">7.1 Natura del programma.</strong> Il Programma Vantaggi è un&apos;iniziativa di fidelizzazione
                riservata agli abbonati attivi. I vantaggi riconosciuti (bonus e coupon) costituiscono benefici di natura commerciale
                collegati all&apos;utilizzo dei servizi della Piattaforma. Il programma non configura concorso a premi, operazione a premio
                né manifestazione di sorte o abilità soggetta ad autorizzazione, rientrando nelle fattispecie escluse dalla normativa
                applicabile (incluso, per quanto pertinente, l&apos;art. 6 del D.P.R. 430/2001), in quanto i vantaggi sono collegati ai servizi
                offerti dalla Piattaforma stessa e non a mere operazioni di sorte.
              </p>
              <p>
                <strong className="text-gray-900">7.2 Tipologie di vantaggi.</strong> Il programma può riconoscere: (a) coupon di sconto
                utilizzabili nell&apos;Ecosistema KUMANI o con partner aderenti; (b) bonus punti; (c) periodi gratuiti di servizi premium;
                (d) accesso a iniziative esclusive riservate ai membri attivi.
              </p>
              <p>
                <strong className="text-gray-900">7.3 Iniziative esclusive.</strong> Periodicamente la Piattaforma potrà organizzare
                iniziative promozionali e riconoscimenti riservati ai membri attivi. Ogni iniziativa sarà annunciata con un proprio
                regolamento pubblico (durata, requisiti di partecipazione, natura dei vantaggi) consultabile prima dell&apos;adesione.
                La partecipazione è sempre volontaria e gratuita.
              </p>
              <p>
                <strong className="text-gray-900">7.4 Caratteristiche dei vantaggi.</strong> Bonus e coupon sono personali,
                non cedibili, non commerciabili e non convertibili in denaro. Non costituiscono moneta elettronica né valore
                accumulabile riscattabile in contanti.
              </p>
              <p>
                <strong className="text-gray-900">7.5 Scadenze.</strong> Ciascun bonus o coupon può riportare una data di scadenza,
                comunicata al momento dell&apos;attribuzione. Alla scadenza il vantaggio cessa automaticamente senza alcun diritto al rimborso o al recupero.
              </p>
              <p>
                <strong className="text-gray-900">7.6 Antifrode.</strong> In caso di utilizzo fraudolento (account multipli, automazioni,
                manipolazione dei punti o dei coupon), la Piattaforma potrà annullare punti e vantaggi maturati e sospendere o chiudere l&apos;account,
                fatti salvi ulteriori rimedi di legge.
              </p>
              <p>
                <strong className="text-gray-900">7.7 Modifiche al programma.</strong> La Piattaforma potrà modificare il Programma Vantaggi
                dandone comunicazione in questa pagina. I vantaggi già attribuiti restano validi alle condizioni comunicate al momento dell&apos;attribuzione.
              </p>
            </div>

            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm leading-relaxed">
                Nessun vantaggio del programma è condizionato al reclutamento di altri utenti né ai pagamenti effettuati da terzi:
                l&apos;unico criterio di maturazione è l&apos;utilizzo personale dei servizi.
              </p>
            </div>
          </section>

          {/* 8 */}
          <section id="sez-8" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Esclusione di compensi da reclutamento</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                La Piattaforma non riconosce commissioni, percentuali o compensi di alcun genere legati al reclutamento di nuovi membri
                o ai corrispettivi da questi versati. Le funzionalità di referral e organizzazione della community (codici invito, matrici,
                reti di contatti) hanno finalità esclusivamente organizzative e di condivisione dei contenuti, e non generano proventi
                derivanti dalla struttura della rete.
              </p>
              <p>
                Tale assetto esclude la configurabilità di schemi piramidali o vendite multilivello compensate sul reclutamento,
                ai sensi della normativa applicabile (incluso l&apos;art. 5 della L. 173/2005).
              </p>
            </div>
          </section>

          {/* 9 */}
          <section id="sez-9" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Privacy e dati personali</h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Il trattamento dei dati personali è disciplinato dall&apos;Informativa Privacy disponibile nella sezione{' '}
              <Link href="/privacy" className="text-indigo-600 font-semibold hover:underline">Privacy</Link>,
              in conformità al Regolamento (UE) 2016/679 (GDPR) e alla normativa nazionale applicabile.
            </p>
          </section>

          {/* 10 */}
          <section id="sez-10" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Limitazioni di responsabilità</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                La Piattaforma non è responsabile: dei contenuti pubblicati dagli utenti; degli accordi e delle transazioni tra utenti;
                di interruzioni del servizio dovute a cause di forza maggiore o a fornitori terzi; di danni indiretti conseguenti
                all&apos;utilizzo degli strumenti.
              </p>
              <p>
                Resta salva, in ogni caso, la responsabilità per dolo o colpa grave e quella inderogabile per legge a tutela dei consumatori.
              </p>
            </div>
          </section>

          {/* 11 */}
          <section id="sez-11" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Modifiche, manutenzione e continuità</h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              La Piattaforma potrà effettuare manutenzioni programmate, segnalate quando possibile tramite avviso (maintenance mode),
              e modificare funzionalità o presenti Termini per esigenze tecniche o normative. Le modifiche sostanziali saranno
              comunicate con ragionevole anticipo; la prosecuzione dell&apos;utilizzo dei servizi equivale ad accettazione.
            </p>
          </section>

          {/* 12 */}
          <section id="sez-12" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Recesso, sospensione e chiusura</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                L&apos;utente può recedere in qualsiasi momento cancellando il proprio account: punti, bonus e coupon non utilizzati
                decadono al momento della cancellazione, senza diritto a indennizzi.
              </p>
              <p>
                La Piattaforma potrà sospendere o chiudere gli account in violazione dei Termini, con conseguente decadenza dei vantaggi maturati.
              </p>
              <p>
                Durante la sospensione l&apos;accesso è bloccato e i contenuti pubblici dell&apos;account (annunci in Bacheca, presenza nelle
                classifiche e in Spotlight, Link in bio e CV) non sono visibili agli altri utenti; il codice d&apos;invito non può essere usato
                per nuove registrazioni. I contenuti non vengono cancellati e tornano visibili se la sospensione viene revocata.
              </p>
            </div>
          </section>

          {/* 13 */}
          <section id="sez-13" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">13. Legge applicabile, foro e utilizzo fuori dall&apos;Italia</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
            <p>
              I presenti Termini sono regolati dalla legge italiana. Per le controversie con utenti consumatori è competente
              il foro previsto inderogabilmente dalla legge; per gli altri utenti, il foro del luogo di stabilimento del gestore della Piattaforma.
              È fatta salva la possibilità di ricorrere a procedure di risoluzione alternativa delle controversie (ADR/ODR).
              Restano comunque applicabili le norme inderogabili a tutela dei consumatori del Paese di residenza dell&apos;utente.
            </p>
            <p>
              La Piattaforma nasce in Italia e alcune funzionalità sono progettate secondo la normativa italiana: la verifica
              dell&apos;identità tramite codice fiscale, i riferimenti fiscali di preventivi e ricevute digitali, il Programma
              Vantaggi (inquadrato secondo la disciplina italiana delle manifestazioni a premio), gli acquisti di gruppo (Kordata)
              e gli eventi con pagamento sul posto. Negli altri Paesi, dove vigono leggi diverse (ad esempio su tutela dei
              consumatori, promozioni a premi, eventi, fatturazione, strumenti legati al benessere e alla salute, età minima),
              alcune funzionalità potrebbero essere ridotte, modificate, richiedere verifiche diverse o non essere disponibili.
            </p>
            <p>
              L&apos;utente che utilizza la Piattaforma fuori dall&apos;Italia è tenuto a rispettare le norme del proprio Paese,
              in particolare quando vende beni o servizi (fornitori Kordata, organizzatori di eventi, professionisti) e per i
              relativi adempimenti fiscali. La Piattaforma può limitare l&apos;accesso a singole funzionalità in determinati Paesi
              quando ciò sia necessario per rispettare la normativa locale.
            </p>
            </div>
          </section>

          {/* 14 */}
          <section id="sez-14" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">14. Contatti</h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-4">
              Per qualsiasi domanda su questi Termini o sul Programma Vantaggi è possibile contattare il gestore della Piattaforma
              attraverso la pagina{' '}
              <Link href="/contact" className="text-indigo-600 font-semibold hover:underline">Contatti</Link>.
            </p>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
              <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <p className="text-indigo-800 text-sm leading-relaxed">
                Questo documento è pubblicato in ottica di massima trasparenza verso la community.
                Ti invitiamo a leggerlo con attenzione e a segnalarci qualsiasi punto poco chiaro.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-8 mt-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          © 2026 Kumani — Termini di Servizio e Regolamento Programma Vantaggi, aggiornati al {LAST_UPDATE}.
        </div>
      </footer>
    </div>
  )
}
