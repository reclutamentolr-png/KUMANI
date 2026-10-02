import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Erste Schritte', text: 'Erstelle dein Konto, melde dich an und entdecke dein Dashboard.' },
    promote: { title: 'KUMANI empfehlen', text: 'Lade Bekannte mit deinem Link ein und nutze die Voucher.' },
    wallet: { title: 'Die Brieftasche', text: 'Karte, Punkte, Spenden, Abzeichen und Belege an einem Ort.' },
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
  ],
}

export default content
