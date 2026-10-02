import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Erste Schritte', text: 'Erstelle dein Konto, melde dich an und entdecke dein Dashboard.' },
    promote: { title: 'KUMANI empfehlen', text: 'Lade Bekannte mit deinem Link ein und nutze die Voucher.' },
    wallet: { title: 'Die Brieftasche', text: 'Karte, Punkte, Spenden, Abzeichen und Belege an einem Ort.' },
    promoteTools: { title: "Tools zum Empfehlen", text: "Die Anleitungen zu den Diensten, mit denen du KUMANI bekannt machst." },
    security: { title: "Sicherheit", text: "Die Anleitungen zu den Diensten, mit denen du Betrug erkennst und stoppst." },
    community: { title: "Community", text: "Die Anleitungen zu den Diensten, um sich zu treffen, sich zu helfen und zusammen zu spielen." },
    organize: { title: "Arbeit und Organisation", text: "Die Anleitungen zu den Diensten für Arbeit, Finanzen, Fristen und Kalender." },
    wellness: { title: "Wohlbefinden und Freizeit", text: "Die Anleitungen zu den Diensten zum Konzentrieren, Entspannen, Gestalten und Reisen." },
  },
  guides: [
    {
      slug: 'registrazione',
      category: 'start',
      title: 'So registrierst du dich',
      summary: 'Erstelle dein KUMANI-Konto in wenigen Minuten und aktiviere es mit dem Code, den du per E-Mail erhältst.',
      minutes: 3,
      steps: [
        {
          title: 'Öffne KUMANI und tippe auf „Jetzt starten“',
          text: 'Tippe auf der Startseite oben rechts auf den goldenen Button „Jetzt starten“. Hat dir jemand seinen Einladungslink geschickt, öffne ihn: Sein Code wird automatisch eingetragen.',
        },
        {
          title: 'Gib deine Daten ein',
          text: 'Trage Vorname, Nachname, E-Mail und ein Passwort mit mindestens 6 Zeichen ein und wähle dann dein Land und deine Stadt.',
          tip: 'Nutze eine E-Mail-Adresse, die du oft liest: Dort kommt der Code zur Aktivierung des Kontos an.',
        },
        {
          title: 'Einladungscode und Voucher (optional)',
          text: 'Hat dich ein Kumano eingeladen, gib seinen Einladungscode ein. Hast du einen KUMANI-Voucher erhalten, trage ihn im Feld „Aktivierungs-Vouchercode“ ein: Dein Abo wird sofort aktiviert. Hast du ein Geschäft, eine Praxis oder ein Unternehmen, setze das Häkchen bei „Ich bin selbstständig / Profi“. Tippe dann auf „Konto erstellen“.',
        },
        {
          title: 'Bestätige deine E-Mail',
          text: 'Wir schicken dir einen Code per E-Mail. Gib ihn im Feld „Bestätigungscode“ ein und tippe auf „Bestätigen und Konto aktivieren“. Fertig: Du bist dabei!',
          tip: 'Keine E-Mail gefunden? Schau im Spam-Ordner nach oder tippe auf „Code erneut senden“.',
        },
      ],
      cta: { label: 'Konto erstellen', href: '/register' },
    },
    {
      slug: 'accesso',
      category: 'start',
      title: 'So meldest du dich an',
      summary: 'Melde dich in deinem Konto an und setze dein Passwort zurück, falls du es vergessen hast.',
      minutes: 2,
      steps: [
        {
          title: 'E-Mail und Passwort eingeben',
          text: 'Tippe auf der Startseite auf „Anmelden“, gib die E-Mail und das Passwort ein, die du bei der Registrierung gewählt hast, und tippe auf „Anmelden“.',
        },
        {
          title: 'Passwort vergessen?',
          text: 'Tippe unter dem Anmelde-Button auf „Passwort vergessen?“.',
        },
        {
          title: 'Passwort zurücksetzen',
          text: 'Gib deine E-Mail ein und tippe auf „Passwort zurücksetzen“: Wir schicken dir einen Code, mit dem du ein neues wählst. Melde dich dann mit dem neuen Passwort an.',
          tip: 'Du kannst KUMANI zum Startbildschirm deines Handys hinzufügen: Es öffnet sich wie eine App.',
        },
      ],
      cta: { label: 'Zur Anmeldung', href: '/login' },
    },
    {
      slug: 'dashboard',
      category: 'start',
      title: 'Dein Dashboard',
      summary: 'Was du im Dashboard findest und wie du zu den Diensten kommst, die du am meisten nutzt.',
      minutes: 3,
      steps: [
        {
          title: 'Die obere Leiste',
          text: 'Oben änderst du die Sprache, öffnest dein Profil und die Brieftasche und meldest dich ab. Der Stern bringt dich zu deinen bevorzugten Diensten.',
        },
        {
          title: 'Die kostenlosen Dienste',
          text: 'In der Stufe „Kostenlos“ findest du die Dienste, die für alle Mitglieder ohne Zeitlimit enthalten sind. Tippe auf „Öffnen“, um sie zu nutzen, und auf das Sternchen, um sie zu deinen Favoriten hinzuzufügen.',
        },
        {
          title: 'Die drei Stufen der Dienste',
          text: 'Die Dienste sind in drei Stufen aufgeteilt: Kostenlos, Base und Pro. Mit einem Base- oder Pro-Abo schaltest du alle Dienste der Stufe frei; mit einem Pass kannst du auch einen einzelnen Dienst aktivieren.',
        },
        {
          title: 'Punkte, Abo und Einladungscode',
          text: 'Weiter unten siehst du die KU Karma, die du jeden Tag mit deinen Anmeldungen sammelst, den Status deines Abos (mit „Jetzt abonnieren“ oder „Per Gutschein aktivieren“) und deinen persönlichen Einladungscode.',
        },
        {
          title: 'Die Community und die anderen Seiten',
          text: 'Ganz unten findest du deine KUMANI-Community und die Schnelllinks zu den anderen Seiten: Community, Brieftasche und Pinnwand.',
        },
      ],
      cta: { label: 'Dashboard öffnen', href: '/dashboard' },
    },
    {
      slug: 'invito',
      category: 'promote',
      title: 'Mit deinem Link einladen',
      summary: 'Teile deinen Einladungscode oder -link und verfolge, wer deinem KUMANI-Stern beitritt.',
      minutes: 3,
      steps: [
        {
          title: 'Dein Einladungscode',
          text: 'Deinen persönlichen Einladungscode findest du im Dashboard. Tippe auf das Symbol daneben, um ihn zu kopieren: Wer sich mit deinem Link registriert, kommt in deinen KUMANI-Stern.',
        },
        {
          title: 'Teile den Link',
          text: 'Auf der Community-Seite ist dein Link fertig: Kopiere ihn, tippe auf „Per WhatsApp einladen“ oder „Teilen…“, um ihn mit Instagram, Telegram und den anderen Apps deines Handys zu senden.',
          tip: 'Eine persönliche Nachricht wirkt besser als eine Nachricht an alle: Erzähl, warum KUMANI für dich nützlich ist.',
        },
        {
          title: 'Dein KUMANI-Stern',
          text: 'Der Stern zeigt die 5 Personen, die du direkt eingeladen hast, und wie viele aktive Personen unter jeder Position sind. Wer sich registriert, aber noch kein Abo aktiviert hat, erscheint unter „Noch nicht KUMANI“.',
        },
        {
          title: 'So verdienst du KU Points',
          text: 'Die Regeln stehen in der Brieftasche: Du erhältst KU Points, wenn eine von dir eingeladene Person ein Abo mit Karte bezahlt oder zu Pro wechselt, und mit dem Willkommensbonus.',
        },
      ],
      cta: { label: 'Deine Community öffnen', href: '/dashboard/rete' },
    },
    {
      slug: 'voucher',
      category: 'promote',
      title: 'Voucher erstellen und nutzen',
      summary: 'Verwandle KU Points in Voucher zum Verschenken und aktiviere einen Voucher, den du erhalten hast.',
      minutes: 3,
      steps: [
        {
          title: 'Löse ein Punktepaket ein',
          text: 'Setze in der Brieftasche, im Voucher-Bereich, deine KU Points ein, um ein Paket einzulösen: Du erhältst ein Guthaben in Euro, um Voucher zu erstellen. Unter jedem Paket siehst du, wie viele Punkte dir noch fehlen.',
        },
        {
          title: 'Erstelle einen Voucher',
          text: 'Wähle mit dem Guthaben den Plan (Base oder Pro, ein Jahr) und ob der Voucher zum Verschenken oder zum Verkaufen ist, und tippe dann auf „Voucher erstellen“.',
        },
        {
          title: 'Einen Gutschein erhalten?',
          text: 'Gib den Code im Feld „Einen Gutschein erhalten?“ ein und tippe auf „Einlösen“: Dein Abo wird sofort aktiviert. Du kannst ihn auch bei der Registrierung eingeben.',
        },
      ],
      cta: { label: 'Zu den Vouchern', href: '/wallet' },
    },
    {
      slug: 'wallet',
      category: 'wallet',
      title: 'Die Brieftasche nutzen',
      summary: 'Deine Karte, Punkte, Spenden, Abzeichen und Belege: Das findest du in der Brieftasche.',
      minutes: 4,
      steps: [
        {
          title: 'Deine Membership-Karte',
          text: 'Oben ist deine KUMANI-Karte mit Mitgliedsnummer, aktivem Plan und Ablaufdatum. Den QR-Code kannst du mit „QR-Code herunterladen“ speichern.',
        },
        {
          title: 'Deine Punkte',
          text: 'Hier siehst du die KU Karma, die du jeden Tag mit Anmeldungen und der Nutzung der Tools verdienst, und die KU Points, die du erhältst, wenn eine eingeladene Person ein Abo aktiviert. Punkte sind kein Geld und nur innerhalb der Plattform nutzbar.',
        },
        {
          title: 'Spende deine KU Points',
          text: 'Im Bereich Spenden kannst du deine KU Points an den von KUMANI unterstützten Verein spenden: Je 10 gespendete Punkte = 1 €, den KUMANI an den Verein überweist.',
        },
        {
          title: 'Die Abzeichen',
          text: 'Die Abzeichen Kuman Green, Kuman Star und Kuman Black werden mit der Gesamtzahl der verdienten KU Points freigeschaltet. Der Balken zeigt dir, wie viele Punkte bis zum nächsten fehlen.',
        },
        {
          title: 'Belege, Coupons und Rabatt auf die Verlängerung',
          text: 'Weiter unten findest du die Digitalen Quittungen (Pro-Plan), die im Ökosystem erhaltenen Coupons und den Rabatt auf die Abo-Verlängerung, den du mit KU Karma bekommen kannst.',
        },
      ],
      cta: { label: 'Brieftasche öffnen', href: '/wallet' },
    },
    {
      slug: "qr-generator",
      category: "promoteTools",
      title: "Dynamischer QR-Code",
      summary: "Erstelle den QR-Code deines Einladungslinks, wähle die Farben und lade ihn zum Drucken oder Teilen herunter.",
      minutes: 2,
      steps: [
        {
          title: "Dein Link ist schon drin",
          text: "Der QR-Code führt zu deinem persönlichen Einladungslink. Der „Ziel-Link“ ist gesperrt: So kommt jeder, der ihn scannt, immer in deinen KUMANI-Stern."
        },
        {
          title: "Wähle die Farben",
          text: "Ändere die „QR-Code-Farbe“ und die „Hintergrundfarbe“ oder tippe auf eines der „Schnelldesigns“.",
          tip: "Achte auf guten Kontrast zwischen QR-Code und Hintergrund: Ein zu heller QR-Code ist schlecht lesbar."
        },
        {
          title: "Lade den QR-Code herunter",
          text: "Prüfe die Vorschau und tippe auf „PNG herunterladen“: Das Bild hat eine hohe Auflösung und eignet sich auch zum Drucken."
        },
        {
          title: "Wo du ihn nutzt",
          text: "Druck ihn auf Visitenkarten und Flyer, teile ihn in sozialen Netzwerken oder füge ihn deiner E-Mail-Signatur hinzu."
        }
      ],
      cta: {
        label: "Dynamischen QR-Code öffnen",
        href: "/marketplace/qr-generator"
      }
    },
    {
      slug: "whatsapp-messages",
      category: "promoteTools",
      title: "WhatsApp-Nachrichten",
      summary: "Fertige Nachrichten mit deinem Einladungslink: Wähle den passenden Ton und sende sie in Sekunden.",
      minutes: 2,
      steps: [
        {
          title: "Wähle die Nachricht",
          text: "Es gibt 4 Nachrichten für verschiedene Situationen: locker, förmlich, emotional und nach einem Treffen. Dein Einladungslink steht schon im Text."
        },
        {
          title: "Kopieren oder senden",
          text: "Tippe auf „Auf WhatsApp senden“, um WhatsApp mit der fertigen Nachricht zu öffnen, und wähle den Empfänger. Oder tippe auf „Nachricht kopieren“ und füge sie ein, wo du willst, auch in einer anderen App.",
          tip: "In WhatsApp kannst du den Text vor dem Senden ändern: Füge den Namen der Person hinzu."
        },
        {
          title: "Tipps für wirksame Nachrichten",
          text: "Personalisiere die Nachricht immer, schick sie nicht an zu viele Leute gleichzeitig und melde dich danach mit einem Anruf oder einer Sprachnachricht."
        }
      ],
      cta: {
        label: "WhatsApp-Nachrichten öffnen",
        href: "/marketplace/whatsapp-messages"
      }
    },
    {
      slug: "link-in-bio",
      category: "promoteTools",
      title: "Link in Bio",
      summary: "Erstelle deine persönliche Seite mit deinen Links für die Bio von Instagram, TikTok und anderen sozialen Netzwerken.",
      minutes: 3,
      steps: [
        {
          title: "Schreib deine Bio",
          text: "Schreib im Feld „Bio-Text“ einen Satz über dich: Er erscheint unter deinem Namen."
        },
        {
          title: "Farbe und Spezialthemen",
          text: "Wähle die Farbe der Seite. Die Spezialthemen (Polarlicht, Mond über dem See, Savanne im Sonnenuntergang) siehst du in der Vorschau, wenn du sie antippst: KU Karma werden nur verwendet, wenn du sie freischalten willst."
        },
        {
          title: "Links hinzufügen und speichern",
          text: "Tippe auf „Link hinzufügen“, um deine Links (Website, soziale Netzwerke, Shop…) einzutragen: Dein KUMANI-Einladungslink ist immer dabei. Tippe dann auf „Seite speichern“.",
          tip: "Weiter unten siehst du eine Vorschau der Seite."
        },
        {
          title: "Teile deine Seite",
          text: "Kopiere den Link der Seite und setze ihn in die Bio deiner sozialen Netzwerke, oder tippe auf „Besuche deine Link in Bio“, um sie anzusehen. Denk daran, vor dem Teilen zu speichern."
        }
      ],
      cta: {
        label: "Link in Bio öffnen",
        href: "/marketplace/link-in-bio"
      }
    },
    {
      slug: "spotlight",
      category: "promoteTools",
      title: "Kumano des Tages",
      summary: "Erzähl deine Geschichte und komm ins Schaufenster der Community: Jeden Tag wird ein Kumano vorgestellt. Nur für aktive Abonnenten.",
      minutes: 3,
      steps: [
        {
          title: "Erzähl deine Geschichte",
          text: "Gib Vorname oder Spitzname (nie den Nachnamen), Stadt, Land, Beruf oder Leidenschaft und eine kurze Geschichte ein, die man in 20 Sekunden liest."
        },
        {
          title: "Wähle deine Lieblingstools",
          text: "Tippe auf die KUMANI-Tools, die du am meisten nutzt: Sie erscheinen zusammen mit deiner Geschichte."
        },
        {
          title: "Einwilligungen und Absenden",
          text: "Setze das Häkchen bei der Einwilligung, der Community gezeigt zu werden (die für die Startseite ist freiwillig), und tippe auf „Speichern und ins Schaufenster“. Das KUMANI-Team gibt die Geschichte frei, danach kommt sie in die Rotation des Kumano des Tages.",
          tip: "Du kannst deine Geschichte jederzeit von dieser Seite aus aus dem Schaufenster oder von der Startseite entfernen."
        }
      ],
      cta: {
        label: "Erzähl deine Geschichte",
        href: "/marketplace/spotlight"
      }
    },
    {
      slug: "events",
      category: "promoteTools",
      title: "KUMANI Events",
      summary: "Finde Treffen, Workshops und Abende der Community, melde dich mit einem Tipp an und komm mit deinem Pass hinein.",
      minutes: 3,
      steps: [
        {
          title: "Finde ein Event",
          text: "Suche nach Stadt, Land, Sprache und Datum oder tippe auf „Nur online“ für Online-Events."
        },
        {
          title: "Anmelden und Pass erhalten",
          text: "Öffne das Event und tippe auf „Teilnehmen“: Du erhältst sofort deinen Pass mit QR-Code, den du unter „Meine Pässe“ findest. Zeig ihn am Eingang: Der Organisator scannt ihn und du bist drin.",
          tip: "Ist das Event voll, kannst du dich auf die Warteliste setzen: Wird ein Platz frei, bist du automatisch dabei."
        },
        {
          title: "Organisiere ein Event",
          text: "Du willst selbst ein Treffen in deiner Stadt oder online organisieren? Tippe auf „Event organisieren“."
        },
        {
          title: "Werde verifizierter Organisator",
          text: "Um Events zu organisieren, musst du ein Verifizierter Kumano sein: Tippe auf „Werde verifizierter Organisator“ und folge den Schritten. Unter „Meine Events“ verwaltest du dann Teilnehmer und Check-in."
        }
      ],
      cta: {
        label: "KUMANI Events öffnen",
        href: "/events"
      }
    },
    {
      slug: "antitruffa",
      category: "security",
      title: "Anti-Betrugs-Handbuch",
      summary: "Die häufigsten Betrugsmaschen mit echten Beispielen und was sofort zu tun ist: lies es, speichere es und teile es mit den Menschen, die du liebst.",
      minutes: 2,
      steps: [
        {
          title: "Herunterladen oder drucken",
          text: "Tippe oben auf „Handbuch herunterladen oder drucken“: Das Druckfenster von Handy oder Computer öffnet sich, dort kannst du es auch als PDF speichern."
        },
        {
          title: "Teile es mit den Menschen, die du liebst",
          text: "Schick es an Eltern, Großeltern und Freunde per WhatsApp, Facebook, Telegram, X, LinkedIn oder E-Mail, oder kopiere den Link. Wer sich über deinen Link registriert, kommt in dein Netzwerk."
        },
        {
          title: "Der 10-Sekunden-Test",
          text: "Bevor du klickst, antwortest oder bezahlst, stell dir die 6 Fragen des Tests: Ist auch nur eine Antwort „ja“, ist es fast sicher Betrug.",
          tip: "Direkt darunter stehen die 6 goldenen Regeln: Sie reichen schon, um die meisten Betrugsmaschen zu vermeiden."
        },
        {
          title: "Wähle ein Kapitel",
          text: "Geh über das Inhaltsverzeichnis zum Kapitel, das du brauchst: E-Mails und SMS, Anrufe, an der Haustür, Chats, Einkäufe, Geldanlagen… Tippe auf eine Masche, um sie zu öffnen und Beispiele und Tipps zu lesen. Am Ende steht, was du sofort tun solltest, wenn du betrogen wurdest."
        }
      ],
      cta: {
        label: "Anti-Betrugs-Handbuch öffnen",
        href: "/marketplace/antitruffa"
      }
    },
    {
      slug: "verifica-iban",
      category: "security",
      title: "IBAN-Prüfung",
      summary: "Prüfe die IBAN vor einer Überweisung: ob sie richtig geschrieben ist, aus welchem Land sie stammt und auf welche Warnzeichen du achten solltest.",
      minutes: 2,
      steps: [
        {
          title: "IBAN einfügen",
          text: "Füge die IBAN ein, die du bekommen hast, mit oder ohne Leerzeichen, und tippe auf „IBAN prüfen“. Alles passiert auf deinem Handy: Die IBAN wird weder gesendet noch gespeichert."
        },
        {
          title: "Ergebnis lesen",
          text: "Du siehst, ob die IBAN richtig geschrieben ist und aus welchem Land sie stammt. Bei italienischen IBANs siehst du auch ihre Teile: CIN, ABI (die Bank), CAB (die Filiale) und Kontonummer.",
          tip: "Gibt es einen Fehler, sagen wir dir, wo: zum Beispiel ein fehlendes Zeichen oder zwei vertauschte Ziffern."
        },
        {
          title: "Wofür bezahlst du?",
          text: "Wähle die passendste Antwort (ein Privatverkäufer, eine Ferienwohnung, ein Onlineshop, eine Geldanlage…) und dein Land: Wir zeigen dir die Warnzeichen, auf die du achten solltest."
        },
        {
          title: "Vor der Überweisung",
          text: "Denk daran: Eine gültige IBAN garantiert nicht, dass der Empfänger ehrlich ist. Lies die Tipps vor dem Bezahlen: Eine Echtzeitüberweisung lässt sich nicht zurückholen."
        }
      ],
      cta: {
        label: "IBAN-Prüfung öffnen",
        href: "/marketplace/verifica-iban"
      }
    },
    {
      slug: "checkmail",
      category: "security",
      title: "CheckMail",
      summary: "Eine verdächtige E-Mail bekommen? Lade sie hoch oder kopiere sie: Wir prüfen Absender, Links, Anhänge und Text und sagen dir, wie riskant sie ist.",
      minutes: 3,
      steps: [
        {
          title: "Wähle, wie du die E-Mail lädst",
          text: "Es gibt drei Wege: „Datei hochladen“ (die als .eml oder .msg gespeicherte E-Mail, am vollständigsten), „Quelltext einfügen“ oder „Vom Handy“. Zu jedem gibt es eine Anleitung für Gmail, Outlook und andere Programme."
        },
        {
          title: "E-Mail eingeben und prüfen",
          text: "Vom Handy aus reicht es, Absender, Betreff und Text mit den Links zu kopieren und dann auf „E-Mail prüfen“ zu tippen.",
          tip: "Unter dem Button siehst du, wie viele Prüfungen dir heute noch bleiben."
        },
        {
          title: "Die Risikostufe",
          text: "Das Ergebnis sagt dir, ob das Risiko niedrig, mittel oder hoch ist, und listet auf, was wir gefunden haben: falscher Absender, gekürzte Links, Zeitdruck, Abfrage von Daten…"
        },
        {
          title: "Was tun",
          text: "Folge den Tipps: zum Beispiel nicht klicken, keine Anhänge öffnen und nicht antworten. Mit „Eine andere E-Mail prüfen“ fängst du neu an.",
          tip: "CheckMail liefert Hinweise, keine Gewissheiten: Im Zweifel kontaktiere das Unternehmen über seine offiziellen Kanäle."
        }
      ],
      cta: {
        label: "CheckMail öffnen",
        href: "/marketplace/checkmail"
      }
    },
    {
      slug: "verifoto",
      category: "security",
      title: "VeriFoto",
      summary: "Prüfe, ob ein Foto echt ist oder mit künstlicher Intelligenz erstellt oder bearbeitet wurde, bevor du ihm vertraust.",
      minutes: 2,
      steps: [
        {
          title: "Foto auswählen",
          text: "Tippe auf „Foto auswählen“ und wähle das Bild, das du prüfen willst (JPG, PNG oder WebP bis 15 MB). Die Grundprüfungen laufen auf deinem Handy."
        },
        {
          title: "Das Risiko, dass es KI oder bearbeitet ist",
          text: "Du siehst eine Einschätzung und einen Risikowert: 0–30 % niedrig, 31–69 % unsicher, 70–100 % hoch. Darunter stehen die gefundenen Hinweise, etwa digitale Zertifikate und Kameradaten."
        },
        {
          title: "Die Retusche-Karte",
          text: "Tippe auf „Retusche-Karte“: Bereiche, die viel heller sind als der Rest, können auf eingefügte oder bearbeitete Teile hinweisen. Das ist eine Sehhilfe, kein Beweis."
        },
        {
          title: "Zweite Meinung und Originalfoto",
          text: "Für eine zusätzliche Prüfung nutze den KI-Detektor: Stimme dem Senden einer verkleinerten Kopie zu und tippe auf „Mit dem KI-Detektor analysieren“. Mit Google Lens oder TinEye suchst du, ob es dasselbe Foto schon online gibt.",
          tip: "VeriFoto liefert Hinweise, keine Gewissheiten: Im Zweifel lieber nicht vertrauen."
        }
      ],
      cta: {
        label: "VeriFoto öffnen",
        href: "/marketplace/verifoto"
      }
    },
    {
      slug: "documento-sicuro",
      category: "security",
      title: "Sicheres Dokument",
      summary: "Bevor du das Foto eines Ausweises verschickst, füge einen Vermerk mit Zweck und Datum hinzu und decke die Daten ab, die nicht nötig sind.",
      minutes: 3,
      steps: [
        {
          title: "Foto des Dokuments wählen",
          text: "Tippe auf „Foto auswählen“, um es aus der Galerie zu nehmen, oder auf „Foto aufnehmen“. Das Foto bleibt auf deinem Handy: Es wird weder hochgeladen noch gespeichert."
        },
        {
          title: "Nicht benötigte Daten abdecken",
          text: "Tippe auf „Bereich abdecken“ und zieh den Finger über das Foto, um ein schwarzes Rechteck über Ausweisnummer, Unterschrift oder Foto zu legen, wenn sie nicht verlangt wurden.",
          tip: "Wir sagen dir auch, ob das Foto versteckte Daten wie den GPS-Standort enthält: In der heruntergeladenen Kopie sind sie weg."
        },
        {
          title: "Schutzvermerk hinzufügen",
          text: "Wähle, wofür du es schickst (Miete, Bank, Arbeit, Onlinekauf…) und an wen: Der Vermerk mit Zweck und Datum wiederholt sich diagonal über das ganze Foto. Du kannst Text, Sichtbarkeit, Größe und Farbe ändern.",
          tip: "Nutze für jede Person einen anderen Vermerk: Wenn die Kopie weitergegeben wird, weißt du, woher sie stammt."
        },
        {
          title: "Kopie herunterladen oder senden",
          text: "Tippe auf „Geschützte Kopie herunterladen“ oder „Teilen“: Du bekommst eine neue Kopie mit Vermerk und abgedeckten Bereichen, ohne versteckte Daten. Das Original bleibt unverändert."
        }
      ],
      cta: {
        label: "Sicheres Dokument öffnen",
        href: "/marketplace/documento-sicuro"
      }
    },
    {
      slug: "listings",
      category: "community",
      title: "Community-Anzeigen",
      summary: "Biete Dienstleistungen und Produkte an, finde, was du brauchst, und schreib dem Anbieter.",
      minutes: 3,
      steps: [
        {
          title: "Anzeige suchen",
          text: "Gib ein, was du suchst, wähle Kategorie, Land und Stadt und tippe auf „Suchen“. Hervorgehobene Anzeigen erscheinen zuerst."
        },
        {
          title: "Eigene Anzeige veröffentlichen",
          text: "Tippe auf „Neue Anzeige“: Das Veröffentlichen kostet einige KU Karma, du siehst sie auf dem Button. Gib Titel, Kategorie und Beschreibung ein; Preis und Bild sind optional.",
          tip: "Hast du nicht genug KU Karma, melde dich jeden Tag an, um welche zu sammeln. Anzeigen gelten 30 Tage, danach kannst du sie mit einem Klick erneut veröffentlichen."
        },
        {
          title: "Wo es ist",
          text: "Wähle Land und Stadt. Bei Dienstleistungen und Beratung setze das Häkchen bei „Auch online / aus der Ferne verfügbar“: Die Anzeige erscheint in allen Städten des Landes."
        },
        {
          title: "Schaufenster (optional)",
          text: "Du kannst die Anzeige sofort im Bereich Im Schaufenster mit KU Points hervorheben und wählen, für wie viele Tage. Tippe dann auf „Anzeige veröffentlichen“."
        },
        {
          title: "Deine Nachrichten",
          text: "Unter „Meine Nachrichten“ findest du die Unterhaltungen mit Leuten, die dir wegen einer Anzeige geschrieben haben oder denen du geschrieben hast. Zum Schutz deiner Privatsphäre werden Nachrichten nach 30 Tagen automatisch gelöscht."
        }
      ],
      cta: {
        label: "Community-Anzeigen öffnen",
        href: "/marketplace/listings"
      }
    },
    {
      slug: "timebank",
      category: "community",
      title: "KUMANI Time Bank",
      summary: "Hilf jemandem eine Stunde lang und verdiene eine Stunde, die du einlöst, wenn du Hilfe brauchst.",
      minutes: 3,
      steps: [
        {
          title: "1 Stunde = 1 Stunde",
          text: "Du hilfst jemandem eine Stunde lang und verdienst eine Stunde, die du nutzt, wenn du selbst Hilfe brauchst. Stunden sind kein Geld und lassen sich nicht in Punkte oder Rabatte umwandeln."
        },
        {
          title: "Verifizieren und teilnehmen",
          text: "Tippe auf „Verifizieren und teilnehmen“: Du musst seit mindestens 30 Tagen Mitglied sein, ein vollständiges Profil haben, volljährig sein, eine verifizierte Identität (Steuernummer oder Ausweis) haben und die Regeln akzeptieren. Dann erstellst du dein Profil und erhältst Willkommensstunden.",
          tip: "Du kannst deine Identität schon jetzt verifizieren und die Regeln akzeptieren, auch wenn noch eine Voraussetzung fehlt."
        },
        {
          title: "Um Hilfe bitten oder Hilfe anbieten",
          text: "Filtere auf der Pinnwand Anfragen und Angebote nach Kategorie, vor Ort oder online, und Stadt. Veröffentliche mit „Um Hilfe bitten“ oder „Hilfe anbieten“, oder antworte mit „Ich helfe“: Die Stunden wandern von einem Konto zum anderen, wenn ihr beide bestätigt."
        },
        {
          title: "Sicherer Austausch",
          text: "Trefft euch beim ersten Mal an einem öffentlichen Ort oder online. Niemand darf dich um Geld, Geschenke oder Bankdaten bitten; keine professionelle Beratung und keine gefährlichen Arbeiten. Stimmt etwas nicht, melde es: Das Team greift ein."
        }
      ],
      cta: {
        label: "Time Bank öffnen",
        href: "/marketplace/timebank"
      }
    },
    {
      slug: "convivio",
      category: "community",
      title: "Kordata",
      summary: "Sammelbestellungen unter Kumani: Gemeinsam kauft man besser, direkt beim Erzeuger oder im Laden.",
      minutes: 3,
      steps: [
        {
          title: "Gemeinsam kauft man besser",
          text: "Ein Kumano schlägt eine Sammelbestellung bei einem Erzeuger oder Laden vor und die anderen machen mit: Ist die Mindestzahl erreicht, geht die Bestellung los und jeder bezahlt den Lieferanten direkt."
        },
        {
          title: "Bei einer Kordata mitmachen",
          text: "Unter „Offen“ findest du die aktiven Kordate nach Kategorie (Essen und Wein, Technik, Reisen und Events, Haus und Energie…). Öffne die, die dich interessiert, und tippe auf „Ich mache mit“: Wir sagen dir Bescheid, wenn die Mindestzahl erreicht ist. Unter „Meine“ findest du die, bei denen du dabei bist.",
          tip: "Nach dem Beitritt siehst du, wer mitmacht, und kannst im Gruppenchat schreiben."
        },
        {
          title: "Kordata vorschlagen",
          text: "Tippe auf „Kordata vorschlagen“. Zum Schutz der Teilnehmer musst du Organisator werden: seit mindestens 30 Tagen aktives Abo, vollständiges Profil, verifizierte Identität und akzeptierte Regeln für Organisatoren."
        },
        {
          title: "Wie bezahlt wird",
          text: "KUMANI wickelt keine Zahlungen ab: Ist die Mindestzahl erreicht, bezahlt jeder den Lieferanten direkt nach den Anweisungen des Organisators, der für sein Angebot verantwortlich ist."
        }
      ],
      cta: {
        label: "Kordata öffnen",
        href: "/marketplace/convivio"
      }
    },
    {
      slug: "affinity",
      category: "community",
      title: "KUMANI Affinity",
      summary: "Ein Spiel mit 20 Fragen, um deinen Archetyp zu entdecken, einen Freund herauszufordern und Menschen kennenzulernen, die zu dir passen.",
      minutes: 3,
      steps: [
        {
          title: "Beantworte 20 Fragen",
          text: "Tippe auf „Spiel starten“ und beantworte 20 schnelle Fragen: Es gibt keine richtigen oder falschen Antworten.",
          tip: "Wir speichern nur deine Karte (5 Werte) und deinen Archetyp, nie deine einzelnen Antworten. Du kannst sie jederzeit löschen."
        },
        {
          title: "Dein Archetyp und deine Karte",
          text: "Am Ende entdeckst du deinen KUMANI-Archetyp und deine Affinitätskarte mit 5 Werten: Abenteuer, Werte, Rhythmus, Neugier und Wärme. Du kannst sie teilen oder nochmal spielen."
        },
        {
          title: "Im Duo spielen",
          text: "Tippe auf „Duo-Link senden“ und schick ihn einem Freund oder deinem Partner: Er spielt, auch ohne sich zu registrieren, und ihr erfahrt sofort, wie gut ihr zusammenpasst."
        },
        {
          title: "Affinity Freundschaften",
          text: "Jede Woche stellt dir Kumi ein paar Menschen vor, die zu dir passen. Wähle die Sprachen, die du sprichst, schreib einen Satz über dich, gib deine Zustimmung und tippe auf „Vorstellungen aktivieren“. Der Chat öffnet sich nur, wenn ihr beide Ja sagt.",
          tip: "Dabei sind nur volljährige Abonnenten, die sich dafür entschieden haben. Du kannst jederzeit blockieren, melden oder pausieren."
        }
      ],
      cta: {
        label: "Affinity öffnen",
        href: "/marketplace/affinity"
      }
    },
    {
      slug: "veritas",
      category: "community",
      title: "Veritas",
      summary: "Das Spiel „Wer lügt?“ für 3 bis 8 Spieler: Freunde können auch ohne Registrierung mitspielen.",
      minutes: 2,
      steps: [
        {
          title: "Raum erstellen",
          text: "Gib deinen Spitznamen ein, wähle die Sprache der Fragen und die Anzahl der Runden und tippe auf „Raum erstellen“. Lade Freunde mit dem Link oder dem Code ein: 3 bis 8 Spieler, auch ohne Registrierung."
        },
        {
          title: "Mit einem Code beitreten",
          text: "Hat ein Freund schon einen Raum erstellt, gib seinen Code ein und tippe auf „Raum betreten“."
        },
        {
          title: "So wird gespielt",
          text: "In jeder Runde kommt eine Frage: Alle schreiben die Wahrheit, nur einer erfindet heimlich etwas. Lest die anonymen Antworten und stimmt ab, wer lügt. Wer den Lügner entlarvt, bekommt 1 Punkt; der Lügner bekommt 1 Punkt für jede getäuschte Person."
        }
      ],
      cta: {
        label: "Veritas öffnen",
        href: "/marketplace/veritas"
      }
    },
    {
      slug: "kumani-cv",
      category: "organize",
      title: "KUMANI CV",
      summary: "Erstelle deinen Lebenslauf im europäischen Format: Jedes PDF hat einen QR-Code zu deiner immer aktuellen öffentlichen Seite.",
      minutes: 4,
      steps: [
        {
          title: "Neuen Lebenslauf erstellen",
          text: "Tippe auf „Neuer Lebenslauf“. Der Lebenslauf ist im europäischen Format und jedes PDF hat einen QR-Code zu deiner öffentlichen Seite: Wer ihn scannt, sieht immer die neueste Version."
        },
        {
          title: "Name, Sprache und Vorlage",
          text: "Gib dem Lebenslauf einen Namen (zum Beispiel „Lebenslauf Deutsch“), wähle die Sprache des Inhalts und eine der drei Vorlagen: Minimal, Classic oder Sidebar. Füge dann Foto und persönliche Daten hinzu.",
          tip: "Du kannst mehrere Lebensläufe anlegen, zum Beispiel einen auf Deutsch und einen auf Englisch."
        },
        {
          title: "Erfahrung, Ausbildung und Kenntnisse",
          text: "Fülle die Abschnitte mit „Erfahrung hinzufügen“, „Ausbildung hinzufügen“, Kenntnissen, Sprachen, Zertifikaten und Links. Mit „Vorschau“ siehst du sofort, wie er aussieht."
        },
        {
          title: "Erstellen, herunterladen und teilen",
          text: "Tippe auf „Lebenslauf erstellen“. Danach kannst du das PDF herunterladen, den öffentlichen Link kopieren oder ihn per WhatsApp und E-Mail teilen. Wenn du den Lebenslauf aktualisierst, zeigen Link und QR-Code immer die neue Version."
        }
      ],
      cta: {
        label: "KUMANI CV öffnen",
        href: "/marketplace/kumani-cv"
      }
    },
    {
      slug: "findo",
      category: "organize",
      title: "Findo",
      summary: "Dein persönliches Inventar: Notiere, wo du Dinge aufbewahrst, und finde sie im Nu wieder.",
      minutes: 2,
      steps: [
        {
          title: "Dein persönliches Inventar",
          text: "Notiere, wo du Dinge aufbewahrst (Dokumente, Werkzeug, Wertsachen), und finde sie im Nu wieder. Tippe zum Start auf „Objekt hinzufügen“."
        },
        {
          title: "Objekt erfassen",
          text: "Füge ein Foto hinzu, schreib, was du erfasst, wähle, wo es ist (oder lege einen neuen Ort an), dann Kategorie und Tags. Tippe auf „Objekt speichern“.",
          tip: "Orte lassen sich wiederverwenden: „Schlafzimmerschrank“, „Keller“, „Büro“… Wenn du ein Objekt umräumst, speichert Findo den Verlauf."
        },
        {
          title: "Dinge wiederfinden",
          text: "Suche nach Name, Tag oder Ort, zeig nur Favoriten an oder öffne „Standorte verwalten“, um zu sehen, was an jedem Ort liegt."
        }
      ],
      cta: {
        label: "Findo öffnen",
        href: "/marketplace/findo"
      }
    },
    {
      slug: "life-calendar",
      category: "organize",
      title: "Life Calendar",
      summary: "Ausweise, Auto, Haus, Verträge und Abos: alle Fristen an einem Ort, mit Verlängerung und Erinnerungen.",
      minutes: 2,
      steps: [
        {
          title: "Alle Fristen an einem Ort",
          text: "Oben siehst du, wie viele Fristen in Ordnung, bald fällig, dringend oder abgelaufen sind. Tippe auf „Neue Frist“, um eine hinzuzufügen."
        },
        {
          title: "Frist hinzufügen",
          text: "Schreib, woran du denken willst (Personalausweis, Kfz-Versicherung, TÜV…), wähle die Kategorie und, wenn du willst, ein Profil: eine Person, ein Auto, ein Haus. Gib dann das Fälligkeitsdatum ein."
        },
        {
          title: "Verlängerung und Erinnerungen",
          text: "Wähle, ob sie sich wiederholt (jeden Monat, jedes Jahr, alle 2 Jahre…) und wann wir dich erinnern sollen, von 180 Tagen bis 1 Tag vorher. Wir erinnern dich im Dashboard und im MemoLife-Kalender."
        }
      ],
      cta: {
        label: "Life Calendar öffnen",
        href: "/marketplace/life-calendar"
      }
    },
    {
      slug: "memolife",
      category: "organize",
      title: "MemoLife",
      summary: "Dein Kalender: Termine, Erinnerungen, Notizen und Kontakte, zusammen mit Rechnungen und Fristen.",
      minutes: 2,
      steps: [
        {
          title: "Dein Kalender",
          text: "MemoLife bündelt Termine, Erinnerungen, Notizen und Kontakte in den Tabs Heute, Kalender, Erinnerungen, Notizen und Kontakte. Im Kalender siehst du auch die Rechnungen aus Spendly und die Fristen aus Life Calendar."
        },
        {
          title: "Etwas hinzufügen",
          text: "Tippe unten auf den „+“-Button und wähle Termin, Erinnerung, Notiz oder Kontakt. Von hier aus kannst du auch eine Rechnung (Spendly) oder eine Dokumentfrist (Life Calendar) hinzufügen."
        }
      ],
      cta: {
        label: "MemoLife öffnen",
        href: "/marketplace/memolife"
      }
    },
    {
      slug: "spendly",
      category: "organize",
      title: "Spendly",
      summary: "Dein persönliches Budget Monat für Monat: Einnahmen, Rechnungen und Ausgaben im Griff.",
      minutes: 3,
      steps: [
        {
          title: "Dein Jahresbudget",
          text: "In der „Jahresübersicht“ siehst du Einnahmen, feste Ausgaben, variable Ausgaben und den Nettosaldo des Jahres, mit dem Verlauf Monat für Monat."
        },
        {
          title: "Die Tabs",
          text: "Oben wechselst du zwischen den Tabs: Übersicht, Einnahmen, Rechnungen, Feste Ausgaben und Variable Ausgaben. Tippe in jedem auf „Neu“, um einen Eintrag hinzuzufügen."
        },
        {
          title: "Monatliche Übersicht",
          text: "Wähle einen Monat, um die Details zu sehen: Einnahmen, Ausgaben, Saldo und variable Ausgaben nach Kategorie. Die Farben zeigen, ob der Monat positiv, kritisch oder zu beobachten ist."
        },
        {
          title: "Rechnungen",
          text: "Im Tab „Rechnungen“ fügst du Strom, Gas, Wasser, Telefon… mit „Neue Rechnung“ hinzu: Sie wiederholen sich automatisch und du trägst ein, was du wirklich bezahlt hast. Kündigst du einen Vertrag, deaktiviere sie."
        }
      ],
      cta: {
        label: "Spendly öffnen",
        href: "/marketplace/spendly"
      }
    },
    {
      slug: "svat",
      category: "organize",
      title: "SVAT – Betrugsprävention",
      summary: "Prüfe in Sekunden, ob eine Website, eine USt-IdNr. oder ein QR-Code vertrauenswürdig sind.",
      minutes: 2,
      steps: [
        {
          title: "Wähle, was du prüfst",
          text: "Du kannst eine Website („Website-Prüfung“), eine USt-IdNr. („USt-IdNr.-Prüfung“) oder einen QR-Code („QR-Prüfung“) prüfen."
        },
        {
          title: "Die Vertrauensbewertung",
          text: "Gib die Adresse der Website ein und tippe auf „Verifizierung starten“: In wenigen Sekunden bekommst du eine Bewertung von 0 bis 100 und ein Urteil."
        },
        {
          title: "Die Prüfungen im Detail",
          text: "Darunter siehst du, wie viele Prüfungen in Ordnung, zu beobachten oder riskant sind: Domain und DNS, Sicherheit, Inhalt, rechtliche Seiten, Bewertungen und Geschäftsmodell."
        },
        {
          title: "USt-IdNr. prüfen",
          text: "Gib im Tab „USt-IdNr.-Prüfung“ eine italienische oder europäische USt-IdNr. ein, um zu erfahren, ob sie aktiv ist und wem sie gehört.",
          tip: "Eine gute Bewertung ist ein Hinweis, keine Garantie: Lies vor dem Bezahlen auch das Anti-Betrugs-Handbuch."
        }
      ],
      cta: {
        label: "SVAT öffnen",
        href: "/marketplace/svat"
      }
    },
    {
      slug: "focus",
      category: "wellness",
      title: "KUMANI Focus",
      summary: "Arbeite in Intervallen: Konzentration und kurze Pausen, mit einer langen Pause alle 4 Einheiten.",
      minutes: 2,
      steps: [
        {
          title: "Einheit starten",
          text: "Schreib, worauf du dich konzentrierst, und tippe auf „Starten“: Der Countdown beginnt. Du kannst eine Phase überspringen oder neu beginnen; ein leiser Ton meldet jeden Wechsel."
        },
        {
          title: "Wähle deinen Rhythmus",
          text: "Klassisch 25/5, Lang 50/10, Kurz 15/3 oder Eigener. Du kannst Ton, Vibration, dauerhaft eingeschalteten Bildschirm und eine Benachrichtigung bei jedem Wechsel aktivieren."
        },
        {
          title: "Deine Einheiten heute",
          text: "Du siehst, wie viele Einheiten du heute abgeschlossen und wie viele Minuten du dich konzentriert hast. Das setzt sich jeden Tag zurück und bleibt nur auf deinem Gerät.",
          tip: "Öffne „Tipps für mehr Konzentration“ für ein paar Anregungen."
        }
      ],
      cta: {
        label: "Focus öffnen",
        href: "/marketplace/focus"
      }
    },
    {
      slug: "mandala",
      category: "wellness",
      title: "Mandala KUMANI",
      summary: "Zeichne mit einem Finger: Dein Strich wird zu einem symmetrischen Mandala. Kein Talent nötig.",
      minutes: 2,
      steps: [
        {
          title: "Mit einem Finger zeichnen",
          text: "Zieh eine Linie auf der Leinwand: Sie wird symmetrisch wiederholt und wird in Sekunden zum Mandala."
        },
        {
          title: "Symmetrie und Farben wählen",
          text: "Wähle die Symmetrie (6, 8, 12 oder 16 Segmente), dunklen oder elfenbeinfarbenen Hintergrund, Pinsel oder Radierer, Strichstärke und Farbe. „Rückgängig“ geht einen Schritt zurück, „Löschen“ fängt neu an."
        },
        {
          title: "Mandala herunterladen",
          text: "Tippe auf „PNG herunterladen“, um die Zeichnung zu speichern und zu teilen, zum Beispiel auf WhatsApp.",
          tip: "Noch entspannter wird es, wenn du beim Zeichnen die Klänge von Neurobalance hörst."
        }
      ],
      cta: {
        label: "Mandala öffnen",
        href: "/marketplace/mandala"
      }
    },
    {
      slug: "mosaic",
      category: "wellness",
      title: "KUMANI Mosaic",
      summary: "Jeder Kumano setzt täglich ein paar Steine auf eine gemeinsame Leinwand: ein Werk der ganzen Community.",
      minutes: 2,
      steps: [
        {
          title: "Ein Werk der ganzen Community",
          text: "Jeder Kumano hinterlässt seine Spur auf der gemeinsamen Leinwand: Niemand besitzt sie, alle haben sie geschaffen. Du kannst sie vergrößern, ihr Wachsen nachverfolgen, sie teilen und herunterladen."
        },
        {
          title: "So funktioniert es",
          text: "Jeden Tag hast du ein paar Steine: Tippe auf ein freies Feld, wähle eine Farbe und bestätige. Ein gesetzter Stein bleibt für immer. Die Steine erneuern sich um Mitternacht und jede Saison hat ein Thema und ein Enddatum.",
          tip: "Du kannst Steine setzen, nachdem du dich an 7 Tagen bei KUMANI angemeldet hast. Nutzt du am selben Tag noch einen anderen KUMANI-Dienst, bekommst du einen Bonusstein."
        },
        {
          title: "Deine Auszeichnungen",
          text: "Schalte die Auszeichnungen der Saison frei: Mitgründer des Werks, Letztes Steinchen und Mosaikkünstler. Siehst du eine beleidigende Schrift oder Werbung, tippe auf einen ihrer Steine und melde den Bereich."
        }
      ],
      cta: {
        label: "Mosaic öffnen",
        href: "/marketplace/mosaic"
      }
    },
    {
      slug: "oxygen",
      category: "wellness",
      title: "OXYGEN",
      summary: "Drei Minuten, um wieder durchzuatmen, mit der 4-7-8-Atmung: 4 Sekunden einatmen, 7 halten, 8 ausatmen.",
      minutes: 2,
      steps: [
        {
          title: "Wähle, wie du atmest",
          text: "Wähle die geführte Sitzung (etwa 3 Minuten, mit ein paar Worten unterwegs) oder nur atmen, und wie viele Zyklen: 4 werden empfohlen. Mit Ton und Vibration kannst du mit geschlossenen Augen atmen."
        },
        {
          title: "Bevor du anfängst",
          text: "Setz oder leg dich an einen ruhigen Ort, nie beim Autofahren. Mach beim ersten Mal höchstens 4 Zyklen und hör auf, wenn dir schwindelig wird, und atme normal weiter.",
          tip: "OXYGEN ist eine Entspannungsübung, kein Medizinprodukt: Es ersetzt keinen ärztlichen Rat."
        },
        {
          title: "Mit dem Atmen beginnen",
          text: "Tippe auf „Mit dem Atmen beginnen“: Der Kreis weitet sich und zieht sich mit dir zusammen und begleitet dich Schritt für Schritt."
        }
      ],
      cta: {
        label: "OXYGEN öffnen",
        href: "/marketplace/oxygen"
      }
    },
    {
      slug: "fabula",
      category: "wellness",
      title: "Kumani Fabula",
      summary: "Sechs Würfel, eine Geschichte: Schreib eine Mikrogeschichte mit den Würfeln des Tages und lies die der Community.",
      minutes: 2,
      steps: [
        {
          title: "Der Wurf des Tages",
          text: "Beim „Wurf des Tages“ sind die Würfel für die ganze Community gleich und wechseln um Mitternacht. Mit dem „Freien Wurf“ würfelst du, wann du willst."
        },
        {
          title: "Würfeln und schreiben",
          text: "Tippe auf „Würfeln“: Es kommen Figur, Ort, Gegenstand, Gefühl, Handlung und Stimmung. Schreib eine Mikrogeschichte (bis zu 900 Zeichen), die alle verwendet; wenn du magst, probier die 60-Sekunden-Challenge."
        },
        {
          title: "Galerie und Geschichten",
          text: "Veröffentliche die Geschichte in der „Galerie“ oder behalte sie in „Meine Geschichten“. Lies, wie andere dieselben Würfel erzählt haben, in sieben Sprachen: keine Rangliste, nur Applaus.",
          tip: "Schreib jeden Tag, um die Auszeichnung „Beständige Feder“ zu bekommen."
        }
      ],
      cta: {
        label: "Fabula öffnen",
        href: "/marketplace/fabula"
      }
    },
    {
      slug: "neurobalance",
      category: "wellness",
      title: "Neurobalance",
      summary: "Audiositzungen mit binauralen Frequenzen und Naturklängen für eine entspannte Pause.",
      minutes: 2,
      steps: [
        {
          title: "Sitzung wählen",
          text: "Setz Stereokopfhörer auf, wähle eine Sitzung (zum Beispiel „Tiefe Ruhe“, „Fließender Fokus“ oder „Bewusster Neustart“), stell die Lautstärke ein und tippe auf „Session starten“."
        },
        {
          title: "Special Sound",
          text: "Trägerfrequenzen zum Hören mit Stereokopfhörern, bei niedriger, angenehmer Lautstärke. Tippe auf den Play-Button neben der gewünschten."
        },
        {
          title: "Naturklänge",
          text: "Regen, Ozean, Bach, Wald, Wind, Feuer, Nacht und Gewitter: Schalte einen ein und misch ihn in deine Sitzung.",
          tip: "Neurobalance ist zum Entspannen gedacht, es ist keine Therapie."
        }
      ],
      cta: {
        label: "Neurobalance öffnen",
        href: "/marketplace/neurobalance"
      }
    },
    {
      slug: "aureya",
      category: "wellness",
      title: "Aureya",
      summary: "Zwei schnelle Selbsttests, Hören und Gesichtsfeld, zum Wiederholen und Vergleichen im Lauf der Zeit.",
      minutes: 2,
      steps: [
        {
          title: "Vorab",
          text: "Aureya ist ein Werkzeug zur Selbsteinschätzung, kein Medizinprodukt, und ersetzt keine Untersuchung. Die Ergebnisse hängen von Kopfhörern, Lautstärke, Helligkeit und Abstand zum Bildschirm ab: Sie sind nur Richtwerte."
        },
        {
          title: "Test wählen",
          text: "Beim Akustiktest hörst du eine Reihe von Tönen in verschiedenen Frequenzen, ein Ohr nach dem anderen. Beim Gesichtsfeldtest schaust du auf die Bildschirmmitte und markierst die Punkte, die du siehst, auch aus dem Augenwinkel."
        },
        {
          title: "Im Lauf der Zeit vergleichen",
          text: "Jeder Test speichert Datum und Ergebnis (0 bis 100, höher ist besser) im „Testverlauf“, damit du sie vergleichen kannst.",
          tip: "Bei Zweifeln oder wahrgenommener Verschlechterung wende dich an einen Arzt oder Facharzt."
        }
      ],
      cta: {
        label: "Aureya öffnen",
        href: "/marketplace/aureya"
      }
    },
    {
      slug: "travel",
      category: "wellness",
      title: "KUMANI Travel",
      summary: "Die Reise, die sich selbst organisiert: Reiseplan Tag für Tag und Checkliste, geteilt mit deinen Mitreisenden.",
      minutes: 2,
      steps: [
        {
          title: "Reise erstellen",
          text: "Tippe auf „Neue Reise“, füge Daten und Aktivitäten hinzu: Der Reiseplan entsteht Tag für Tag. In der Checkliste notierst du, was nicht vergessen werden darf und wer sich darum kümmert.",
          tip: "Zum Erstellen einer Reise brauchst du ein Abo; um einer Reise beizutreten, zu der du eingeladen wurdest, nicht."
        },
        {
          title: "Einladen oder mit Code beitreten",
          text: "Tippe in der Reise auf „Zur Reise einladen“ und schick Link oder Code an deine Mitreisenden. Hast du einen Code bekommen, gib ihn bei „Einladungscode?“ ein und tippe auf „Beitreten“."
        }
      ],
      cta: {
        label: "KUMANI Travel öffnen",
        href: "/viaggi"
      }
    },
  ],
}

export default content
