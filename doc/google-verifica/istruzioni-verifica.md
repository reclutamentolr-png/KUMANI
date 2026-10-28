# Verifica di Google per «Collega Google Calendar»

Progetto Google Cloud: **KUMANI**, account **prokumani@gmail.com**.
File del logo: `doc/google-verifica/kumani-logo-120.png` (120×120 px).

Prima di iniziare, la nuova sezione 8 dell'informativa privacy («Google Calendar collegato») deve essere online su https://kumani.io/privacy#google-calendar. Google la controlla.

---

## Passo 1 – Dominio verificato (Search Console)

Google accetta la verifica solo se **kumani.io** risulta di tua proprietà in Search Console, con lo stesso account del progetto.

1. Apri https://search.google.com/search-console con **prokumani@gmail.com**.
2. Se **kumani.io** compare tra le proprietà, il dominio è già verificato e puoi passare al passo 2.
3. Se non compare: **Aggiungi proprietà → Dominio**, scrivi `kumani.io` e segui le istruzioni. Google ti dà un record TXT da aggiungere nel DNS del dominio, dove l'hai registrato. Dopo qualche minuto premi **Verifica**.

## Passo 2 – Branding

Pagina: https://console.cloud.google.com/auth/branding

- **Logo dell'applicazione:** carica `kumani-logo-120.png`.
- Controlla che siano già presenti:
  - Home page: `https://kumani.io`
  - Privacy: `https://kumani.io/privacy`
  - Termini: `https://kumani.io/terms`
  - Dominio autorizzato: `kumani.io`
- Premi **Salva**.

## Passo 3 – Accesso ai dati (il permesso)

Pagina: https://console.cloud.google.com/auth/scopes

1. Premi **Aggiungi o rimuovi ambiti**.
2. Nel filtro cerca `calendar.app.created` e spunta:
   `https://www.googleapis.com/auth/calendar.app.created`
   («Crea calendari secondari e visualizza, crea, modifica ed elimina eventi al loro interno»).
3. Spunta anche `openid` e `.../auth/userinfo.email`, se non ci sono già.
4. Premi **Aggiorna** e poi **Salva**.
5. Se Google mette `calendar.app.created` tra gli **ambiti sensibili**, compare un riquadro che chiede **come verrà utilizzato**. Incolla questo testo:

```
KUMANI (https://kumani.io) is a personal organizer for individuals, families and small businesses. Users keep their appointments, reminders, bills, deadlines, events and trips in KUMANI.

When a user clicks "Connect Google Calendar" on https://kumani.io/calendario-collegato, KUMANI uses the calendar.app.created scope to create one secondary calendar named "KUMANI" in the user's Google account and to create, update and delete events only inside that calendar, so the user's KUMANI plans appear in Google Calendar within seconds of being saved.

We chose calendar.app.created instead of broader calendar scopes because KUMANI never needs to read or change the user's other calendars. The email scope is used only to show the user which Google account is connected.

The refresh token is stored encrypted (AES-256-GCM) on our servers, is never shared with third parties and is never used for advertising or AI model training. Users can disconnect at any time: KUMANI deletes the "KUMANI" calendar, revokes the token and removes it from our database.
```

## Passo 4 – Il video

Google vuole un video caricato su **YouTube come «Non in elenco»**, in inglese o con le scritte in inglese, di 1–2 minuti. Registralo dal computer con lo schermo, ad esempio con la Xbox Game Bar di Windows (Win+G) oppure con OBS.

**Cosa deve vedersi, in ordine:**

1. **La home https://kumani.io**, per qualche secondo, con l'indirizzo visibile nella barra del browser.
2. **L'accesso a KUMANI** e l'apertura di **https://kumani.io/calendario-collegato**.
3. **Il pulsante «Collega Google Calendar»**: cliccalo.
4. **La finestra di Google:** sceglie l'account e mostra il nome «KUMANI» e il permesso richiesto. **È la parte più importante:** fermati 3–4 secondi sulla schermata del consenso, con la barra degli indirizzi visibile, poi premi **Continua** / **Consenti**.
5. **Il ritorno su KUMANI** con il messaggio «Fatto!» e «Collegato a …».
6. **L'inserimento di un appuntamento** in MemoLife → Calendario → «+ Aggiungi» → Appuntamento, poi salva.
7. **Google Calendar** (calendar.google.com): mostra il calendario «KUMANI» nella colonna di sinistra e l'appuntamento appena creato.
8. **Lo scollegamento:** torna su /calendario-collegato e premi **«Scollega»**. Poi mostra in Google Calendar che il calendario «KUMANI» è sparito.

**Consigli:**
- Imposta il sito in **inglese** (selettore della lingua), così testi e pulsanti sono già in inglese. Lo stesso per la lingua di Google, se puoi.
- Puoi aggiungere scritte in sovraimpressione, oppure parlare in inglese con frasi semplici, ad esempio: «Here the user connects Google Calendar», «KUMANI only creates its own calendar», «The appointment appears in Google Calendar», «The user can disconnect at any time».
- Su YouTube scegli la visibilità **«Non in elenco»**, non «Privato»: altrimenti Google non riesce a vederlo.

## Passo 5 – Invio

Prima dell'invio Google chiede di passare l'app da «Test» a **«In produzione»**: su https://console.cloud.google.com/auth/audience premi **Pubblica app**. Non c'è rischio, perché su KUMANI il pulsante resta visibile solo allo Staff finché non aggiungiamo `GOOGLE_CALENDAR_SYNC=on`.

Pagina: https://console.cloud.google.com/auth/verification

1. Premi **Prepara per la verifica** (o «Invia per la verifica»).
2. Controlla i dati riepilogati e incolla il **link del video YouTube**.
3. Nel campo delle note aggiuntive (se c'è) puoi incollare:

```
The feature is available after login on https://kumani.io/calendario-collegato and is shown in the video from start to finish. If reviewers need to try it themselves, we will gladly provide a KUMANI test account: please reply to this email. KUMANI only uses calendar.app.created, so it can access only the "KUMANI" calendar it creates.
```

4. Premi **Invia**.

Dopo l'invio, Google scrive a **prokumani@gmail.com**, di solito in qualche giorno, a volte in qualche settimana. Spesso chiede piccole correzioni. Quando arriva una risposta, incolla il messaggio a Claude.

## Dopo l'approvazione

- Su Vercel aggiungi `GOOGLE_CALENDAR_SYNC=on`: il pulsante compare a tutti gli iscritti.
- Il limite dei 7 giorni della modalità Test sparisce e quello dei 100 utenti non vale più.
- Poi si aggiunge la lettura dei calendari Google dentro KUMANI. Servirà un nuovo permesso e una piccola verifica aggiuntiva.
