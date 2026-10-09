# Ce qui manque

État au 8 octobre 2026. Ce fichier liste tout ce qui sépare le projet d'un produit vendable :
ce que toi seul peux fournir, ce qui reste à développer, et ce qui est écrit mais jamais essayé
en conditions réelles. L'état de ce qui est fait est dans [architecture.md](architecture.md).

## 1. Ce que toi seul peux fournir

Rien de ceci ne peut être fait à ta place : ce sont des comptes, des achats ou des décisions.

| Quoi | Pourquoi | Où ça se branche |
| --- | --- | --- |
| **Nom définitif et domaine** | « Kitsuvox » ne te plaît pas. Noms libres en .com à cette date : `mirrovox`, `morphelo`, `shiftox`, `mimikio`, `morphoon`, `voxifa`. Tester une idée : `npm run brand:check -- monidee` | `brand/brand.json`, puis `npm run brand` |
| **Recherche de marque** | Vérifier qu'aucune marque déposée ne porte ce nom (INPI, EUIPO) | — |
| **Identifiants Google** | Connexion « Continuer avec Google ». Console Google Cloud → Identifiants → ID client OAuth (application Web). URI de redirection : `https://api.<domaine>/v1/auth/oauth/google/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` dans `/etc/newapp/api.env` |
| **Identifiants Discord** | Connexion « Continuer avec Discord ». Portail développeur Discord → OAuth2. Redirection : `https://api.<domaine>/v1/auth/oauth/discord/callback` | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| **Boîte d'envoi d'e-mails** | Confirmation d'adresse, mot de passe oublié, alerte de connexion | `SMTP_URL`, `MAIL_FROM` |
| **Certificat d'origine Cloudflare** | HTTPS entre Cloudflare et le VPS | `/etc/newapp/tls/` |
| **Compte Stripe** | Abonnement Premium | Phase 7 |
| **Certificat de signature de code Windows** | Sans lui, Windows affiche « éditeur inconnu » à l'installation et les antivirus se méfient. Il sert aussi à signer les mises à jour | Phase 12 |
| **Identité de l'éditeur** | Nom ou société, adresse : obligatoire dans les mentions légales | `NEXT_PUBLIC_LEGAL_PUBLISHER` |
| **Relecture juridique** | Confidentialité, CGU, CGV. Les visages et les voix sont des données biométriques au sens du RGPD : une analyse d'impact est à prévoir avant d'ouvrir les visages personnalisés et le clonage de voix | — |
| **Place sur le disque** | L'espace libre de `C:` est descendu à 4,6 Go pendant la compilation du logiciel (il était remonté à 22 Go ensuite). Les modèles IA et leurs outils demanderont plusieurs dizaines de Go | — |
| **Une webcam** | Aucune caméra n'est détectée sur ce PC : impossible d'y essayer la capture ni, plus tard, le changement de visage | — |

## 2. Les trois vrais obstacles techniques

Ce sont les parties difficiles du produit. Aucune n'est commencée.

### Les modèles d'IA

Le logiciel n'a aucun modèle : il ne transforme encore ni visage ni voix.

- **Licences.** Le modèle de visage utilisé par Deep-Live-Cam (`inswapper`) est publié pour un
  usage non commercial. Le vendre dans un abonnement demande une licence commerciale, ou un autre
  modèle. Même question pour les modèles de voix. C'est à trancher avant d'écrire le pipeline.
- **Qui fournit les visages et les voix du catalogue**, et avec quels droits (accord écrit de
  chaque personne dont le visage ou la voix est proposé).
- **Moteur d'inférence** : ONNX Runtime avec la carte graphique (ta RTX 3060 convient pour
  développer), repli sur le processeur.

### La caméra virtuelle

Pour que Discord voie « Nom Camera », il faut un périphérique système.

- Windows 11 fournit une API officielle sans pilote à signer : c'est la voie prévue.
- Windows 10 exige un composant de type DirectShow ou un pilote : à décider si on le supporte.

### Le micro virtuel

C'est le point le plus dur. Un micro virtuel est un pilote audio noyau, et Windows n'accepte que
les pilotes signés par Microsoft, ce qui demande un certificat EV et une procédure de validation.
Deux voies : développer et faire signer un pilote, ou s'appuyer sur un pilote existant sous
licence (type VB-Cable, déjà présent sur ton PC avec VoiceMeeter) en négociant sa redistribution.

## 3. Ce qui reste à développer, par phase

| Phase | Manque |
| --- | --- |
| 2 — Logiciel, capture | Fait : connexion obligatoire, Google/Discord, capture caméra et micro avec aperçu. Manque : choix de la résolution, profils de performance, statistiques processeur / carte graphique / mémoire, réglages persistants |
| 3 — Visage temps réel | Tout (voir « modèles d'IA ») |
| 4 — Voix temps réel | Tout |
| 5 — Caméra et micro virtuels | Tout (voir ci-dessus) |
| 6 — Modèles servis par le serveur | Catalogue, versions, téléchargement signé et vérifié, cache, reprise, stockage Cloudflare R2 |
| 7 — Premium | Stripe : paiement, webhooks, annulation, échecs de paiement. La table et le calcul des droits existent déjà |
| 8 — Site | Pages Visages, Voix, Documentation ; mentions légales, CGU ; image de partage (Open Graph) |
| 9 — Espace utilisateur | Historique de paiement, annulation, suppression de compte et export des données (RGPD) depuis le site |
| 10 — Admin | Tout l'écran d'administration. Existent déjà côté API : bannir, débannir, chiffres d'audience. Manquent : liste des utilisateurs, sessions en direct, revenus, erreurs, versions |
| 11 — Sécurité avancée | Liaison du jeton à l'appareil, Authenticated Origin Pulls, détection d'abus, règles Cloudflare |
| 12 — Mise en production | Fait : mises à jour automatiques signées, publiées par GitHub (voir [deployment.md](deployment.md)). Manque : déploiement progressif, mise à jour forcée, retour arrière, configuration à distance, rapports de plantage, sauvegardes de la base |

Aussi absents : aucune version macOS ou Linux. Le site est en anglais, français, espagnol,
portugais et allemand, le logiciel aussi (anglais par défaut, menu de langue en bas à gauche).
Ces traductions n'ont pas été relues par des natifs. Les e-mails envoyés par l'API sont encore
en français uniquement.

## 4. Écrit mais jamais essayé en conditions réelles

| Élément | Ce qui a été vérifié | Ce qui ne l'a pas été |
| --- | --- | --- |
| Connexion Google et Discord | Tout le parcours côté serveur avec un faux fournisseur (15 tests) ; le serveur local du logiciel qui reçoit le code | Un vrai aller-retour chez Google ou Discord : il faut les identifiants |
| Capture caméra | Le code compile ; l'encodage de l'aperçu est testé | **Aucune caméra n'est détectée sur ce PC** : la capture n'a jamais tourné |
| Capture micro | Trois micros sont bien listés ; le calcul du niveau est testé | Le micro n'a pas été ouvert pendant les tests (volontairement) |
| Fenêtre du logiciel | Elle s'ouvre ; chaque écran a été affiché dans un navigateur avec un faux moteur | Personne n'a encore cliqué dans la vraie fenêtre |
| Scripts du VPS | Syntaxe ; installation de l'archive simulée sur le PC | Jamais exécutés sur le serveur |
| PostgreSQL et Redis réels | — | Tous les tests tournent sur une base embarquée et un store mémoire |
| Envoi d'e-mails | Le texte des messages | Aucun envoi réel |
| `.htaccess` du site | — | Jamais servi par un vrai Apache |
| Mises à jour du logiciel | Le logiciel compile ; l'installateur est signé et son manifeste généré sur ce PC | Aucune mise à jour réelle : ni le workflow GitHub, ni le téléchargement et l'installation d'une version publiée |

## 5. Protection du code : où on en est, honnêtement

Ta crainte sur l'asar était fondée : une archive asar se décompresse en une commande et rend le
code source tel quel. Le logiciel n'utilise donc pas Electron.

Ce qui est en place :

- le cœur (connexion, session, capture, et demain le pipeline IA) est écrit en Rust et compilé
  en code machine, sans noms de symboles, optimisé d'un seul bloc ;
- les identifiants ne quittent jamais ce cœur : le jeton longue durée est dans le Gestionnaire
  d'identification Windows, l'interface n'y a pas accès ;
- l'interface (HTML/JS) est embarquée dans l'exécutable. Elle reste lisible par quelqu'un de
  motivé, c'est pourquoi elle ne contient que de l'affichage ;
- aucun secret n'est compilé dans le logiciel : pas de clé d'API, pas de clé Stripe.

Vérifié sur l'exécutable optimisé (6,1 Mo ; installateur de 2,2 Mo) avec
`npm run inspect -w desktop`, qui y cherche du texte lisible :

| Recherché | Trouvé |
| --- | --- |
| Noms de fonctions et de types internes | Aucun |
| Texte de l'interface en clair | Aucun (elle est compressée dans l'exécutable) |
| Noms de secrets (clés, mots de passe) | Aucun |
| Chemins de ton PC (dossier utilisateur, dossier du projet) | Aucun, après correction : la première compilation les contenait |
| Noms des fichiers source (`src\api.rs`…) | Présents : Rust les garde pour ses messages de plantage. Ils révèlent le découpage en fichiers, pas le code |
| Noms des commandes (`sign_in_with`, `start_camera`…) | Présents : l'interface les appelle par leur nom |

C'est une recherche de texte, pas un audit : elle montre ce qu'un curieux trouve en cinq minutes,
pas ce qu'un spécialiste obtient avec un désassembleur.

Ce qu'aucune technique ne permet : empêcher un attaquant déterminé de désassembler un programme
qui tourne sur sa machine. La vraie protection est donc ailleurs, et elle reste à construire :

- les modèles ne seront remis qu'aux comptes autorisés, par le serveur (phase 6) ;
- le Premium est décidé par le serveur à chaque appel : modifier le logiciel ne le débloque pas ;
- signature du code et vérification d'intégrité au démarrage (phase 12) ;
- un modèle téléchargé peut toujours être extrait de la mémoire : le système doit limiter la
  valeur d'un modèle volé (versions, révocation, marquage), pas prétendre l'empêcher.

## 6. Limites connues de ce qui existe

- Si deux instances du logiciel tournent en même temps sur le même compte Windows, elles se
  disputent le même jeton et l'une des deux sera déconnectée.
- Le logiciel interroge le serveur toutes les 60 secondes : un bannissement met donc jusqu'à
  une minute à s'afficher (il est effectif immédiatement côté serveur).
- L'aperçu caméra passe par des images JPEG envoyées à l'interface : suffisant pour un aperçu,
  pas pour le traitement, qui se fera entièrement dans le cœur.
- Trois tests de l'API ont échoué une fois sur une machine chargée, puis sont repassés après
  allongement du délai. Cause probable, non prouvée : lenteur au démarrage de la base de test.
