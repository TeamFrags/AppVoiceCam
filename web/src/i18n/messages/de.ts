import type { Messages } from './en';

export const de: Messages = {
  meta: {
    description:
      '{name} verändert dein Gesicht und deine Stimme live für Discord und deine Spiele.',
  },
  nav: {
    main: 'Hauptnavigation',
    skip: 'Zum Inhalt springen',
    features: 'Funktionen',
    pricing: 'Preise',
    faq: 'FAQ',
    download: 'Download',
    signIn: 'Anmelden',
    account: 'Mein Konto',
    language: 'Sprache',
  },
  footer: {
    privacy: 'Datenschutz',
    terms: 'Nutzungsbedingungen',
    refunds: 'Erstattungen',
    support: 'Hilfe',
    creators: 'Creator',
    cookies: 'Cookies verwalten',
  },
  home: {
    live: 'Gesicht und Stimme in Echtzeit',
    lead: '{name} verwandelt dein Gesicht und deine Stimme live und gibt sie als gewöhnliche Kamera und gewöhnliches Mikrofon an Discord und deine Spiele weiter.',
    ctaRegister: 'Kostenloses Konto erstellen',
    ctaFeatures: 'Funktionen ansehen',
    mascotAlt: '{mascot}, das Maskottchen von {name}',
    demoTitle: 'Ein Klick, und du bist jemand anderes',
    demoText:
      'Wähle ein Gesicht, wähle eine Stimme: Was deine Freunde sehen und hören, ändert sich, während du weitersprichst.',
    demoYou: 'Du',
    demoThem: 'Was sie sehen',
    demoAlt:
      'Illustration: links dein Webcam-Bild, rechts dieselbe Person mit anderem Gesicht und anderer Stimme.',
    appsTitle: 'Funktioniert dort, wo du spielst und chattest',
    appsOther: 'Und in jeder App, die eine Webcam oder ein Mikrofon akzeptiert.',
    apps: {
      discord: 'Anrufe, Streams und Sprachkanäle',
      roblox: 'Sprachchat und Kamera in deinen Erlebnissen',
      valorant: 'Sprachchat mit deinem Team',
      fortnite: 'Sprachchat mit deinem Squad',
      minecraft: 'Sprich mit deinen Freunden, während du baust',
      teamspeak: 'Sprachkanäle',
    },
    stepsTitle: 'In drei Schritten startklar',
    steps: [
      {
        title: 'Installieren und anmelden',
        text: 'Lade {name} für Windows herunter und melde dich mit deinem kostenlosen Konto an.',
      },
      {
        title: 'Gesicht und Stimme wählen',
        text: 'Such dir etwas aus dem Katalog aus. Die Vorschau zeigt das Ergebnis sofort.',
      },
      {
        title: 'In deiner App auswählen',
        text: 'Wähle „{camera}“ und „{microphone}“ als Kamera und Mikrofon in Discord oder deinem Spiel.',
      },
    ],
    featuresTitle: 'Was {name} kann',
    features: [
      {
        title: 'Ein neues Gesicht, live',
        text: 'Wähle ein Gesicht aus dem Katalog: Es folgt deiner Mimik in Echtzeit vor deiner Webcam.',
      },
      {
        title: 'Eine neue Stimme, ohne Verzögerung',
        text: 'Deine Stimme wird verwandelt, während du sprichst, und bleibt auch mitten im Match flüssig.',
      },
      {
        title: 'Kompatibel mit deinen Apps',
        text: 'Wähle „{camera}“ und „{microphone}“ als Kamera und Mikrofon, wo immer du sie brauchst.',
      },
      {
        title: 'Alles passiert auf deinem PC',
        text: 'Kamera und Mikrofon werden auf deinem Rechner verarbeitet. Dein Bild und deine Stimme werden nicht an uns gesendet.',
      },
    ],
    pricingTitle: 'Kostenlos starten',
    pricingText:
      'Einige Gesichter und Stimmen sind kostenlos. Premium schaltet den gesamten Katalog, eigene Gesichter und das Klonen von Stimmen frei.',
    pricingCta: 'Tarife vergleichen',
  },
  features: {
    title: 'Funktionen',
    description:
      'Gesicht und Stimme in Echtzeit ändern, virtuelle Kamera und virtuelles Mikrofon, Leistungsprofile: alles, was {name} kann.',
    lead: '{name} wird unter Windows installiert und sitzt zwischen deiner Webcam, deinem Mikrofon und deinen Apps.',
    groups: [
      {
        title: 'Gesicht',
        items: [
          'Fertige, vordefinierte Gesichter',
          'Eigene Gesichter aus einem Foto, das du verwenden darfst (Premium)',
          'Mimikverfolgung in Echtzeit',
        ],
      },
      {
        title: 'Stimme',
        items: [
          'Fertige, vordefinierte Stimmen',
          'Klonen einer Stimme, die du verwenden darfst (Premium)',
          'Verwandlung, während du sprichst',
        ],
      },
      {
        title: 'Virtuelle Kamera und virtuelles Mikrofon',
        items: [
          '„{camera}“ und „{microphone}“ erscheinen in deiner Geräteliste',
          'Kompatibel mit {apps}',
          'Und mit jeder App, die eine gewöhnliche Webcam oder ein gewöhnliches Mikrofon nutzt',
        ],
      },
      {
        title: 'Leistung',
        items: [
          'Nutzt deine Grafikkarte, wenn vorhanden, sonst deinen Prozessor',
          'Drei Profile: maximale Leistung, ausgewogen, ressourcenschonend',
          'Optionale Anzeige von Bildern pro Sekunde und Latenz',
        ],
      },
      {
        title: 'Konto und Sicherheit',
        items: [
          'Liste deiner angemeldeten Geräte, mit Abmeldung aus der Ferne',
          'Katalog mit Gesichtern und Stimmen, der ohne Neuinstallation aktualisiert wird',
          'Updates werden vor der Installation signiert und geprüft',
        ],
      },
    ],
    note: 'Die App befindet sich noch in der Entwicklung: Einige Funktionen kommen nach der ersten Version. <a>Erstelle dein Konto</a>, um zum Start bereit zu sein.',
  },
  pricing: {
    title: 'Preise',
    description:
      '{name} ist zum Start kostenlos. Premium für {price} pro Monat schaltet alle Gesichter, alle Stimmen und das Klonen von Stimmen frei.',
    lead: 'Starte kostenlos. Wechsle zu Premium, wann du willst, und kündige, wann du willst.',
    free: 'Kostenlos',
    freeItems: [
      'Eine Auswahl vordefinierter Gesichter',
      'Eine Auswahl vordefinierter Stimmen',
      'Virtuelle Kamera und virtuelles Mikrofon',
      'Alle Leistungsprofile',
    ],
    freeCta: 'Konto erstellen',
    premium: 'Premium',
    perMonth: '/ Monat',
    premiumItems: [
      'Alle Gesichter des Katalogs',
      'Alle Stimmen des Katalogs',
      'Eigene Gesichter erstellen',
      'Stimmen klonen',
      'Erweiterte Funktionen',
    ],
    soon: 'Demnächst verfügbar',
    note: 'Abonnements sind noch nicht geöffnet. Preis inklusive Steuern, ohne Mindestlaufzeit.',
  },
  faq: {
    title: 'Häufige Fragen',
    description:
      'Kompatibilität, Voraussetzungen, Datenschutz, Abonnement: Antworten auf die Fragen zu {name}.',
    items: [
      {
        q: 'Mit welchen Apps funktioniert {name}?',
        a: 'Mit {apps} und ganz allgemein mit jeder App, in der du Webcam oder Mikrofon auswählen kannst. Wähle in ihren Einstellungen einfach „{camera}“ und „{microphone}“.',
      },
      {
        q: 'Was brauche ich dafür?',
        a: 'Einen Windows-PC. Mit einer aktuellen Grafikkarte läuft es am flüssigsten; ohne sie wechselt die App mit einem leichteren Profil auf den Prozessor.',
      },
      {
        q: 'Werden mein Bild und meine Stimme an eure Server gesendet?',
        a: 'Nein. Die Verwandlung passiert auf deinem PC. Unsere Server verwalten dein Konto, dein Abonnement und den Download von Gesichtern und Stimmen.',
      },
      {
        q: 'Darf ich das Gesicht oder die Stimme einer anderen Person verwenden?',
        a: 'Nur mit ihrer Erlaubnis. Sich als reale Person auszugeben, um zu täuschen, zu belästigen oder zu betrügen, ist verboten und führt zur Sperrung des Kontos.',
      },
      {
        q: 'Brauche ich ein Konto?',
        a: 'Ja, die App verlangt eine Anmeldung. Das Konto ist kostenlos.',
      },
      {
        q: 'Was kostet Premium?',
        a: '{price} pro Monat, ohne Mindestlaufzeit. Es schaltet den gesamten Katalog, eigene Gesichter und das Klonen von Stimmen frei.',
      },
      {
        q: 'Wie lösche ich mein Konto oder erhalte meine Daten?',
        a: 'Schreib uns an {email}: Wir bearbeiten die Anfrage und antworten innerhalb eines Monats.',
      },
    ],
  },
  download: {
    title: '{name} herunterladen',
    description: '{name} für Windows herunterladen.',
    soonTitle: 'Demnächst verfügbar',
    text: 'Die App befindet sich noch in der Entwicklung. Erstelle jetzt dein Konto: Damit meldest du dich am Tag der Veröffentlichung an.',
    button: 'Für Windows herunterladen',
    cta: 'Konto erstellen',
  },
  privacy: {
    title: 'Datenschutz und Cookies',
    description: 'Welche Daten {name} erhebt, warum, wie lange, und wie du deine Rechte ausübst.',
    controllerTitle: 'Wer für deine Daten verantwortlich ist',
    publisherFallback: 'Der Herausgeber von {name}',
    contact: 'Kontakt:',
    collectTitle: 'Was wir erheben',
    collect: [
      '<b>Dein Konto</b>: E-Mail-Adresse und Passwort (nur als Hash gespeichert, nie im Klartext).',
      '<b>Deine Anmeldungen</b>: Gerätename, IP-Adresse und Datum, um dir deine aktiven Sitzungen zu zeigen und verdächtige Anmeldungen zu erkennen.',
      '<b>Die Reichweitenmessung der Website</b>, nur wenn du zustimmst: besuchte Seiten, verweisende Website, Datum und Uhrzeit des Besuchs sowie Land (aus deiner IP-Adresse abgeleitet, die nicht gespeichert wird), verknüpft mit einer anonymen Kennung.',
      '<b>Die Anmeldung mit Google oder Discord</b>, wenn du sie wählst: die E-Mail-Adresse und die Kontokennung, die dieser Dienst uns übermittelt. Dein Passwort erhalten wir nie.',
      '<b>Bewerbungen für das Creator-Programm</b>: der Name, die E-Mail-Adresse, der Kanal-Link und die Nachricht, die du in das Formular einträgst.',
    ],
    basisTitle: 'Was uns die Nutzung erlaubt',
    basis: [
      'Konto und Anmeldungen: die Bereitstellung des Dienstes, für den du dich registriert hast, und unser berechtigtes Interesse am Schutz der Konten.',
      'Reichweitenmessung: deine Einwilligung, die du jederzeit widerrufen kannst.',
      'Creator-Bewerbungen: die Beantwortung einer Anfrage, die du gestellt hast, vor jeder Zusammenarbeit.',
    ],
    recipientsTitle: 'Wer sie erhält',
    recipients:
      'Deine Daten werden nie verkauft. Sie werden nur von den Dienstleistern verarbeitet, die den Dienst hosten und unsere E-Mails zustellen, und zwar nach unseren Weisungen.',
    noMedia:
      'Wir erheben weder dein Kamerabild noch den Ton deines Mikrofons: Die Verwandlung passiert auf deinem PC.',
    cookiesTitle: 'Cookies',
    table: { name: 'Name', role: 'Zweck', duration: 'Dauer', consent: 'Einwilligung' },
    rt: {
      role: 'Hält dich angemeldet. Für Skripte der Seite nicht lesbar.',
      duration: '30 Tage',
      consent: 'Nicht erforderlich (für den Dienst notwendig)',
    },
    vid: {
      role: 'Anonyme Kennung zum Zählen der Besuche.',
      duration: '13 Monate',
      consent: 'Erforderlich: wird nur gesetzt, wenn du zustimmst',
    },
    choice:
      'Deine Entscheidung wird sechs Monate in deinem Browser gespeichert und danach erneut abgefragt. Keine Werbe-Cookies, keine Messwerkzeuge von Dritten. Du kannst sie jederzeit ändern: <manage>Cookies verwalten</manage>.',
    retentionTitle: 'Speicherdauer',
    retention: [
      'Konto: bis zu seiner Löschung.',
      'Reichweitenmessung: 25 Monate, danach automatische Löschung.',
      'Creator-Bewerbungen: 12 Monate, danach automatische Löschung.',
    ],
    rightsTitle: 'Deine Rechte',
    rights:
      'Du kannst Auskunft über deine Daten, ihre Berichtigung, Löschung oder Herausgabe verlangen, indem du an <mail>{email}</mail> schreibst. Du kannst dich außerdem bei deiner Datenschutzbehörde beschweren (in Frankreich die CNIL: cnil.fr).',
  },
  legal: {
    updated: 'Zuletzt aktualisiert: {date}',
  },
  terms: {
    title: 'Nutzungsbedingungen',
    description:
      'Die Regeln für die Nutzung von {name}: dein Konto, was erlaubt ist, Premium und deine Rechte.',
    sections: [
      {
        title: 'Der Dienst',
        body: [
          '{name} ist eine Windows-App, die dein Gesicht und deine Stimme live verändert und sie als gewöhnliche Kamera und gewöhnliches Mikrofon an deine anderen Apps weitergibt. Diese Bedingungen gelten, sobald du ein Konto erstellst oder die App oder diese Website nutzt.',
          'Die App befindet sich noch in der Entwicklung: Funktionen können sich ändern, hinzukommen oder entfallen.',
        ],
      },
      {
        title: 'Dein Konto',
        body: [
          'Für die App brauchst du ein Konto. Gib eine E-Mail-Adresse an, die du abrufst, behalte dein Passwort für dich und sag uns schnell Bescheid, wenn du glaubst, dass jemand anderes dein Konto benutzt.',
          'Du musst mindestens 15 Jahre alt sein. Wenn du unter 18 bist, brauchst du die Zustimmung eines Elternteils oder deines gesetzlichen Vertreters.',
        ],
      },
      {
        title: 'Was erlaubt ist',
        body: [
          'Verwende nur Gesichter und Stimmen, die du verwenden darfst. Eigene Gesichter und geklonte Stimmen erfordern die Erlaubnis der Person, der sie gehören.',
          'Es ist verboten, dich als reale Person auszugeben, um jemanden zu täuschen, zu belästigen, zu betrügen oder zu schädigen, illegale Inhalte zu erstellen oder die Grenzen deines Tarifs oder die Schutzmechanismen der App zu umgehen.',
          'Du bleibst dafür verantwortlich, die Regeln der Apps und Spiele einzuhalten, mit denen du {name} verwendest.',
        ],
      },
      {
        title: 'Kostenlos und Premium',
        body: [
          'Der kostenlose Tarif enthält eine Auswahl an Gesichtern und Stimmen. Premium kostet {price} pro Monat und schaltet den Rest frei. Abos sind noch nicht verfügbar: Preis und Bedingungen werden vor jeder Zahlung angezeigt.',
          'Kündigungen und Erstattungen sind in unserer <refunds>Erstattungsrichtlinie</refunds> geregelt.',
        ],
      },
      {
        title: 'Sperrung und Schließung des Kontos',
        body: [
          'Bei Verstößen gegen diese Bedingungen können wir das Konto vorübergehend oder dauerhaft sperren. Der Grund wird angezeigt, wenn du dich anmelden willst, und du kannst ihm widersprechen, indem du an <mail>{email}</mail> schreibst.',
          'Unter derselben Adresse kannst du jederzeit die Löschung deines Kontos verlangen.',
        ],
      },
      {
        title: 'Eigentum',
        body: [
          'Die App, ihr Katalog an Gesichtern und Stimmen, die Marke und diese Website gehören uns. Dein Konto gibt dir ein persönliches Nutzungsrecht, das du weder weiterverkaufen noch übertragen kannst.',
          'Was du mit {name} erstellst, bleibt deins.',
        ],
      },
      {
        title: 'Verfügbarkeit und Haftung',
        body: [
          'Wir tun unser Bestes, damit der Dienst läuft, können aber nicht versprechen, dass er nie unterbrochen wird. Wir haften nicht dafür, wie eine App oder ein Spiel eines Drittanbieters auf die virtuelle Kamera oder das virtuelle Mikrofon reagiert.',
          'Nichts in diesen Bedingungen schränkt die Rechte ein, die dir das Gesetz als Verbraucher gibt, einschließlich der gesetzlichen Gewährleistung.',
        ],
      },
      {
        title: 'Änderungen dieser Bedingungen',
        body: [
          'Wenn wir etwas Wichtiges ändern, informieren wir dich per E-Mail oder auf dieser Website, bevor es gilt. Wenn du nicht einverstanden bist, kannst du dein Konto schließen.',
        ],
      },
      {
        title: 'Anwendbares Recht und Kontakt',
        body: [
          'Für diese Bedingungen gilt französisches Recht. Wenn du in einem anderen Land der Europäischen Union lebst, behältst du den Schutz der zwingenden Vorschriften deines Landes.',
          'Eine Frage oder eine Beschwerde? Schreib an <mail>{email}</mail> oder schau auf die <support>Hilfeseite</support>. Wie wir mit deinen Daten umgehen, steht auf der <privacy>Datenschutzseite</privacy>.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Erstattungsrichtlinie',
    description: 'Wann und wie du eine Zahlung für {name} Premium erstattet bekommst.',
    sections: [
      {
        title: 'Kurz gesagt',
        body: [
          'Der kostenlose Tarif kostet nichts, es gibt also nichts zu erstatten. Premium-Abos sind noch nicht verfügbar: Diese Richtlinie gilt ab dem Tag, an dem sie starten.',
        ],
      },
      {
        title: '14 Tage Bedenkzeit',
        body: [
          'Ab deiner ersten Premium-Zahlung hast du 14 Tage Zeit, eine vollständige Erstattung zu verlangen, ohne einen Grund zu nennen.',
        ],
      },
      {
        title: 'Kündigung und Verlängerungen',
        body: [
          'Du kannst jederzeit kündigen. Premium bleibt dann bis zum Ende des bereits bezahlten Zeitraums aktiv, und es wird nichts mehr abgebucht.',
          'Ein begonnener Zeitraum wird nicht anteilig erstattet, außer in den folgenden Fällen oder wenn das Gesetz es verlangt.',
        ],
      },
      {
        title: 'Irrtümlich abgebuchte Zahlung',
        body: [
          'Eine doppelt abgebuchte oder nach deiner Kündigung abgebuchte Zahlung wird vollständig erstattet.',
          'Wenn Premium durch unser Verschulden längere Zeit nicht funktioniert, schreib uns: Wir erstatten die verlorene Zeit.',
        ],
      },
      {
        title: 'So stellst du den Antrag',
        body: [
          'Schreib von der E-Mail-Adresse deines Kontos an <mail>{email}</mail> und nenne das Datum der Zahlung. Wir antworten per E-Mail, und eine bewilligte Erstattung geht innerhalb von 14 Tagen auf das verwendete Zahlungsmittel zurück.',
          'Siehe auch die <terms>Nutzungsbedingungen</terms>.',
        ],
      },
    ],
  },
  support: {
    title: 'Hilfe',
    description: 'Hilfe zu {name}: Konto, Installation, Abo und deine Daten.',
    lead: 'Ein Problem oder eine Frage? Schreib uns, ein Mensch liest deine Nachricht.',
    faq: 'Viele Antworten stehen schon in den <a>häufigen Fragen</a>.',
    emailButton: 'An {email} schreiben',
    topicsTitle: 'Für eine schnellere Antwort',
    topics: [
      {
        title: 'Konto und Anmeldung',
        text: 'Schreib von der E-Mail-Adresse deines Kontos und sag uns, was du auf dem Bildschirm siehst. Wir fragen nie nach deinem Passwort.',
      },
      {
        title: 'Ein Fehler in der App',
        text: 'Nenne deine Windows-Version, deine Grafikkarte, die App oder das Spiel, mit dem du {name} verwendest, und was du gerade getan hast, als es passierte.',
      },
      {
        title: 'Abo und Erstattungen',
        text: 'Nenne das Datum der Zahlung. Die Regeln stehen in der <refunds>Erstattungsrichtlinie</refunds>.',
      },
      {
        title: 'Deine Daten',
        text: 'Um Auskunft über deine Daten zu erhalten, sie zu berichtigen, zu exportieren oder zu löschen, genügt eine E-Mail: Wir antworten innerhalb eines Monats. Einzelheiten auf der <privacy>Datenschutzseite</privacy>.',
      },
    ],
  },
  creators: {
    title: 'Creator-Programm',
    description:
      'Streamer und Video-Creator: Hol dir {name} Premium kostenlos und frühen Zugang zu neuen Gesichtern und Stimmen.',
    badge: 'Creator-Programm',
    heading: 'Du erstellst Inhalte, <b>wir schenken dir Premium</b>.',
    lead: 'Du streamst oder machst Videos? Mach beim Creator-Programm von {name} mit und nutze kostenlos alles, was die App kann.',
    cta: 'Bewerben',
    offerTitle: 'Was wir Creatorn bieten',
    offers: [
      {
        title: 'Premium kostenlos',
        text: 'Alle Gesichter, alle Stimmen, eigene Gesichter und Stimmklonen, solange du im Programm bist. Ab dem Tag, an dem Premium startet.',
      },
      {
        title: 'Neuheiten vor allen anderen',
        text: 'Teste neue Gesichter und Stimmen vorab und sag uns, was du davon hältst.',
      },
      {
        title: 'Direkter Draht zum Team',
        text: 'Eine Frage, eine Idee, ein Problem mitten im Stream? Du sprichst direkt mit uns.',
      },
    ],
    whoTitle: 'Wer sich bewerben kann',
    who: [
      'Du veröffentlichst regelmäßig auf Twitch, YouTube, TikTok, Kick oder anderswo',
      'Du erreichst eine Mindestreichweite: Die genauen Kriterien teilen wir dir privat in unserer Antwort mit',
      'Deine Inhalte halten die Regeln der Plattform ein, auf der du veröffentlichst',
      'Du bist mindestens 18 Jahre alt',
    ],
    rulesTitle: 'Was wir dafür erwarten',
    rules: [
      'Sag deinem Publikum klar, dass du Premium kostenlos bekommen hast, wenn du {name} zeigst',
      'Halte die <terms>Nutzungsbedingungen</terms> ein: Gib dich nie als reale Person aus, um zu täuschen',
      'Sonst nichts: keine Video-Quote, kein Text zum Ablesen',
    ],
    formTitle: 'Bewerben',
    formLead:
      'Wir lesen jede Bewerbung und antworten per E-Mail. Nicht jede Bewerbung wird angenommen.',
  },
  creatorForm: {
    name: 'Name oder Nickname',
    platform: 'Hauptplattform',
    other: 'Andere',
    channelUrl: 'Link zu deinem Kanal',
    message: 'Erzähl uns von deinen Inhalten (optional)',
    submit: 'Bewerbung absenden',
    done: 'Bewerbung eingegangen. Wir antworten per E-Mail.',
    notice:
      'Wir verwenden diese Angaben nur, um deine Bewerbung zu prüfen und dir zu antworten. Sie werden nach 12 Monaten gelöscht. <a>Mehr erfahren</a>',
  },
  auth: {
    signInTitle: 'Anmelden',
    email: 'E-Mail-Adresse',
    password: 'Passwort',
    signIn: 'Anmelden',
    forgot: 'Passwort vergessen?',
    createAccount: 'Konto erstellen',
    continueWith: 'Weiter mit {provider}',
    or: 'oder',
    registerTitle: 'Konto erstellen',
    passwordNew: 'Passwort (mindestens 10 Zeichen)',
    register: 'Mein Konto erstellen',
    registerDone:
      'Fast geschafft: Öffne den Link, den wir dir gerade per E-Mail geschickt haben, um dein Konto zu aktivieren.',
    already: 'Schon registriert? <a>Anmelden</a>',
    forgotTitle: 'Passwort vergessen',
    forgotSubmit: 'Link anfordern',
    forgotDone:
      'Falls für diese Adresse ein Konto existiert, wurde gerade ein Link zum Zurücksetzen verschickt.',
    resetTitle: 'Neues Passwort',
    resetPassword: 'Neues Passwort (mindestens 10 Zeichen)',
    save: 'Speichern',
    resetDone: 'Passwort geändert. Alle deine Geräte wurden abgemeldet.',
    verifyTitle: 'E-Mail-Bestätigung',
    verifying: 'Wird geprüft…',
    verified: 'Adresse bestätigt. Du kannst dich jetzt anmelden.',
    signInLead: 'Schön, dass du wieder da bist. Deine Gesichter und Stimmen warten.',
    registerLead: 'Kostenlos und in weniger als einer Minute startklar.',
    registerDoneTitle: 'Schau in dein Postfach',
    showPassword: 'Passwort anzeigen',
    hidePassword: 'Passwort verbergen',
    showcaseTitle: 'Ein neues Gesicht, eine neue Stimme, <b>live</b>.',
    perks: [
      'Kostenlos starten, ohne Bankkarte',
      'Funktioniert mit Discord und deinen Spielen',
      'Dein Bild und deine Stimme verlassen nie deinen PC',
    ],
    statUsers: 'Nutzer',
    statApps: 'kompatible Apps',
    statLocal: 'auf deinem PC verarbeitet',
  },
  admin: {
    title: 'Dashboard',
    live: 'Live, alle 15 Sekunden aktualisiert',
    forbidden: 'Diese Seite ist Administratoren vorbehalten.',
    periods: { day: '24 Stunden', week: '7 Tage', month: '30 Tage', year: '12 Monate' },
    visitors: 'Besucher',
    views: 'Seitenaufrufe',
    signups: 'Neue Konten',
    applications: 'Creator-Bewerbungen',
    accounts: 'Konten',
    verified: 'Bestätigte Konten',
    activeToday: 'In den letzten 24 Stunden aktiv',
    premium: 'Premium-Abonnenten',
    total: 'im Zeitraum',
    topPages: 'Meistbesuchte Seiten',
    topReferrers: 'Woher die Besucher kommen',
    none: 'Noch nichts.',
    sections: {
      overview: 'Übersicht',
      audience: 'Reichweite',
      accounts: 'Konten',
      creators: 'Creator',
    },
    traffic: 'Besuche der Website',
    growth: 'Entwicklung der Kontenzahl',
    countries: 'Länder der Besucher',
    hours: 'Besuchszeiten',
    hoursNote: 'Seitenaufrufe nach Tageszeit, in deiner Zeitzone.',
    unknownCountry: 'Nicht zugeordnet',
    locationNote:
      'Das Land wird beim Besuch aus der IP-Adresse abgeleitet; die Adresse selbst wird nie gespeichert.',
    search: 'E-Mail suchen',
    bannedOnly: 'Nur sanktionierte',
    roleAdmin: 'Admin',
    unverified: 'Nicht bestätigt',
    joined: 'Registriert am {date}',
    lastSeen: 'zuletzt gesehen am {date}',
    banned: 'Gesperrt',
    suspendedUntil: 'Gesperrt bis {date}',
    ban: 'Sperren',
    unban: 'Sperre aufheben',
    sanction: 'Sanktion',
    permanent: 'Dauerhafte Sperre',
    suspension: 'Sperre, {period}',
    reason: 'Grund (wird der Person angezeigt)',
    confirm: 'Bestätigen',
    cancel: 'Abbrechen',
    consentNote:
      'Besucher und Seitenaufrufe zählen nur Personen, die der Reichweitenmessung zugestimmt haben.',
  },
  account: {
    title: 'Mein Konto',
    loading: 'Wird geladen…',
    plan: 'Abonnement',
    free: 'Kostenlos',
    premium: 'Premium',
    renews: 'Nächste Verlängerung: {date}',
    notOpen: 'Premium-Abonnements sind noch nicht geöffnet. <a>Tarife ansehen</a>',
    devices: 'Angemeldete Geräte',
    thisDevice: 'dieses Gerät',
    unknownIp: 'Unbekannte IP',
    seen: '{ip} · zuletzt gesehen am {date}',
    revoke: 'Abmelden',
    signOut: 'Abmelden',
    webBrowser: 'Webbrowser',
  },
  consent: {
    title: 'Reichweitenmessung',
    text: 'Mit deiner Zustimmung zählt ein anonymes Cookie die Besuche und zeigt uns, welche Seiten gelesen werden. Keine Werbung, keine Weitergabe an Dritte. <a>Mehr erfahren</a>',
    refuse: 'Ablehnen',
    accept: 'Akzeptieren',
  },
  notFound: {
    title: 'Seite nicht gefunden',
    text: 'Diese Adresse existiert nicht oder nicht mehr.',
    back: 'Zur Startseite',
  },
  errors: {
    invalid_credentials: 'E-Mail oder Passwort falsch.',
    email_not_verified: 'Bestätige zuerst deine Adresse über den Link in unserer E-Mail.',
    account_locked:
      'Zu viele Versuche. Versuch es in ein paar Minuten erneut oder setze dein Passwort zurück.',
    rate_limited: 'Zu viele Anfragen. Warte kurz, bevor du es erneut versuchst.',
    invalid_request:
      'Prüfe die Felder: eine gültige E-Mail und ein Passwort mit mindestens 10 Zeichen.',
    invalid_or_expired_token: 'Dieser Link ist nicht mehr gültig. Fordere einen neuen an.',
    network_error: 'Der Server ist nicht erreichbar. Prüfe deine Verbindung.',
    oauth_email_not_verified:
      'Dieses Google- oder Discord-Konto hat keine bestätigte E-Mail-Adresse. Bestätige sie dort und versuch es erneut.',
    oauth_invalid_state: 'Die Anmeldung ist abgelaufen. Versuch es erneut.',
    oauth_provider_error: 'Der Anmeldedienst hat nicht geantwortet. Versuch es erneut.',
    oauth_failed: 'Die Anmeldung ist fehlgeschlagen. Versuch es erneut.',
    account_banned: 'Dieses Konto ist gesperrt.',
    suspended: 'Konto gesperrt bis {date}. Grund: {reason}',
    banned: 'Konto dauerhaft gesperrt. Grund: {reason}',
    invalid_application:
      'Prüfe die Felder: ein Name, eine gültige E-Mail-Adresse und ein Link zu deinem Kanal, der mit https:// beginnt.',
    generic: 'Etwas ist schiefgelaufen. Versuch es später erneut.',
  },
};
