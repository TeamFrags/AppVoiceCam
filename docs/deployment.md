# Hébergement et déploiement

## Qui fait quoi

| Brique                       | Où                                   | Partagé avec l'autre application ?                 |
| ---------------------------- | ------------------------------------ | -------------------------------------------------- |
| API (backend)                | VPS, service `newapp-api`            | Non — utilisateur, port, service dédiés            |
| Base de données              | PostgreSQL sur le VPS, base `newapp` | Non — l'autre application n'utilise pas PostgreSQL |
| Compteurs (limites, verrous) | Redis dédié, port 6390               | Non — le Redis existant (6379) n'est pas utilisé   |
| DNS, proxy, TLS              | Cloudflare, zone du nouveau domaine  | Même compte possible, zone séparée                 |
| Site internet (Next.js)      | IONOS, en export statique            | Même compte possible, espace web séparé            |
| Nom de domaine, e-mail       | IONOS (domaine + boîte d'envoi SMTP) | Même compte possible, contrat séparé               |
| Fichiers de modèles          | Cloudflare R2 (phase 6)              | Non                                                |
| Firebase                     | **Non utilisé**                      | —                                                  |

**Pourquoi PostgreSQL et pas le MySQL IONOS ni Firebase.** L'API a son propre système de comptes
(sessions révocables, bannissement immédiat, audit) qui repose sur des transactions SQL ; Firebase
n'apporterait rien et lierait les deux projets. Le MySQL des hébergements web IONOS n'est en
général accessible que depuis l'hébergement IONOS lui-même, pas depuis un VPS. PostgreSQL tourne
donc sur le VPS, en local uniquement (127.0.0.1).

## Ce qui est créé sur le VPS

Tout porte le nom de code `newapp`, indépendant du nom commercial :

```
utilisateur système   newapp              sans shell, sans accès à /home
/srv/newapp           code (releases/ + lien current)
/opt/newapp/node      Node.js privé, vérifié par somme de contrôle
/etc/newapp           api.env (secrets), redis.conf, tls/
/var/lib/newapp       données Redis
systemd               newapp-api, newapp-redis
PostgreSQL            rôle newapp, base newapp
nginx                 sites-available/newapp-api
/usr/local/sbin       newapp-release
```

Ce qui n'est **jamais** touché : `/home/ubuntu`, PM2, Docker, le Redis du port 6379, les vhosts
nginx existants, `/etc/ssl/cloudflare`. Le dossier local `App/VPS` n'est ni lu ni modifié par ces
scripts.

Garde-fous :

- le script s'arrête avant toute création si un port, un utilisateur ou un nom de domaine est déjà
  pris par autre chose ;
- le service API ne peut pas lire `/home` (`ProtectHome`), a un système de fichiers en lecture
  seule et des plafonds (512 Mo, un cœur) pour ne pas affamer l'autre application ;
- nginx est rechargé, jamais redémarré, et seulement si `nginx -t` accepte la configuration ;
  sinon l'état précédent est remis.

Deux choses restent communes par nature : le paquet `redis-server` (un seul binaire, deux
instances) et nginx lui-même (un fichier de vhost de plus).

## Le site chez IONOS

L'hébergement IONOS est un espace web Apache/PHP (c'est ce qui sert l'autre site) : il ne fait pas
tourner Node.js. Le site Next.js sera donc généré en fichiers statiques (`output: 'export'`,
`trailingSlash: true`) puis envoyé tel quel, comme l'autre site envoie son dossier `_deploy/`.

- Les pages publiques (accueil, tarifs, FAQ…) sont pré-rendues en HTML : bon référencement, aucun
  serveur à faire tourner.
- Les pages connectées (compte, abonnement, sessions) sont des pages statiques qui appellent l'API
  du VPS depuis le navigateur. L'API n'accepte ces appels que depuis l'adresse du site (`WEB_URL`).
- Aucun PHP, aucune base MySQL, aucun secret côté IONOS : tout ce qui est sensible reste sur le VPS.

Séparation d'avec l'autre site, sur le même contrat :

- **Un dossier à la racine de l'espace web, à côté de celui de l'autre site, jamais dedans.** Un
  dossier placé à l'intérieur hériterait de son `.htaccess` et serait joignable par son domaine.
- Le nouveau domaine est rattaché à ce dossier dans le panneau IONOS.
- Aucun fichier commun : ni `includes/`, ni `.htaccess`, ni `.user.ini`, ni secrets. Le nouveau
  site a son propre `.htaccess` (page 404, en-têtes de sécurité, cache), généré avec le site.
- Une boîte d'envoi dédiée sur le nouveau domaine, distincte de celles de l'autre site.

### Construire et envoyer le site

```bash
npm run build:web
```

Le dossier `web/out/` contient alors tout le site (pages, images, `.htaccess`, `sitemap.xml`,
`robots.txt`). C'est ce dossier, et lui seul, qu'il faut envoyer dans le dossier IONOS du nouveau
domaine, comme tu envoies `_deploy/` pour l'autre site. Rien n'est encore créé chez IONOS.

Les adresses du site et de l'API sont déduites de `brand/brand.json` (`https://<domaine>` et
`https://api.<domaine>`) et figées dans les fichiers au moment du build. Après un changement de
nom ou de domaine : reconstruire et renvoyer.

À régler avant la mise en ligne :

- **L'adresse exacte du site.** `WEB_URL` dans `/etc/newapp/api.env` doit être l'adresse que
  voient les visiteurs, au caractère près (`https://domaine.com` ou `https://www.domaine.com`,
  pas les deux) : l'API refuse les appels venant d'une autre adresse. Rediriger l'autre variante
  dans Cloudflare.
- **L'identité de l'éditeur.** La page Confidentialité affiche une formule générique tant que
  `NEXT_PUBLIC_LEGAL_PUBLISHER` n'est pas défini au build (nom ou raison sociale, adresse). Les
  mentions légales et les conditions d'utilisation restent à rédiger et à faire relire.
- **Le cache des pages dans Cloudflare.** Par défaut Cloudflare ne met pas le HTML en cache :
  ajouter une règle de cache pour le domaine du site, et purger le cache après chaque envoi.
- **Les cookies de Cloudflare.** La page Confidentialité annonce deux cookies. Si une option
  Cloudflare en dépose d'autres (protection anti-robots par exemple), les y ajouter.

### Cookies et mesure d'audience

- Un bandeau propose « Refuser » et « Accepter », de même taille et de même style. Rien n'est
  déposé ni envoyé avant un choix, ni après un refus.
- Après acceptation, un identifiant anonyme (`vid`, 13 mois) permet de compter visites et
  visiteurs. Sont enregistrés : la page, le site de provenance, la date. Ni adresse IP, ni
  navigateur, ni lien avec un compte. Suppression automatique après 25 mois.
- Le choix est redemandé au bout de six mois et modifiable à tout moment (« Gérer les cookies »
  en pied de page).
- Les chiffres se lisent pour l'instant par l'API admin
  (`GET /v1/admin/analytics/pageviews?days=30`) ; l'écran viendra avec le dashboard admin.
- Le fichier `.htaccess` du site n'a pas été testé sur un vrai Apache : à vérifier au premier envoi.

## Première mise en place

Depuis le PC, dans Git Bash, à la racine du projet :

```bash
# 1. Préparer le VPS (demande le mot de passe sudo)
VPS_HOST=adresse-du-vps bash infrastructure/vps/deploy.sh --provision api.mondomaine.com
```

Le script indique ensuite ce qui manque :

2. **Certificat d'origine.** Cloudflare → SSL/TLS → Origin Server → Create Certificate pour
   `api.mondomaine.com`. Coller le certificat dans `/etc/newapp/tls/origin.pem` et la clé dans
   `/etc/newapp/tls/origin.key`, puis relancer l'étape 1 : le vhost nginx s'installe.
3. **E-mail.** Créer une boîte d'envoi (par exemple `no-reply@mondomaine.com` chez IONOS), puis
   `sudo nano /etc/newapp/api.env` et compléter :

   ```
   APP_NAME=NomDuProduit
   SMTP_URL=smtps://no-reply%40mondomaine.com:MOTDEPASSE@smtp.ionos.fr:465
   MAIL_FROM="NomDuProduit <no-reply@mondomaine.com>"
   ```

4. **Connexion Google et Discord (facultatif).** Créer les identifiants chez chaque fournisseur
   avec l'URI de redirection indiquée dans `api.env`, puis y remplir les quatre valeurs. Tant
   qu'elles sont vides, les boutons n'apparaissent ni sur le site ni dans le logiciel.
5. **DNS.** Dans Cloudflare, enregistrement `api` vers l'adresse du VPS, proxifié, mode SSL
   « Full (strict) ».

## Déployer

```bash
VPS_HOST=adresse-du-vps bash infrastructure/vps/deploy.sh
```

Le script lance les tests, compile, envoie une archive (sans `.env` ni sources), installe les
dépendances de production, bascule, puis interroge `/health`. Si la nouvelle version ne répond
pas, la précédente est remise en ligne. Les cinq dernières versions sont conservées.
`--dry-run` montre les commandes sans rien envoyer.

Les migrations SQL s'appliquent au démarrage de l'API.

## Mises à jour du logiciel (GitHub)

Le logiciel installé regarde au démarrage, puis toutes les six heures, s'il existe une version
plus récente. Si oui, un bandeau propose « Installer et redémarrer » : l'installateur est
téléchargé, sa signature vérifiée, puis lancé.

Deux dépôts GitHub, pour que le code ne soit jamais public :

| Dépôt               | Visibilité | Contenu                                                                                     |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| Le code (ce projet) | **Privé**  | Tout le projet, et le workflow `.github/workflows/release.yml`                              |
| Les versions        | **Public** | Rien d'autre qu'un fichier `README` et les versions publiées (installateur + `latest.json`) |

Le dépôt des versions doit être public : le logiciel y télécharge ses mises à jour sans
identifiant. Il doit contenir au moins un fichier, sinon GitHub refuse d'y créer une version.

**La clé de signature.** Elle est dans `C:\Users\alber\.tauri\newapp-updater.key`, hors du
projet, sans mot de passe. Sa partie publique est compilée dans le logiciel. Qui possède cette
clé peut faire installer n'importe quoi à tous les utilisateurs ; si elle est perdue, plus
aucune copie installée ne peut être mise à jour. En garder une copie hors de ce PC, et ne
jamais la mettre dans un dépôt.

### Mise en place, une seule fois

1. Créer les deux dépôts, envoyer le projet dans le dépôt privé.
2. Créer un jeton GitHub « fine-grained » limité au dépôt des versions, avec le droit
   « Contents : lecture et écriture ».
3. Dans le dépôt privé, Settings → Secrets and variables → Actions :
   - variable `RELEASES_REPO` : `proprietaire/nom` du dépôt des versions ;
   - secret `TAURI_SIGNING_PRIVATE_KEY` : le contenu du fichier de clé ;
   - secret `RELEASES_TOKEN` : le jeton de l'étape 2.

### Publier une version

1. Changer `version` dans `desktop/src-tauri/tauri.conf.json` (par exemple `0.2.0`).
2. Envoyer le changement, puis l'étiquette : `git tag v0.2.0 && git push origin v0.2.0`.
3. GitHub compile, signe et crée un **brouillon** dans le dépôt des versions. L'étiquette doit
   correspondre à la version de l'étape 1, sinon la publication s'arrête.
4. Essayer l'installateur du brouillon, puis cliquer « Publish release ». Les copies installées
   reçoivent la mise à jour à partir de ce moment.

Pour retirer une version : la supprimer sur GitHub (ou la repasser en brouillon). Les copies
qui l'ont déjà installée la gardent : un logiciel ne revient pas à un numéro inférieur, il faut
publier un numéro supérieur.

Limites : tout le monde reçoit la version en même temps (pas de déploiement progressif), rien
n'oblige à l'installer, et la toute première version installée doit déjà contenir ce système.
Sans certificat de signature de code Windows, l'installateur affiche « éditeur inconnu ».

## Exploitation

```bash
sudo systemctl status newapp-api
sudo journalctl -u newapp-api -f
sudo -u postgres pg_dump newapp | gzip > newapp-$(date +%F).sql.gz    # sauvegarde
```

Créer un administrateur (SQL direct : aucun chemin par l'API) :

```bash
sudo -u postgres psql newapp -c "update users set role='admin' where email='toi@exemple.com'"
```

## Tout retirer

```bash
sudo systemctl disable --now newapp-api newapp-redis
sudo rm /etc/nginx/sites-enabled/newapp-api /etc/nginx/sites-available/newapp-api
sudo nginx -t && sudo systemctl reload nginx
sudo -u postgres psql -c 'drop database newapp' -c 'drop role newapp'
sudo rm -rf /srv/newapp /opt/newapp /etc/newapp /var/lib/newapp \
    /etc/systemd/system/newapp-*.service /usr/local/sbin/newapp-release
sudo userdel newapp && sudo systemctl daemon-reload
```

## État de validation

Les scripts `provision.sh` et `release.sh` n'ont **jamais été exécutés** : seule leur syntaxe a été
vérifiée, faute de machine Linux. La partie locale de `deploy.sh` (tests, compilation, archive) a
été exécutée en `--dry-run`. La première exécution réelle doit être suivie pas à pas.

Limites connues :

- aucune sauvegarde automatique de la base n'est planifiée ;
- quelqu'un qui joint le VPS sans passer par Cloudflare peut forger son adresse IP vis-à-vis des
  limites de débit par IP (le verrouillage par compte, lui, tient). Correctif prévu : Authenticated
  Origin Pulls ;
- si `apt` installe PostgreSQL, c'est un nouveau service sur la machine partagée (environ 100 à
  200 Mo de mémoire au repos). Le guide de l'autre site décrit le VPS comme 4 cœurs et 8 Go : la
  marge suffit : `free -h` du 8 octobre 2026 indique 5,4 Go disponibles sur 7,6 Go. Le VPS n'a pas
  de swap, d'où les plafonds mémoire posés sur les services de cette application.
