# Architecture

Le cahier des charges complet est dans [readme.md](../readme.md). Ce document décrit ce qui est
réellement construit et les décisions prises. Il est mis à jour à chaque phase.

## État d'avancement

| Phase | Contenu                                          | État     |
| ----- | ------------------------------------------------ | -------- |
| 0     | Identité de marque (nom, mascotte, palette)      | Fait     |
| 1     | Architecture, authentification, backend, base    | Fait     |
| 1 bis | Scripts de déploiement VPS isolés                | Écrits, jamais exécutés |
| 2     | Application desktop, capture caméra/micro        | Fait (capture caméra jamais essayée : aucune caméra sur le PC de développement) |
| 3     | Pipeline visage temps réel                       | À faire  |
| 4     | Pipeline voix temps réel                         | À faire  |
| 5     | Caméra et micro virtuels                         | À faire  |
| 6     | Modèles servis depuis le serveur                 | À faire  |
| 7     | Abonnements Premium (Stripe)                     | À faire  |
| 8     | Site Next.js                                     | Fait (pages Visages, Voix et Documentation à faire avec leurs phases) |
| 9     | Dashboard utilisateur                            | Partiel : compte, niveau, appareils. Paiement en phase 7 |
| 10    | Dashboard admin, analytics temps réel            | À faire  |
| 11    | Sécurité avancée, anti-abus                      | À faire  |
| 12    | Tests, optimisation, packaging, déploiement      | À faire  |

## Arborescence

```
backend/          API (Fastify + TypeScript), migrations SQL, tests
web/              Site Next.js en export statique, test navigateur dans e2e/
desktop/          Logiciel Windows : cœur Rust (src-tauri/), interface (src/)
brand/            Source unique de la marque (brand.json) et générateur
shared/brand/     Jetons de marque générés, partagés par le site, l'admin et le desktop
infrastructure/   docker-compose de développement ; vps/ : scripts de déploiement
docs/             Architecture, marque, déploiement
```

`desktop/`, `web/`, `admin/` et `models/` seront créés avec leur phase.

## Décisions de la phase 1

**Un seul service backend, découpé en modules.** Le readme demande d'adapter l'architecture à la
charge réelle plutôt que de multiplier les microservices. Auth, sessions, bannissements et droits
sont des modules du même processus ; ils pourront être extraits si la charge le justifie.

**Le client n'est jamais l'autorité.** À chaque requête authentifiée, le serveur relit en base
l'état de la session, le rôle et les bannissements. Un bannissement, une révocation de session ou
un retrait du rôle admin prennent donc effet immédiatement, sans attendre l'expiration du jeton
d'accès. Coût : deux requêtes indexées par appel ; à mettre en cache dans Redis si cela devient
mesurable.

**Jetons.**

- Jeton d'accès : JWT signé EdDSA (Ed25519), 10 minutes, ne contient que l'identifiant
  d'utilisateur et de session. Aucun droit n'y est inscrit.
- Jeton de rafraîchissement : opaque, 256 bits aléatoires, stocké uniquement sous forme de hash
  SHA-256, renouvelé à chaque usage. La réutilisation d'un jeton déjà renouvelé est traitée comme
  un vol : toute la session est révoquée et un événement de sécurité est enregistré.

**Mots de passe.** Argon2id (19 Mio, 2 itérations), 10 caractères minimum.

**Anti-énumération.** L'inscription et la demande de réinitialisation répondent de façon
identique que le compte existe ou non ; la connexion compare toujours un hash, même pour un
compte inconnu.

**Force brute.** Limite de débit par IP sur chaque route publique, plus verrouillage du compte
15 minutes après 5 échecs. Une réinitialisation de mot de passe lève le verrou.

**Premium.** `GET /v1/me/entitlements` calcule le niveau à partir de la table `subscriptions`,
qui ne sera écrite que par le webhook de paiement (phase 7). Il n'existe aucun champ
« isPremium » modifiable par le client.

**Bannissement.** Un bannissement est actif tant qu'il n'est ni levé ni expiré : aucune tâche
planifiée n'est nécessaire pour faire expirer une suspension. Chaque action admin écrit une ligne
dans `audit_log` dans la même transaction.

**Base de développement.** Sans `DATABASE_URL`, le backend utilise PGlite (PostgreSQL compilé en
WebAssembly) : les tests et le développement tournent sans Docker, avec le même SQL qu'en
production. En production, PostgreSQL et Redis sont obligatoires et vérifiés au démarrage.

## Décisions du site

**Export statique.** Le site est hébergé sur un espace web Apache sans Node.js. Il n'utilise donc
aucune fonction serveur de Next.js, ce qui le rend déplaçable vers n'importe quel hébergeur.

**Session dans le navigateur.** Le jeton de rafraîchissement est un cookie `HttpOnly`,
`SameSite=Strict`, limité aux routes `/v1/auth` : un script injecté dans la page ne peut pas le
lire. Le jeton d'accès ne vit qu'en mémoire. L'application desktop, elle, reçoit toujours ses
jetons en JSON.

**Plusieurs onglets.** Un jeton de rafraîchissement ne sert qu'une fois ; deux onglets qui se
rafraîchissent en même temps déclencheraient la détection de vol. Les rafraîchissements sont donc
mis en file entre onglets (Web Locks).

**Mesure d'audience maison.** Pas d'outil tiers : rien ne part chez un autre prestataire, et les
données restent dans la base de l'application. Le consentement est appliqué dans le navigateur ;
le serveur ne peut pas le vérifier, il se contente de ne rien stocker d'identifiant.

## Décisions du logiciel

**Tauri et Rust, pas Electron.** Une archive asar rend le code source tel quel. Ici le cœur est
compilé en code machine sans symboles ; l'interface embarquée ne contient que de l'affichage.
C'est un durcissement, pas un coffre-fort : voir [MANQUE.md](MANQUE.md), section 5.

**L'interface ne détient aucun identifiant.** Le jeton de rafraîchissement vit dans le
Gestionnaire d'identification Windows, le jeton d'accès dans la mémoire du cœur. L'interface
demande des actions (« connecte-moi », « démarre la caméra ») et reçoit des résultats.

**Connexion obligatoire.** Sans session ouverte par le serveur, le cœur refuse la capture. Ce
contrôle local peut être contourné en modifiant le programme : rien de valeur n'en dépend, les
modèles et le Premium seront délivrés par le serveur.

**Google et Discord par le navigateur du système.** Le logiciel n'affiche jamais la page de
connexion d'un fournisseur. Il ouvre le navigateur, attend un code à usage unique sur un port
local, et prouve au serveur qu'il est bien à l'origine de la demande (vérificateur PKCE) : un
autre programme qui intercepterait le code ne pourrait rien en faire.

**Comptes liés par adresse vérifiée.** Un compte Google ou Discord dont l'adresse n'est pas
vérifiée par le fournisseur est refusé. Si un compte local existe déjà pour l'adresse mais n'a
jamais été confirmé, son mot de passe est effacé au moment du rattachement : quelqu'un a pu le
créer à l'avance pour piéger le vrai propriétaire.

**Nom de code fixe.** L'identifiant de l'application (`com.newapp.desktop`) et l'entrée du
gestionnaire d'identification ne portent pas le nom commercial : un changement de nom ne casse
ni les installations ni les sessions.

## Limites connues de la phase 1

- Les e-mails partent par SMTP (`SMTP_URL`). Le rendu des messages est testé, mais aucun envoi
  réel n'a été fait : à valider avec la vraie boîte d'envoi.
- Les implémentations PostgreSQL (`pg`) et Redis (`ioredis`) sont écrites mais n'ont pas été
  exécutées : ni Docker ni PostgreSQL ne sont installés sur le poste de développement. Les tests
  passent sur PGlite et le store mémoire.
- Deux rafraîchissements simultanés du même jeton révoquent la session (pas de fenêtre de
  tolérance). Le client desktop devra sérialiser ses rafraîchissements.
- Le jeton d'accès n'est pas lié cryptographiquement à l'appareil (DPoP) : prévu en phase 11.
- Export et suppression de compte (RGPD) : prévus avec le dashboard utilisateur, phase 9.

## API de la phase 1

| Méthode | Route                          | Accès  |
| ------- | ------------------------------ | ------ |
| GET     | `/health`                      | public |
| POST    | `/v1/auth/register`            | public |
| POST    | `/v1/auth/verify-email`        | public |
| POST    | `/v1/auth/login`               | public |
| POST    | `/v1/auth/refresh`             | public |
| POST    | `/v1/auth/password/forgot`     | public |
| POST    | `/v1/auth/password/reset`      | public |
| POST    | `/v1/auth/logout`              | compte |
| GET     | `/v1/me`                       | compte |
| GET     | `/v1/me/entitlements`          | compte |
| GET     | `/v1/me/sessions`              | compte |
| DELETE  | `/v1/me/sessions/:id`          | compte |
| GET     | `/v1/auth/oauth/providers`     | public |
| GET     | `/v1/auth/oauth/:provider/start` | public (redirige vers Google ou Discord) |
| GET     | `/v1/auth/oauth/:provider/callback` | public (retour du fournisseur) |
| POST    | `/v1/auth/oauth/exchange`      | public (logiciel : code à usage unique contre jetons) |
| POST    | `/v1/analytics/pageview`       | public (envoyé seulement après consentement) |
| GET     | `/v1/admin/analytics/pageviews`| admin  |
| POST    | `/v1/admin/users/:id/ban`      | admin  |
| POST    | `/v1/admin/users/:id/unban`    | admin  |

## Lancer le projet

```
npm install
npm run dev        # API sur http://127.0.0.1:4000, base embarquée dans backend/.data
npm test
npm run dev:web    # site sur http://localhost:3000, ou le port libre suivant s'il est pris (lancer aussi `npm run dev`)
npm run test:e2e   # parcours complet dans Microsoft Edge : inscription, connexion, cookies
npm run build:web  # site de production dans web/out/
npm run dev:desktop          # logiciel en développement (lancer aussi `npm run dev`)
npm run test:desktop         # tests du cœur Rust
npm run test:integration -w desktop   # session complète contre une vraie API
npm run build:desktop        # exécutable optimisé et installateur Windows
npm run typecheck
npm run lint
```

Hébergement, isolation sur le VPS partagé et mise en ligne : [deployment.md](deployment.md).
Changement de nom, de palette ou de mascotte : [brand/brand.md](brand/brand.md).

Créer un administrateur en développement :

```
npm run promote-admin -w backend -- toi@exemple.com
```
