Crée une application desktop professionnelle permettant de modifier **en temps réel le visage et la voix/microphone de l’utilisateur**, avec une architecture extrêmement optimisée, sécurisée et scalable.

Le projet doit s’inspirer des fonctionnalités et concepts de :
- https://github.com/hacksider/Deep-Live-Cam
- https://github.com/debpalash/VoiceStudio

IMPORTANT : ne copie pas aveuglément leur code. Analyse les concepts utiles et construis une architecture propre, moderne, maintenable et sécurisée.

## 1. OBJECTIF PRINCIPAL

Créer une application desktop permettant :

- de sélectionner un visage prédéfini ;
- d'utiliser un visage personnalisé autorisé ;
- de sélectionner une voix prédéfinie ;
- d'utiliser une voix clonée/personnalisée ;
- de modifier le visage en direct ;
- de modifier la voix en direct ;
- d'utiliser le résultat comme caméra virtuelle et microphone virtuel ;
- de fonctionner avec les applications les plus populaires.

Priorité de compatibilité :

1. Discord
2. Valorant
3. TeamSpeak
4. Fortnite
5. Minecraft
6. Roblox
7. autres applications utilisant une webcam ou un microphone standard.

L'application doit fonctionner avec une latence aussi faible que possible et utiliser efficacement CPU, GPU, VRAM et RAM.

## 2. CONNEXION OBLIGATOIRE

Aucune utilisation complète de l'application sans authentification.

L'utilisateur doit obligatoirement se connecter à son compte.

Prévoir :

- création de compte ;
- connexion ;
- déconnexion ;
- récupération de compte ;
- vérification de session ;
- gestion des appareils/session ;
- expiration et renouvellement sécurisé des tokens ;
- possibilité de révoquer une session ;
- protection contre le vol de session ;
- rate limiting ;
- protection contre le brute force ;
- détection des connexions suspectes.

Ne jamais faire confiance au client pour déterminer les permissions ou l'état d'un abonnement.

Toutes les décisions importantes doivent être vérifiées côté serveur.

## 3. SYSTÈME GRATUIT / PREMIUM

Créer deux niveaux :

### Gratuit

Quelques visages et voix prédéfinis sont disponibles.

### Premium — 9,99 €/mois

Le Premium permet notamment :

- déverrouillage de tous les visages disponibles ;
- déverrouillage de toutes les voix disponibles ;
- création de visages personnalisés ;
- clonage de voix ;
- accès aux fonctionnalités avancées ;
- priorité éventuelle sur certaines ressources serveur.

Le serveur doit être l'autorité concernant les droits Premium.

Ne jamais stocker simplement une variable locale du type :

isPremium = true

Le client doit demander au serveur les permissions nécessaires.

Prévoir Stripe ou un système de paiement équivalent pour :

- abonnement mensuel ;
- renouvellement ;
- annulation ;
- expiration ;
- changement de statut ;
- webhooks sécurisés ;
- gestion des paiements échoués.

## 4. VISAGES ET VOIX DEPUIS LE SERVEUR

L'application doit pouvoir récupérer dynamiquement depuis le serveur :

- les visages disponibles ;
- les voix disponibles ;
- les versions des modèles ;
- les métadonnées ;
- les permissions nécessaires ;
- les mises à jour.

L'administrateur doit pouvoir ajouter/modifier/désactiver une voix ou un visage sans devoir publier une nouvelle version complète de l'application.

Utiliser un système de versioning des modèles.

Exemple :

models/
  faces/
  voices/

Chaque ressource doit posséder :

- un ID ;
- une version ;
- un statut ;
- un niveau d'accès ;
- une taille ;
- un hash/intégrité ;
- une version minimale de l'application ;
- éventuellement une date d'expiration.

## 5. ARCHITECTURE TEMPS RÉEL

L'application doit traiter :

CAMÉRA
→ capture
→ preprocessing
→ modèle visage
→ postprocessing
→ caméra virtuelle

MICROPHONE
→ capture
→ preprocessing
→ modèle voix
→ postprocessing
→ microphone virtuel

Optimiser au maximum la latence.

Éviter les copies mémoire inutiles.

Utiliser :

- GPU lorsqu'il est disponible ;
- accélération matérielle ;
- batch minimal ;
- pipelines asynchrones ;
- buffers efficaces ;
- traitement parallèle ;
- fallback CPU ;
- détection automatique des capacités matérielles.

Afficher éventuellement :

- FPS ;
- latence ;
- utilisation GPU ;
- VRAM ;
- CPU ;
- RAM.

Ces statistiques doivent être désactivables.

## 6. CAMÉRA ET MICROPHONE VIRTUELS

Le résultat final doit être exposé au système comme :

- caméra virtuelle ;
- microphone virtuel.

L'utilisateur doit pouvoir sélectionner :

"Nom de l'application Camera"

et

"Nom de l'application Microphone"

dans Discord, TeamSpeak, etc.

Prévoir une architecture compatible Windows en priorité.

L'architecture doit rester extensible vers macOS/Linux si techniquement possible.

## 7. MODÈLES IA

Les modèles doivent être séparés du cœur de l'application.

Le moteur doit pouvoir charger/décharger dynamiquement les modèles afin de limiter l'utilisation mémoire.

Prévoir :

- cache ;
- téléchargement sécurisé ;
- vérification cryptographique ;
- reprise de téléchargement ;
- téléchargement différentiel si pertinent ;
- suppression des modèles inutilisés ;
- rollback vers une version précédente.

Ne jamais exécuter aveuglément un fichier téléchargé depuis le serveur.

## 8. SÉCURITÉ

La sécurité doit être traitée comme une priorité absolue.

IMPORTANT :

Il est impossible de rendre un logiciel client totalement "impossible à déchiffrer" ou impossible à reverse-engineer. Le but doit donc être de rendre l'exploitation extrêmement difficile tout en gardant les secrets critiques hors du client.

Ne jamais placer dans l'application :

- clés API secrètes ;
- clés Stripe secrètes ;
- secrets JWT maîtres ;
- credentials de base de données ;
- secrets permettant de contourner les abonnements ;
- logique serveur critique.

Le client doit être considéré comme potentiellement compromis.

Mettre en place :

- authentification sécurisée ;
- autorisation côté serveur ;
- chiffrement TLS ;
- chiffrement des données sensibles au repos ;
- stockage sécurisé des tokens ;
- rotation des secrets ;
- signatures des mises à jour ;
- vérification d'intégrité ;
- certificats/signatures de code ;
- anti-tampering raisonnable ;
- obfuscation du code client lorsque pertinent ;
- symbol stripping ;
- minimisation des informations sensibles dans les binaires ;
- protection contre le replay ;
- rate limiting ;
- détection d'abus ;
- logs de sécurité ;
- audit trail administratif.

L'obfuscation ne doit jamais être considérée comme une mesure de sécurité principale.

Toute logique permettant de débloquer Premium doit rester contrôlée par le serveur.

## 9. PROTECTION DES MODÈLES

Les modèles propriétaires doivent être protégés autant que possible.

Prévoir :

- téléchargement authentifié ;
- URLs temporaires/signées ;
- permissions serveur ;
- chiffrement au repos ;
- hash SHA-256 ou mécanisme équivalent ;
- vérification d'intégrité ;
- révocation ;
- versioning.

Accepter qu'un modèle utilisé localement peut potentiellement être extrait par un attaquant déterminé. Concevoir donc le système pour limiter la valeur d'un modèle volé et détecter les abus.

## 10. BACKEND

Construire un backend moderne et scalable.

Architecture recommandée :

API Gateway
→ Auth Service
→ User Service
→ Subscription Service
→ Model Service
→ Admin Service
→ Analytics Service

Utiliser une architecture adaptée à la charge réelle plutôt que multiplier inutilement les microservices.

Prévoir :

- PostgreSQL ;
- Redis ;
- queue/job system pour les tâches asynchrones ;
- stockage objet compatible S3 ;
- CDN ;
- WebSocket/SSE uniquement lorsqu'utile ;
- monitoring ;
- logs centralisés.

## 11. ANALYTICS

Collecter uniquement les données nécessaires.

Le système doit pouvoir mesurer :

- utilisateurs actifs ;
- utilisateurs actifs en temps réel ;
- nouvelles inscriptions ;
- utilisateurs Premium ;
- utilisateurs gratuits ;
- durée moyenne d'utilisation ;
- sessions ;
- nombre de sessions ;
- rétention ;
- churn ;
- modèles les plus utilisés ;
- voix les plus utilisées ;
- visages les plus utilisés ;
- erreurs ;
- crashs ;
- performances ;
- latence moyenne ;
- FPS moyen ;
- utilisation GPU/CPU agrégée ;
- versions de l'application.

Éviter toute collecte inutile de contenu audio/vidéo.

La confidentialité et le RGPD doivent être pris en compte.

## 12. DASHBOARD ADMIN

Créer un dashboard administrateur sécurisé.

Il doit permettre de voir en temps réel :

- nombre d'utilisateurs connectés ;
- utilisateurs actifs ;
- sessions ;
- durée d'utilisation ;
- statistiques Premium ;
- revenus/abonnements ;
- rétention ;
- churn ;
- erreurs ;
- crashs ;
- performances ;
- versions des clients ;
- modèles utilisés.

Le dashboard ne doit pas provoquer de charge importante sur l'application.

Les statistiques temps réel doivent être agrégées côté backend.

Utiliser du caching, des agrégations et éventuellement des fenêtres temporelles pour éviter de faire des requêtes lourdes en permanence.

## 13. BAN / MODÉRATION

L'administrateur doit pouvoir bannir un utilisateur depuis le dashboard.

Lorsqu'un utilisateur est banni :

- ses sessions actives doivent pouvoir être révoquées ;
- l'application doit détecter rapidement le changement ;
- l'utilisateur doit recevoir un message expliquant qu'il est banni ;
- l'administrateur doit pouvoir choisir la raison ;
- enregistrer la date ;
- enregistrer l'administrateur ayant effectué l'action ;
- permettre une durée de bannissement ;
- permettre un bannissement permanent.

Prévoir également :

- suspension ;
- déban ;
- révocation des sessions ;
- historique des actions administratives.

Toutes les actions admin doivent être auditées.

## 14. SITE WEB — NEXT.JS

Créer un site moderne avec Next.js.

Objectifs :

- extrêmement rapide ;
- excellent SEO ;
- responsive ;
- accessible ;
- performant ;
- optimisé Core Web Vitals.

Pages principales :

- Accueil
- Fonctionnalités
- Tarifs
- Visages
- Voix
- FAQ
- Documentation
- Connexion
- Inscription
- Dashboard utilisateur
- Abonnement
- Gestion du compte
- Téléchargement de l'application

Utiliser autant que possible :

- Server Components ;
- SSR/SSG selon le besoin ;
- metadata dynamiques ;
- sitemap ;
- robots.txt ;
- données structurées ;
- images optimisées ;
- code splitting ;
- lazy loading ;
- CDN.

Le site doit être parfaitement optimisé pour Google.

## 15. DASHBOARD UTILISATEUR

Après connexion, l'utilisateur doit pouvoir voir :

- son abonnement ;
- son statut Premium ;
- date de renouvellement ;
- historique de paiement ;
- possibilité d'annuler ;
- possibilité de reprendre l'abonnement ;
- appareils/session actives ;
- téléchargement de l'application ;
- visages disponibles ;
- voix disponibles.

L'utilisateur doit pouvoir gérer son abonnement sans intervention manuelle.

## 16. RGPD / CONFIDENTIALITÉ

Le projet doit être conçu pour respecter le RGPD.

Prévoir :

- consentement lorsque nécessaire ;
- politique de confidentialité ;
- suppression du compte ;
- export des données ;
- minimisation des données ;
- durée de conservation définie ;
- suppression automatique des données inutiles ;
- chiffrement ;
- journalisation contrôlée.

Pour les données biométriques/voix et les visages personnalisés, prévoir une architecture de traitement particulièrement prudente et vérifier les obligations juridiques applicables avant mise en production.

## 17. MISE À JOUR DE L'APPLICATION

Créer un système d'auto-update sécurisé.

Le serveur doit pouvoir publier :

- nouvelle version ;
- correctifs ;
- modèles ;
- ressources.

Chaque mise à jour doit être :

- signée ;
- vérifiée ;
- téléchargée via HTTPS ;
- validée avant installation ;
- capable de rollback si nécessaire.

## 18. OBSERVABILITÉ

Prévoir :

- logs structurés ;
- métriques ;
- traces ;
- monitoring ;
- alertes ;
- crash reporting ;
- health checks ;
- système de diagnostic.

Ne jamais logger :

- mots de passe ;
- tokens ;
- clés secrètes ;
- données biométriques inutiles ;
- contenu audio/vidéo brut sans nécessité explicite.

## 19. PERFORMANCES

L'application doit rester fluide même sur une configuration moyenne.

Priorités :

1. faible latence ;
2. stabilité ;
3. utilisation GPU efficace ;
4. faible consommation RAM ;
5. faible utilisation CPU ;
6. démarrage rapide ;
7. récupération automatique après erreur.

Prévoir différents profils :

- Performance maximale ;
- Équilibré ;
- Économie de ressources.

## 20. ARCHITECTURE DU PROJET

Produire une architecture propre, modulaire et documentée.

Séparer clairement :

/desktop
/backend
/web
/admin
/shared
/infrastructure
/models
/docs

Le code doit être :

- typé ;
- testé ;
- documenté ;
- linté ;
- formaté ;
- maintenable.

Créer des tests :

- unitaires ;
- intégration ;
- API ;
- sécurité ;
- permissions ;
- abonnement ;
- téléchargement de modèles ;
- bannissement ;
- mise à jour ;
- performance.

## 21. IMPORTANT — APPROCHE DE DÉVELOPPEMENT

Ne génère pas un énorme prototype fragile en une seule fois.

Construis le projet progressivement :

PHASE 1
Architecture + authentification + backend + base de données.

PHASE 2
Application desktop + capture caméra/micro.

PHASE 3
Pipeline visage temps réel.

PHASE 4
Pipeline voix temps réel.

PHASE 5
Caméra/micro virtuels.

PHASE 6
Gestion des modèles depuis le serveur.

PHASE 7
Abonnements Premium.

PHASE 8
Site Next.js.

PHASE 9
Dashboard utilisateur.

PHASE 10
Dashboard admin + analytics temps réel.

PHASE 11
Sécurité avancée + anti-abus.

PHASE 12
Tests + optimisation + packaging + déploiement.

À chaque phase :

- produire du code réellement fonctionnel ;
- tester ;
- corriger les erreurs ;
- mesurer les performances ;
- ne pas casser les fonctionnalités précédentes ;
- documenter les décisions techniques.

## 22. RÈGLE DE SÉCURITÉ FONDAMENTALE

Considère toujours le client comme compromis.

Le client peut être inspecté, modifié ou patché par un utilisateur.

Donc :

CLIENT
→ interface + traitement temps réel + communication API

SERVEUR
→ identité + abonnement + permissions + modèles autorisés + bannissement + configuration + sécurité + analytics.

Aucune fonctionnalité critique ne doit dépendre uniquement d'une vérification locale.

## 23. LIVRABLE FINAL

Le résultat doit être un produit réellement exploitable, pas une simple démo.

Fournir :

- application desktop ;
- backend ;
- site Next.js ;
- dashboard utilisateur ;
- dashboard admin ;
- base de données ;
- système Premium ;
- système de modèles ;
- système d'authentification ;
- analytics ;
- bannissement ;
- auto-update ;
- documentation ;
- tests ;
- Docker/configuration de déploiement ;
- CI/CD ;
- documentation de sécurité ;
- documentation d'installation ;
- documentation d'administration.

Avant de considérer le projet terminé, effectuer un audit complet :

- sécurité ;
- performances ;
- authentification ;
- autorisations ;
- paiements ;
- stockage ;
- API ;
- WebSocket ;
- téléchargement de modèles ;
- mise à jour ;
- dashboard ;
- RGPD ;
- fuite de secrets ;
- dépendances vulnérables ;
- crashs ;
- consommation CPU/GPU/RAM.

Le résultat doit privilégier la sécurité réelle, les contrôles serveur, la confidentialité, la stabilité et les performances plutôt que de prétendre qu'une obfuscation rend le logiciel impossible à décompiler.



## MISES À JOUR À DISTANCE ET CORRECTIONS URGENTES

L'application doit disposer d'un système d'auto-update entièrement contrôlé depuis le serveur.

Je dois pouvoir publier une nouvelle version de l'application à distance lorsqu'un bug, une faille de sécurité ou un problème de performance est découvert.

Le système doit permettre :

- publication d'une nouvelle version depuis le backend/admin ;
- déploiement progressif (par exemple 1 %, 10 %, 25 %, 50 %, 100 %) ;
- possibilité de cibler certaines versions du client ;
- possibilité de forcer une mise à jour lorsqu'elle corrige une faille critique ;
- possibilité de désactiver temporairement une fonctionnalité défectueuse côté serveur ;
- possibilité de rendre une ancienne version incompatible avec l'API lorsque cela est nécessaire ;
- téléchargement automatique en arrière-plan ;
- installation au prochain redémarrage si possible ;
- vérification cryptographique de chaque mise à jour ;
- signature numérique des releases ;
- protection contre les mises à jour falsifiées ;
- rollback automatique vers une version stable si la nouvelle version échoue ;
- historique complet des versions ;
- notes de version ;
- possibilité pour l'administrateur de désactiver une release ;
- monitoring du taux de crash après chaque release ;
- possibilité d'arrêter automatiquement un déploiement si le taux d'erreur/crash augmente.

### HOTFIX D'URGENCE

Prévoir un système permettant de publier rapidement un correctif critique.

Exemple :

Une vulnérabilité ou un bug critique est découvert.

ADMIN
→ publie le hotfix
→ le serveur marque la version comme obligatoire
→ les clients concernés détectent le changement
→ téléchargement sécurisé
→ vérification de signature
→ installation
→ redémarrage si nécessaire
→ retour à une version stable en cas d'échec.

### REMOTE CONFIGURATION

Prévoir également une configuration distante permettant de modifier certains paramètres sans republier toute l'application.

Exemples :

- activer/désactiver une fonctionnalité ;
- désactiver temporairement un modèle ;
- changer une limite ;
- désactiver un moteur défectueux ;
- changer un endpoint ;
- imposer une version minimale ;
- mettre une fonctionnalité en maintenance.

IMPORTANT :
La configuration distante ne doit jamais permettre d'exécuter arbitrairement du code téléchargé depuis le serveur.

Toutes les releases doivent être signées et vérifiées avant installation.

### DASHBOARD ADMIN

Ajouter une section :

**Releases & Updates**

avec :

- version actuelle ;
- dernières versions ;
- nombre d'utilisateurs par version ;
- taux d'installation ;
- taux de crash ;
- erreurs ;
- statut du déploiement ;
- rollout progressif ;
- bouton pause ;
- bouton rollback ;
- bouton publication ;
- version minimale obligatoire ;
- historique des releases.

L'objectif est que je puisse gérer entièrement les mises à jour de l'application depuis mon serveur/dashboard sans devoir contacter manuellement les utilisateurs.