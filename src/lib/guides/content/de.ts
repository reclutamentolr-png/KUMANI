import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Erste Schritte', text: 'Erstelle dein Konto, melde dich an und entdecke dein Dashboard.' },
    promote: { title: 'KUMANI empfehlen', text: 'Lade Bekannte mit deinem Link ein und nutze die Voucher.' },
    wallet: { title: 'Die Brieftasche', text: 'Karte, Punkte, Spenden, Abzeichen und Belege an einem Ort.' },
    promoteTools: { title: "Tools zum Empfehlen", text: "Die Anleitungen zu den Diensten, mit denen du KUMANI bekannt machst." },
    security: { title: "Sicherheit", text: "Die Anleitungen zu den Diensten, mit denen du Betrug erkennst und stoppst." },
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
          text: 'Die Regeln stehen in der Brieftasche: Du erhältst KU Points, wenn eine von dir eingeladene Person ein Abo mit Karte bezahlt oder zu Pro wechselt, und mit dem Struktur-Bonus.',
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
  ],
}

export default content
