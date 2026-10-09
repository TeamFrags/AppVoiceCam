import type { Messages } from './en';

export const fr: Messages = {
  meta: {
    description: '{name} change ton visage et ta voix en direct pour Discord et tes jeux.',
  },
  nav: {
    main: 'Navigation principale',
    skip: 'Aller au contenu',
    features: 'Fonctionnalités',
    pricing: 'Tarifs',
    faq: 'FAQ',
    download: 'Télécharger',
    signIn: 'Connexion',
    account: 'Mon compte',
    language: 'Langue',
  },
  footer: {
    privacy: 'Confidentialité',
    terms: 'Conditions',
    refunds: 'Remboursements',
    support: 'Assistance',
    creators: 'Créateurs',
    cookies: 'Gérer les cookies',
  },
  home: {
    live: 'Visage et voix en temps réel',
    lead: '{name} transforme ton visage et ta voix en direct, puis les envoie à Discord et à tes jeux comme une caméra et un micro ordinaires.',
    ctaRegister: 'Créer un compte gratuit',
    ctaFeatures: 'Voir les fonctionnalités',
    mascotAlt: '{mascot}, la mascotte de {name}',
    demoTitle: 'Un clic, et tu es quelqu’un d’autre',
    demoText:
      'Choisis un visage, choisis une voix : ce que tes amis voient et entendent change pendant que tu parles.',
    demoYou: 'Toi',
    demoThem: 'Ce qu’ils voient',
    demoAlt:
      'Illustration : à gauche l’image de ta webcam, à droite la même personne avec un autre visage et une autre voix.',
    appsTitle: 'Fonctionne là où tu joues et discutes',
    appsOther: 'Et toute application qui accepte une webcam ou un micro.',
    apps: {
      discord: 'Appels, streams et salons vocaux',
      roblox: 'Chat vocal et caméra dans tes expériences',
      valorant: 'Chat vocal avec ton équipe',
      fortnite: 'Chat vocal avec ton escouade',
      minecraft: 'Parle avec tes amis pendant que tu construis',
      teamspeak: 'Salons vocaux',
    },
    stepsTitle: 'Prêt en trois étapes',
    steps: [
      {
        title: 'Installe et connecte-toi',
        text: 'Télécharge {name} pour Windows et connecte-toi avec ton compte gratuit.',
      },
      {
        title: 'Choisis un visage et une voix',
        text: 'Pioche dans le catalogue. L’aperçu montre le résultat tout de suite.',
      },
      {
        title: 'Sélectionne-les dans ton application',
        text: 'Choisis « {camera} » et « {microphone} » comme caméra et micro dans Discord ou dans ton jeu.',
      },
    ],
    featuresTitle: 'Ce que fait {name}',
    features: [
      {
        title: 'Un nouveau visage, en direct',
        text: 'Choisis un visage dans le catalogue : il suit tes expressions en temps réel devant ta webcam.',
      },
      {
        title: 'Une nouvelle voix, sans décalage',
        text: 'Ta voix est transformée pendant que tu parles, pensée pour rester fluide en pleine partie.',
      },
      {
        title: 'Compatible avec tes applications',
        text: 'Sélectionne « {camera} » et « {microphone} » comme caméra et micro, là où tu en as besoin.',
      },
      {
        title: 'Tout se passe sur ton PC',
        text: 'Ta caméra et ton micro sont traités sur ta machine. Ton image et ta voix ne nous sont pas envoyées.',
      },
    ],
    pricingTitle: 'Gratuit pour commencer',
    pricingText:
      'Quelques visages et voix sont offerts. Le Premium débloque tout le catalogue, les visages personnalisés et le clonage de voix.',
    pricingCta: 'Comparer les offres',
  },
  features: {
    title: 'Fonctionnalités',
    description:
      'Changement de visage et de voix en temps réel, caméra et micro virtuels, profils de performance : tout ce que fait {name}.',
    lead: '{name} s’installe sur Windows et se place entre ta webcam, ton micro et tes applications.',
    groups: [
      {
        title: 'Visage',
        items: [
          'Visages prédéfinis prêts à l’emploi',
          'Visages personnalisés à partir d’une photo que tu as le droit d’utiliser (Premium)',
          'Suivi des expressions en temps réel',
        ],
      },
      {
        title: 'Voix',
        items: [
          'Voix prédéfinies prêtes à l’emploi',
          'Clonage d’une voix que tu as le droit d’utiliser (Premium)',
          'Transformation pendant que tu parles',
        ],
      },
      {
        title: 'Caméra et micro virtuels',
        items: [
          '« {camera} » et « {microphone} » apparaissent dans la liste de tes périphériques',
          'Compatible avec {apps}',
          'Et avec toute application qui utilise une webcam ou un micro standard',
        ],
      },
      {
        title: 'Performance',
        items: [
          'Utilise ta carte graphique quand elle est disponible, ton processeur sinon',
          'Trois profils : performance maximale, équilibré, économie de ressources',
          'Affichage optionnel des images par seconde et de la latence',
        ],
      },
      {
        title: 'Compte et sécurité',
        items: [
          'Liste de tes appareils connectés, avec déconnexion à distance',
          'Catalogue de visages et de voix mis à jour sans réinstaller l’application',
          'Mises à jour signées et vérifiées avant installation',
        ],
      },
    ],
    note: 'L’application est en cours de développement : certaines fonctionnalités arriveront après la première version. <a>Crée ton compte</a> pour être prêt au lancement.',
  },
  pricing: {
    title: 'Tarifs',
    description:
      '{name} est gratuit pour commencer. Le Premium à {price} par mois débloque tous les visages, toutes les voix et le clonage de voix.',
    lead: 'Commence gratuitement. Passe au Premium quand tu veux, annule quand tu veux.',
    free: 'Gratuit',
    freeItems: [
      'Une sélection de visages prédéfinis',
      'Une sélection de voix prédéfinies',
      'Caméra et micro virtuels',
      'Tous les profils de performance',
    ],
    freeCta: 'Créer un compte',
    premium: 'Premium',
    perMonth: '/ mois',
    premiumItems: [
      'Tous les visages du catalogue',
      'Toutes les voix du catalogue',
      'Création de visages personnalisés',
      'Clonage de voix',
      'Fonctionnalités avancées',
    ],
    soon: 'Bientôt disponible',
    note: 'Les abonnements ne sont pas encore ouverts. Prix TTC, sans engagement.',
  },
  faq: {
    title: 'Questions fréquentes',
    description:
      'Compatibilité, configuration, confidentialité, abonnement : les réponses aux questions sur {name}.',
    items: [
      {
        q: 'Avec quelles applications {name} fonctionne-t-il ?',
        a: 'Avec {apps} et, plus largement, toute application qui laisse choisir sa webcam ou son micro. Il suffit de sélectionner « {camera} » et « {microphone} » dans ses réglages.',
      },
      {
        q: 'Quelle configuration faut-il ?',
        a: 'Un PC sous Windows. Une carte graphique récente donne la meilleure fluidité ; sans elle, l’application bascule sur le processeur avec un profil allégé.',
      },
      {
        q: 'Mon image et ma voix sont-elles envoyées sur vos serveurs ?',
        a: 'Non. La transformation se fait sur ton PC. Nos serveurs gèrent ton compte, ton abonnement et le téléchargement des visages et des voix.',
      },
      {
        q: 'Puis-je utiliser le visage ou la voix de quelqu’un d’autre ?',
        a: 'Uniquement avec son autorisation. Se faire passer pour une personne réelle afin de tromper, harceler ou escroquer est interdit et entraîne le bannissement du compte.',
      },
      {
        q: 'Faut-il un compte ?',
        a: 'Oui, l’application demande de se connecter. Le compte est gratuit.',
      },
      {
        q: 'Combien coûte le Premium ?',
        a: '{price} par mois, sans engagement. Il débloque tout le catalogue, les visages personnalisés et le clonage de voix.',
      },
      {
        q: 'Comment supprimer mon compte ou récupérer mes données ?',
        a: 'Écris-nous à {email} : nous traitons la demande et te répondons sous un mois.',
      },
    ],
  },
  download: {
    title: 'Télécharger {name}',
    description: 'Télécharger {name} pour Windows.',
    soonTitle: 'Bientôt disponible',
    text: 'L’application est en cours de développement. Crée ton compte dès maintenant : il te servira à te connecter dès la sortie.',
    button: 'Télécharger pour Windows',
    cta: 'Créer un compte',
  },
  privacy: {
    title: 'Confidentialité et cookies',
    description:
      'Quelles données {name} collecte, pourquoi, combien de temps, et comment exercer tes droits.',
    controllerTitle: 'Qui est responsable de tes données',
    publisherFallback: 'L’éditeur de {name}',
    contact: 'Contact :',
    collectTitle: 'Ce que nous collectons',
    collect: [
      '<b>Ton compte</b> : adresse e-mail et mot de passe (conservé uniquement sous forme hachée, jamais en clair).',
      '<b>Tes connexions</b> : nom de l’appareil, adresse IP et date, pour te montrer tes sessions actives et détecter une connexion suspecte.',
      '<b>La mesure d’audience du site</b>, seulement si tu l’acceptes : pages visitées, site de provenance, date et heure de la visite, et pays (déduit de ton adresse IP, qui n’est pas enregistrée), rattachés à un identifiant anonyme.',
      '<b>La connexion avec Google ou Discord</b>, si tu la choisis : l’adresse e-mail et l’identifiant de compte que ce service nous transmet. Nous ne recevons jamais ton mot de passe.',
      '<b>Les candidatures au programme créateurs</b> : le nom, l’adresse e-mail, le lien de chaîne et le message saisis dans le formulaire.',
    ],
    basisTitle: 'Ce qui nous autorise à les utiliser',
    basis: [
      'Compte et connexions : fournir le service auquel tu t’es inscrit, et notre intérêt légitime à protéger les comptes.',
      'Mesure d’audience : ton consentement, que tu peux retirer à tout moment.',
      'Candidatures créateurs : répondre à une demande que tu as faite, avant tout partenariat.',
    ],
    recipientsTitle: 'Qui les reçoit',
    recipients:
      'Tes données ne sont jamais vendues. Elles ne sont traitées que par les prestataires qui hébergent le service et acheminent nos e-mails, sur nos instructions.',
    noMedia:
      'Nous ne collectons ni l’image de ta caméra ni le son de ton micro : la transformation se fait sur ton PC.',
    cookiesTitle: 'Cookies',
    table: { name: 'Nom', role: 'Rôle', duration: 'Durée', consent: 'Consentement' },
    rt: {
      role: 'Te garder connecté. Illisible par les scripts de la page.',
      duration: '30 jours',
      consent: 'Non requis (nécessaire au service)',
    },
    vid: {
      role: 'Identifiant anonyme pour compter les visites.',
      duration: '13 mois',
      consent: 'Requis : déposé seulement si tu acceptes',
    },
    choice:
      'Ton choix est mémorisé six mois dans ton navigateur, puis redemandé. Aucun cookie publicitaire, aucun outil de mesure tiers. Tu peux changer d’avis à tout moment : <manage>Gérer les cookies</manage>.',
    retentionTitle: 'Durées de conservation',
    retention: [
      'Compte : jusqu’à sa suppression.',
      'Mesure d’audience : 25 mois, puis suppression automatique.',
      'Candidatures créateurs : 12 mois, puis suppression automatique.',
    ],
    rightsTitle: 'Tes droits',
    rights:
      'Tu peux demander l’accès à tes données, leur rectification, leur suppression ou leur export en écrivant à <mail>{email}</mail>. Tu peux aussi saisir la CNIL (cnil.fr).',
  },
  legal: {
    updated: 'Dernière mise à jour : {date}',
  },
  terms: {
    title: 'Conditions d’utilisation',
    description:
      'Les règles d’utilisation de {name} : ton compte, ce qui est permis, Premium et tes droits.',
    sections: [
      {
        title: 'Le service',
        body: [
          '{name} est une application Windows qui change ton visage et ta voix en direct et les envoie à tes autres applications comme une caméra et un micro ordinaires. Ces conditions s’appliquent dès que tu crées un compte ou que tu utilises l’application ou ce site.',
          'L’application est encore en développement : des fonctions peuvent changer, apparaître ou être retirées.',
        ],
      },
      {
        title: 'Ton compte',
        body: [
          'Il faut un compte pour utiliser l’application. Donne une adresse e-mail que tu consultes, garde ton mot de passe pour toi et préviens-nous vite si tu penses que quelqu’un d’autre utilise ton compte.',
          'Tu dois avoir au moins 15 ans. Si tu as moins de 18 ans, il te faut l’accord d’un parent ou de ton représentant légal.',
        ],
      },
      {
        title: 'Ce qui est permis',
        body: [
          'N’utilise que des visages et des voix que tu as le droit d’utiliser. Les visages personnalisés et les voix clonées exigent l’accord de la personne à qui ils appartiennent.',
          'Il est interdit de te faire passer pour une personne réelle afin de tromper, harceler, escroquer ou nuire, de créer des contenus illégaux, ou de contourner les limites de ton offre ou les protections de l’application.',
          'Tu restes responsable du respect des règles des applications et des jeux avec lesquels tu utilises {name}.',
        ],
      },
      {
        title: 'Gratuit et Premium',
        body: [
          'L’offre gratuite donne accès à une sélection de visages et de voix. Premium coûte {price} par mois et débloque le reste. Les abonnements ne sont pas encore ouverts : le prix et les conditions seront affichés avant tout paiement.',
          'Les résiliations et les remboursements sont décrits dans notre <refunds>politique de remboursement</refunds>.',
        ],
      },
      {
        title: 'Suspension et fermeture du compte',
        body: [
          'Si ces conditions ne sont pas respectées, nous pouvons suspendre ou bannir le compte. Le motif est affiché quand tu essaies de te connecter, et tu peux le contester en écrivant à <mail>{email}</mail>.',
          'Tu peux nous demander de supprimer ton compte à tout moment à la même adresse.',
        ],
      },
      {
        title: 'Propriété',
        body: [
          'L’application, son catalogue de visages et de voix, la marque et ce site nous appartiennent. Ton compte te donne un droit d’utilisation personnel, que tu ne peux ni revendre ni céder.',
          'Ce que tu crées avec {name} reste à toi.',
        ],
      },
      {
        title: 'Disponibilité et responsabilité',
        body: [
          'Nous faisons de notre mieux pour que le service fonctionne, sans pouvoir promettre qu’il ne sera jamais interrompu. Nous ne sommes pas responsables de la façon dont une application ou un jeu tiers réagit à la caméra ou au micro virtuels.',
          'Rien dans ces conditions ne retire les droits que la loi te donne en tant que consommateur, notamment la garantie légale de conformité.',
        ],
      },
      {
        title: 'Modification de ces conditions',
        body: [
          'Si nous changeons un point important, nous te prévenons par e-mail ou sur ce site avant qu’il s’applique. Si tu n’es pas d’accord, tu peux fermer ton compte.',
        ],
      },
      {
        title: 'Droit applicable et contact',
        body: [
          'Ces conditions sont soumises au droit français. Si tu vis dans un autre pays de l’Union européenne, tu gardes la protection des règles impératives de ton pays.',
          'Une question ou une réclamation ? Écris à <mail>{email}</mail> ou consulte la <support>page d’assistance</support>. L’usage de tes données est décrit sur la <privacy>page confidentialité</privacy>.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Politique de remboursement',
    description: 'Quand et comment obtenir le remboursement d’un paiement {name} Premium.',
    sections: [
      {
        title: 'En bref',
        body: [
          'L’offre gratuite ne coûte rien : il n’y a rien à rembourser. Les abonnements Premium ne sont pas encore ouverts : cette politique s’appliquera dès leur ouverture.',
        ],
      },
      {
        title: '14 jours pour changer d’avis',
        body: [
          'Tu as 14 jours à compter de ton premier paiement Premium pour demander un remboursement intégral, sans donner de raison.',
        ],
      },
      {
        title: 'Résiliation et renouvellements',
        body: [
          'Tu peux résilier quand tu veux. Premium reste alors actif jusqu’à la fin de la période déjà payée, et plus aucun paiement n’est prélevé.',
          'Une période commencée n’est pas remboursée en partie, sauf dans les cas ci-dessous ou lorsque la loi l’impose.',
        ],
      },
      {
        title: 'Paiement prélevé par erreur',
        body: [
          'Un paiement prélevé deux fois, ou prélevé après ta résiliation, est remboursé en totalité.',
          'Si Premium ne fonctionne plus de notre fait pendant longtemps, écris-nous : nous remboursons le temps perdu.',
        ],
      },
      {
        title: 'Comment demander',
        body: [
          'Écris à <mail>{email}</mail> depuis l’adresse e-mail de ton compte, en indiquant la date du paiement. Nous répondons par e-mail, et un remboursement accepté est renvoyé sur le moyen de paiement utilisé sous 14 jours.',
          'Voir aussi les <terms>conditions d’utilisation</terms>.',
        ],
      },
    ],
  },
  support: {
    title: 'Assistance',
    description:
      'Obtenir de l’aide pour {name} : compte, installation, abonnement et données personnelles.',
    lead: 'Un problème ou une question ? Écris-nous, une personne lira ton message.',
    faq: 'Beaucoup de réponses sont déjà dans la <a>FAQ</a>.',
    emailButton: 'Écrire à {email}',
    topicsTitle: 'Pour une réponse plus rapide',
    topics: [
      {
        title: 'Compte et connexion',
        text: 'Écris depuis l’adresse e-mail de ton compte et dis-nous ce que tu vois à l’écran. Nous ne demandons jamais ton mot de passe.',
      },
      {
        title: 'Un bug dans l’application',
        text: 'Indique ta version de Windows, ta carte graphique, l’application ou le jeu avec lequel tu utilises {name}, et ce que tu faisais quand c’est arrivé.',
      },
      {
        title: 'Abonnement et remboursements',
        text: 'Donne la date du paiement. Les règles sont dans la <refunds>politique de remboursement</refunds>.',
      },
      {
        title: 'Tes données',
        text: 'Pour accéder à tes données, les corriger, les exporter ou les supprimer, un simple e-mail suffit : nous répondons sous un mois. Détails sur la <privacy>page confidentialité</privacy>.',
      },
    ],
  },
  creators: {
    title: 'Programme créateurs',
    description:
      'Streamers et vidéastes : recevez {name} Premium gratuitement et un accès anticipé aux nouveaux visages et aux nouvelles voix.',
    badge: 'Programme créateurs',
    heading: 'Tu crées, <b>on t’offre Premium</b>.',
    lead: 'Tu streames ou tu fais des vidéos ? Rejoins le programme créateurs {name} et profite gratuitement de tout ce que l’application sait faire.',
    cta: 'Candidater',
    offerTitle: 'Ce qu’on offre aux créateurs',
    offers: [
      {
        title: 'Premium offert',
        text: 'Tous les visages, toutes les voix, les visages personnalisés et le clonage de voix, tant que tu fais partie du programme. Dès l’ouverture de Premium.',
      },
      {
        title: 'Les nouveautés avant tout le monde',
        text: 'Essaie les nouveaux visages et les nouvelles voix en avance, et dis-nous ce que tu en penses.',
      },
      {
        title: 'Un contact direct avec l’équipe',
        text: 'Une question, une idée, un souci en plein live ? Tu nous parles directement.',
      },
    ],
    whoTitle: 'Qui peut candidater',
    who: [
      'Tu publies régulièrement sur Twitch, YouTube, TikTok, Kick ou ailleurs',
      'Tu atteins une audience minimale : on te communique les critères précis en privé, dans notre réponse',
      'Ton contenu respecte les règles de la plateforme où tu publies',
      'Tu as au moins 18 ans',
    ],
    rulesTitle: 'Ce qu’on demande en retour',
    rules: [
      'Dire clairement à ton public que Premium t’a été offert quand tu montres {name}',
      'Respecter les <terms>conditions d’utilisation</terms> : ne jamais te faire passer pour une personne réelle afin de tromper',
      'Rien d’autre : pas de quota de vidéos, pas de texte à réciter',
    ],
    formTitle: 'Candidater',
    formLead:
      'Nous lisons chaque candidature et répondons par e-mail. Toutes les candidatures ne sont pas acceptées.',
  },
  creatorForm: {
    name: 'Nom ou pseudo',
    platform: 'Plateforme principale',
    other: 'Autre',
    channelUrl: 'Lien vers ta chaîne',
    message: 'Parle-nous de ton contenu (facultatif)',
    submit: 'Envoyer ma candidature',
    done: 'Candidature reçue. Nous te répondons par e-mail.',
    notice:
      'Nous utilisons ces informations uniquement pour étudier ta candidature et te répondre. Elles sont supprimées au bout de 12 mois. <a>En savoir plus</a>',
  },
  auth: {
    signInTitle: 'Connexion',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    signIn: 'Se connecter',
    forgot: 'Mot de passe oublié ?',
    createAccount: 'Créer un compte',
    continueWith: 'Continuer avec {provider}',
    or: 'ou',
    registerTitle: 'Créer un compte',
    passwordNew: 'Mot de passe (10 caractères minimum)',
    register: 'Créer mon compte',
    registerDone:
      'Presque fini : ouvre le lien que nous venons de t’envoyer par e-mail pour activer ton compte.',
    already: 'Déjà inscrit ? <a>Connexion</a>',
    forgotTitle: 'Mot de passe oublié',
    forgotSubmit: 'Recevoir le lien',
    forgotDone:
      'Si un compte existe pour cette adresse, un lien de réinitialisation vient de lui être envoyé.',
    resetTitle: 'Nouveau mot de passe',
    resetPassword: 'Nouveau mot de passe (10 caractères minimum)',
    save: 'Enregistrer',
    resetDone: 'Mot de passe modifié. Tous tes appareils ont été déconnectés.',
    verifyTitle: 'Confirmation de l’adresse',
    verifying: 'Vérification en cours…',
    verified: 'Adresse confirmée. Tu peux te connecter.',
    signInLead: 'Content de te revoir. Tes visages et tes voix t’attendent.',
    registerLead: 'Gratuit, et prêt en moins d’une minute.',
    registerDoneTitle: 'Regarde ta boîte mail',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    showcaseTitle: 'Un nouveau visage, une nouvelle voix, <b>en direct</b>.',
    perks: [
      'Gratuit pour commencer, sans carte bancaire',
      'Fonctionne avec Discord et tes jeux',
      'Ton image et ta voix ne quittent jamais ton PC',
    ],
    statUsers: 'utilisateurs',
    statApps: 'applications compatibles',
    statLocal: 'traité sur ton PC',
  },
  admin: {
    title: 'Tableau de bord',
    live: 'En direct, actualisé toutes les 15 secondes',
    forbidden: 'Cette page est réservée aux administrateurs.',
    periods: { day: '24 heures', week: '7 jours', month: '30 jours', year: '12 mois' },
    visitors: 'Visiteurs',
    views: 'Pages vues',
    signups: 'Nouveaux comptes',
    applications: 'Candidatures créateurs',
    accounts: 'Comptes',
    verified: 'Comptes vérifiés',
    activeToday: 'Actifs ces dernières 24 heures',
    premium: 'Abonnés Premium',
    total: 'sur la période',
    topPages: 'Pages les plus vues',
    topReferrers: 'D’où viennent les visiteurs',
    none: 'Rien pour l’instant.',
    sections: {
      overview: 'Vue d’ensemble',
      audience: 'Audience',
      accounts: 'Comptes',
      creators: 'Créateurs',
    },
    traffic: 'Fréquentation du site',
    growth: 'Évolution du nombre de comptes',
    countries: 'Pays des visiteurs',
    hours: 'Heures de visite',
    hoursNote: 'Pages vues par heure de la journée, dans ton fuseau horaire.',
    unknownCountry: 'Non localisé',
    locationNote:
      'Le pays est déduit de l’adresse IP au moment de la visite ; l’adresse elle-même n’est jamais enregistrée.',
    search: 'Rechercher un e-mail',
    bannedOnly: 'Sanctionnés uniquement',
    roleAdmin: 'Admin',
    unverified: 'Non vérifié',
    joined: 'Inscrit le {date}',
    lastSeen: 'vu le {date}',
    banned: 'Banni',
    suspendedUntil: 'Suspendu jusqu’au {date}',
    ban: 'Bannir',
    unban: 'Lever la sanction',
    sanction: 'Sanction',
    permanent: 'Bannissement définitif',
    suspension: 'Suspension, {period}',
    reason: 'Motif (montré à la personne)',
    confirm: 'Confirmer',
    cancel: 'Annuler',
    consentNote:
      'Les visiteurs et les pages vues ne comptent que les personnes qui ont accepté la mesure d’audience.',
  },
  account: {
    title: 'Mon compte',
    loading: 'Chargement…',
    plan: 'Abonnement',
    free: 'Gratuit',
    premium: 'Premium',
    renews: 'Prochaine échéance : {date}',
    notOpen: 'Les abonnements Premium ne sont pas encore ouverts. <a>Voir les offres</a>',
    devices: 'Appareils connectés',
    thisDevice: 'cet appareil',
    unknownIp: 'IP inconnue',
    seen: '{ip} · vu le {date}',
    revoke: 'Déconnecter',
    signOut: 'Se déconnecter',
    webBrowser: 'Navigateur web',
  },
  consent: {
    title: 'Mesure d’audience',
    text: 'Avec ton accord, un cookie anonyme nous permet de compter les visites et de savoir quelles pages sont lues. Aucune publicité, aucun partage avec des tiers. <a>En savoir plus</a>',
    refuse: 'Refuser',
    accept: 'Accepter',
  },
  notFound: {
    title: 'Page introuvable',
    text: 'Cette adresse n’existe pas ou n’existe plus.',
    back: 'Retour à l’accueil',
  },
  errors: {
    invalid_credentials: 'E-mail ou mot de passe incorrect.',
    email_not_verified: 'Confirme d’abord ton adresse grâce au lien reçu par e-mail.',
    account_locked:
      'Trop de tentatives. Réessaie dans quelques minutes ou réinitialise ton mot de passe.',
    rate_limited: 'Trop de demandes. Patiente un peu avant de réessayer.',
    invalid_request: 'Vérifie les champs : e-mail valide et mot de passe de 10 caractères minimum.',
    invalid_or_expired_token: 'Ce lien n’est plus valable. Demandes-en un nouveau.',
    network_error: 'Impossible de joindre le serveur. Vérifie ta connexion.',
    oauth_email_not_verified:
      'Ce compte Google ou Discord n’a pas d’adresse e-mail vérifiée. Vérifie-la chez lui, puis réessaie.',
    oauth_invalid_state: 'La connexion a expiré. Réessaie.',
    oauth_provider_error: 'Le service de connexion n’a pas répondu. Réessaie.',
    oauth_failed: 'La connexion a échoué. Réessaie.',
    account_banned: 'Ce compte est banni ou suspendu.',
    suspended: 'Compte suspendu jusqu’au {date}. Motif : {reason}',
    banned: 'Compte banni. Motif : {reason}',
    invalid_application:
      'Vérifie les champs : un nom, un e-mail valide et un lien vers ta chaîne commençant par https://.',
    generic: 'Une erreur est survenue. Réessaie plus tard.',
  },
};
