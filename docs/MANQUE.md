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

Ce sont les parties difficiles du produit. Seul le visage est commencé.

### Les modèles d'IA

Le changement de visage fonctionne depuis le 9 octobre 2026 (`desktop/src-tauri/src/face.rs`) :
on choisit une photo, le visage est remplacé sur la caméra ou sur une photo d'essai. Les trois
modèles (745 Mo) s'installent avec `npm run models -w desktop`. Mesuré sur la RTX 3060 :
environ 65 ms par image en 1280 × 720, soit une quinzaine d'images par seconde.

Le clonage de voix fonctionne depuis le 9 octobre 2026 (`desktop/src-tauri/src/voice.rs`) : on
choisit une voix de la bibliothèque, et le micro est rejoué avec cette voix dans le retour audio.
Deux modèles d'OpenVoice V2 (160 Mo, licence MIT), installés par la même commande. Mesuré sur la
RTX 3060 : 20 à 60 ms de calcul par bloc de 93 ms, soit environ 250 ms de retard au total ; le
mode économie double les blocs (environ 350 ms) pour deux fois moins de calcul. Sur le
processeur seul, le modèle est trop lent pour le direct.

- **Clonage.** Depuis le 9 octobre 2026, le logiciel garde une bibliothèque locale
  (`desktop/src-tauri/src/library.rs`) : un visage cloné est son portrait, une voix clonée est
  son enregistrement de référence (micro ou fichier), et un preset associe les deux. Le visage
  cloné et la voix clonée sont réellement appliqués. Les effets de voix (grave, robot…) sont du
  traitement du signal, pas du clonage : ils s'ajoutent après la voix clonée.
- **Un second moteur de voix, plus ressemblant, reste à ajouter.** OpenVoice change le timbre
  mais garde la hauteur et l'intonation de celui qui parle : une voix d'homme vers une voix de
  femme reste peu convaincante. Les modèles plus fidèles (MeanVC 2, Apache-2.0 ; X-VC, licence à
  vérifier) ne sont pas publiés en ONNX : il faut les exporter depuis PyTorch, donc installer
  Python, qui n'est pas sur ce PC. `voice.rs` est écrit pour qu'un autre moteur se branche à la
  place du premier (le trait `Converter`).
- **VoiceStudio et Deep-Live-Cam ne peuvent pas être intégrés tels quels.** Les deux sont sous
  licence AGPL-3.0 : les embarquer obligerait à publier tout le code du logiciel. VoiceStudio est
  de plus une application Electron avec un serveur Python et PyTorch (5 Go au moins), et il
  génère de la parole à partir d'un texte : il ne transforme pas une voix en direct. Le visage
  utilise déjà les mêmes modèles que Deep-Live-Cam, réécrits en Rust, sans son code.
- **Licences.** Les modèles de visage (`inswapper` et `buffalo_l`, ceux de Deep-Live-Cam) sont
  publiés pour un usage non commercial uniquement. Ils conviennent tant que le projet ne rapporte
  rien ; les vendre dans un abonnement demanderait une licence commerciale ou d'autres modèles.
  Les modèles de voix (OpenVoice V2) sont sous licence MIT : ils peuvent être vendus.
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
| 3 — Visage temps réel | Fait : visage choisi depuis une photo, appliqué à la caméra et à une photo d'essai, sur la carte graphique (DirectML) avec repli sur le processeur. Manque : essai avec une vraie caméra (aucune sur ce PC), plusieurs visages à la fois, netteté (le modèle travaille en 128 × 128), vitesse (15 images/s), `DirectML.dll` à joindre à l'installateur, visages servis par le serveur |
| 3 bis — Filtres et fenêtre flottante | Fait : filtres posés sur le visage (lunettes, chat, chien) et sur toute l'image (noir et blanc, sépia), dessinés par le cœur à partir des repères du détecteur, sans fichier image (`filters.rs`) ; fenêtre flottante toujours au premier plan qui montre la caméra. Manque : filtres à base d'images ou de 3D, plusieurs visages, suivi de la bouche et des yeux (le détecteur ne donne que 5 points) |
| 4 — Voix temps réel | Fait : voix clonée à partir d'un enregistrement (`voice.rs`), retour audio (le micro rejoué sur le casque) et cinq effets sans modèle (`effects.rs`). Tout cela ne s'entend que dans le retour audio tant qu'il n'y a pas de micro virtuel. Manque : un second moteur plus ressemblant pour les PC puissants, le réglage de la hauteur, le choix de la sortie audio, le volume du retour, les modèles servis par le serveur |
| 5 — Caméra et micro virtuels | Tout (voir ci-dessus) |
| 6 — Modèles servis par le serveur | Catalogue, versions, téléchargement signé et vérifié, cache, reprise, stockage Cloudflare R2 |
| 7 — Premium | Stripe : paiement, webhooks, annulation, échecs de paiement. La table et le calcul des droits existent déjà |
| 8 — Site | Pages Visages, Voix, Documentation ; mentions légales, CGU ; image de partage (Open Graph) |
| 9 — Espace utilisateur | Historique de paiement, annulation, suppression de compte et export des données (RGPD) depuis le site |
| 10 — Admin | Tout l'écran d'administration. Existent déjà côté API : bannir, débannir, chiffres d'audience. Manquent : liste des utilisateurs, sessions en direct, revenus, erreurs, versions |
| 11 — Sécurité avancée | Liaison du jeton à l'appareil, Authenticated Origin Pulls, détection d'abus, règles Cloudflare |
| 12 — Mise en production | Fait : mises à jour automatiques signées, publiées par GitHub (voir [deployment.md](deployment.md)). Manque : déploiement progressif, mise à jour forcée, retour arrière, configuration à distance, rapports de plantage, sauvegardes de la base |

Aussi absents : aucune version macOS ou Linux. Le site est en anglais, français, espagnol,
portugais et allemand, le logiciel aussi (anglais par défaut, menu de langue dans les réglages, et en bas à gauche avant la connexion).
Ces traductions n'ont pas été relues par des natifs. Les e-mails envoyés par l'API sont encore
en français uniquement.

## 4. Écrit mais jamais essayé en conditions réelles

| Élément | Ce qui a été vérifié | Ce qui ne l'a pas été |
| --- | --- | --- |
| Connexion Google et Discord | Tout le parcours côté serveur avec un faux fournisseur (15 tests) ; le serveur local du logiciel qui reçoit le code | Un vrai aller-retour chez Google ou Discord : il faut les identifiants |
| Capture caméra | Le code compile ; l'encodage de l'aperçu est testé | **Aucune caméra n'est détectée sur ce PC** : la capture n'a jamais tourné |
| Capture micro | Trois micros sont bien listés ; le calcul du niveau est testé | Le micro n'a pas été ouvert pendant les tests (volontairement) |
| Fenêtre du logiciel | Chaque écran a été affiché dans un navigateur avec un faux moteur (`npm run ui-preview -w desktop`) | Personne n'a encore cliqué dans la vraie fenêtre. Depuis qu'elle a sa propre barre de titre, ni son déplacement, ni son redimensionnement, ni ses trois boutons n'ont été essayés |
| Clonage de voix | L'enregistrement en mono et son fichier WAV sont testés | Aucun enregistrement réel depuis un micro |
| Voix clonée | Convertie par blocs en ligne de commande (`cargo run --example voice`), sur des voix de synthèse Windows et sur l'enregistrement de la bibliothèque : le timbre mesuré se rapproche bien de la référence (0,46 → 0,88 sur 1), plus vite que le temps réel | **Personne n'a encore écouté le résultat**, ni les raccords entre blocs. Jamais essayée avec un vrai micro, ni en même temps que le changement de visage, qui occupe déjà la carte graphique |
| Retour audio et effets | Chaque effet est testé sur des sons de synthèse (hauteur, délai de l'écho, bande de la radio), ainsi que la file entre micro et casque | **Personne ne les a encore écoutés** : ni le rendu des effets, ni le délai du retour, ni l'ouverture d'une vraie sortie audio |
| Filtres de caméra | Les formes sont testées et ont été regardées sur un visage schématique | Jamais sur un vrai visage ni avec une caméra |
| Fenêtre flottante | Son contenu a été affiché dans un navigateur ; le logiciel compile avec ses droits réduits | La fenêtre n'a jamais été ouverte : premier plan, déplacement, redimensionnement, fermeture avec la fenêtre principale |
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
