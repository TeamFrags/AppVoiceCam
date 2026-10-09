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
      '<b>La mesure d’audience du site</b>, seulement si tu l’acceptes : pages visitées et site de provenance, rattachés à un identifiant anonyme.',
    ],
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
    ],
    rightsTitle: 'Tes droits',
    rights:
      'Tu peux demander l’accès à tes données, leur rectification, leur suppression ou leur export en écrivant à <mail>{email}</mail>. Tu peux aussi saisir la CNIL (cnil.fr).',
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
    generic: 'Une erreur est survenue. Réessaie plus tard.',
  },
};
