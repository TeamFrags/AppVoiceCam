#!/usr/bin/env bash
# =============================================================================
# Prépare le VPS pour cette application, SANS toucher à ce qui y tourne déjà.
#
# S'exécute SUR le VPS, en root :   sudo bash provision.sh api.mondomaine.com
# (lancé normalement par `deploy.sh --provision api.mondomaine.com` depuis le PC)
#
# Tout ce que ce script crée porte le nom de code de l'application (par défaut
# « newapp », indépendant du nom commercial qui peut changer) :
#
#   utilisateur système   newapp            (sans shell, sans accès à /home/ubuntu)
#   code                  /srv/newapp
#   Node.js privé         /opt/newapp/node  (indépendant du Node de l'autre application)
#   secrets, config       /etc/newapp
#   données Redis         /var/lib/newapp
#   services systemd      newapp-api, newapp-redis
#   PostgreSQL            rôle « newapp », base « newapp »
#   nginx                 /etc/nginx/sites-available/newapp-api
#
# Ce script ne modifie JAMAIS : /home/ubuntu, PM2, Docker, le Redis par défaut
# (port 6379), les vhosts nginx existants, /etc/ssl/cloudflare.
# Il est idempotent : le relancer ne régénère aucun secret et ne coupe rien.
# =============================================================================
set -euo pipefail

APP="${APP_CODENAME:-newapp}"
API_DOMAIN="${1:-}"
API_PORT="${API_PORT:-4710}"
REDIS_PORT="${REDIS_PORT:-6390}"
NODE_VERSION="${NODE_VERSION:-22.20.0}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ETC="/etc/$APP"
SRV="/srv/$APP"
OPT="/opt/$APP"
VAR="/var/lib/$APP"
ENV_FILE="$ETC/api.env"
VHOST_AVAIL="/etc/nginx/sites-available/$APP-api"
VHOST_ENABLED="/etc/nginx/sites-enabled/$APP-api"

step() { printf '\n── %s\n' "$*"; }
info() { printf '   %s\n' "$*"; }
warn() { printf '   ⚠️  %s\n' "$*"; }
die() { printf '\n❌ %s\n' "$*" >&2; exit 1; }

# ── 0. Contrôles préalables : on s'arrête avant de créer quoi que ce soit ─────
[ "$(id -u)" -eq 0 ] || die "à lancer avec sudo"
[[ "$APP" =~ ^[a-z][a-z0-9]{2,15}$ ]] || die "nom de code invalide : $APP"
[[ "$API_DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] \
    || die "usage : sudo bash provision.sh api.mondomaine.com"
command -v nginx >/dev/null || die "nginx introuvable : ce script s'ajoute à un nginx existant, il ne l'installe pas"
command -v redis-server >/dev/null \
    || die "redis-server introuvable. L'installer démarrerait une instance sur 6379 : à décider à la main."

port_busy() { [ -n "$(ss -ltnH "sport = :$1" 2>/dev/null)" ]; }
service_active() { systemctl is-active --quiet "$1" 2>/dev/null; }

if port_busy "$API_PORT" && ! service_active "$APP-api"; then
    die "le port $API_PORT est déjà utilisé par autre chose. Relancer avec API_PORT=<port libre>."
fi
if port_busy "$REDIS_PORT" && ! service_active "$APP-redis"; then
    die "le port $REDIS_PORT est déjà utilisé par autre chose. Relancer avec REDIS_PORT=<port libre>."
fi
if id -u "$APP" >/dev/null 2>&1; then
    [ "$(getent passwd "$APP" | cut -d: -f6)" = "$SRV" ] \
        || die "un utilisateur « $APP » existe déjà et n'est pas le nôtre. Relancer avec APP_CODENAME=<autre nom>."
fi
if grep -RlsE "server_name[^;]*\b${API_DOMAIN//./\\.}\b" /etc/nginx/sites-enabled 2>/dev/null | grep -qv "^$VHOST_ENABLED$"; then
    die "un autre vhost nginx répond déjà à $API_DOMAIN"
fi

# ── 1. Utilisateur et dossiers ────────────────────────────────────────────────
step "1 · Utilisateur système et dossiers"
if ! id -u "$APP" >/dev/null 2>&1; then
    useradd --system --home-dir "$SRV" --shell /usr/sbin/nologin "$APP"
    info "utilisateur $APP créé"
fi
install -d -o "$APP" -g "$APP" -m 750 "$SRV" "$SRV/releases" "$VAR" "$VAR/redis"
install -d -o root -g "$APP" -m 750 "$ETC" "$ETC/tls"
install -d -o root -g root -m 755 "$OPT"

# ── 2. Node.js privé ──────────────────────────────────────────────────────────
step "2 · Node.js $NODE_VERSION dans $OPT/node"
if [ "$("$OPT/node/bin/node" -v 2>/dev/null || true)" = "v$NODE_VERSION" ]; then
    info "déjà installé"
else
    case "$(uname -m)" in
        x86_64) NODE_ARCH=x64 ;;
        aarch64) NODE_ARCH=arm64 ;;
        *) die "architecture non gérée : $(uname -m)" ;;
    esac
    TARBALL="node-v$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    curl -fsSL -o "$TMP/$TARBALL" "https://nodejs.org/dist/v$NODE_VERSION/$TARBALL"
    curl -fsSL -o "$TMP/SHASUMS256.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
    (cd "$TMP" && grep " $TARBALL\$" SHASUMS256.txt | sha256sum -c - >/dev/null) \
        || die "somme de contrôle de Node.js incorrecte : installation annulée"
    rm -rf "$OPT/node.new"
    mkdir "$OPT/node.new"
    tar -xJf "$TMP/$TARBALL" -C "$OPT/node.new" --strip-components=1
    rm -rf "$OPT/node.old"
    [ -d "$OPT/node" ] && mv "$OPT/node" "$OPT/node.old"
    mv "$OPT/node.new" "$OPT/node"
    rm -rf "$OPT/node.old"
    info "installé : $("$OPT/node/bin/node" -v)"
fi

# ── 3. PostgreSQL ─────────────────────────────────────────────────────────────
step "3 · PostgreSQL (rôle et base « $APP »)"
if ! command -v psql >/dev/null; then
    info "PostgreSQL absent : installation du paquet (écoute sur 127.0.0.1 uniquement)"
    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql >/dev/null
fi
systemctl enable --now postgresql >/dev/null
pg() { runuser -u postgres -- psql -v ON_ERROR_STOP=1 -qAt "$@"; }
PG_PORT="$(pg -c 'show port')"

# Les secrets ne sont générés qu'une fois : si api.env existe, on ne touche à aucun mot de passe.
FIRST_RUN=0
[ -f "$ENV_FILE" ] || FIRST_RUN=1

if [ "$FIRST_RUN" -eq 1 ]; then
    PG_PASS="$(openssl rand -hex 24)"
    pg -v pw="$PG_PASS" <<SQL
SELECT 'CREATE ROLE $APP LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$APP') \gexec
ALTER ROLE $APP PASSWORD :'pw';
SELECT 'CREATE DATABASE $APP OWNER $APP' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$APP') \gexec
REVOKE CONNECT ON DATABASE $APP FROM PUBLIC;
SQL
    info "rôle et base créés (port $PG_PORT)"
else
    info "déjà configuré (api.env présent) : rien n'est modifié"
fi

# ── 4. Redis dédié ────────────────────────────────────────────────────────────
step "4 · Redis dédié sur 127.0.0.1:$REDIS_PORT (le Redis de l'autre application reste intact)"
if [ "$FIRST_RUN" -eq 1 ]; then
    REDIS_PASS="$(openssl rand -hex 24)"
    cat >"$ETC/redis.conf" <<CONF
bind 127.0.0.1
port $REDIS_PORT
protected-mode yes
requirepass $REDIS_PASS
daemonize no
dir $VAR/redis
# Uniquement des compteurs à durée de vie courte (limites de débit, verrouillages).
save ""
appendonly no
maxmemory 64mb
maxmemory-policy volatile-ttl
CONF
    chown root:"$APP" "$ETC/redis.conf"
    chmod 640 "$ETC/redis.conf"
fi
cat >"/etc/systemd/system/$APP-redis.service" <<UNIT
[Unit]
Description=$APP — Redis dédié
After=network.target

[Service]
User=$APP
Group=$APP
ExecStart=$(command -v redis-server) $ETC/redis.conf
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$VAR/redis
MemoryMax=128M

[Install]
WantedBy=multi-user.target
UNIT

# ── 5. Secrets de l'API ───────────────────────────────────────────────────────
step "5 · Secrets ($ENV_FILE)"
if [ "$FIRST_RUN" -eq 1 ]; then
    JWT_KEY="$(openssl genpkey -algorithm ed25519 | awk 'BEGIN { ORS = "\\n" } { print }')"
    BASE_DOMAIN="${API_DOMAIN#*.}"
    umask 077
    cat >"$ENV_FILE" <<ENV
NODE_ENV=production
HOST=127.0.0.1
PORT=$API_PORT
TRUST_PROXY=true
DATABASE_URL=postgres://$APP:$PG_PASS@127.0.0.1:$PG_PORT/$APP
REDIS_URL=redis://:$REDIS_PASS@127.0.0.1:$REDIS_PORT
JWT_PRIVATE_KEY='$JWT_KEY'
JWT_ISSUER=https://$API_DOMAIN
WEB_URL=https://$BASE_DOMAIN

# ── À COMPLÉTER avant le premier déploiement ──
# Nom affiché dans les e-mails (celui de brand/brand.json)
APP_NAME=
# Boîte d'envoi, par exemple chez IONOS (encoder @ en %40 dans l'identifiant) :
#   smtps://no-reply%40$BASE_DOMAIN:MOTDEPASSE@smtp.ionos.fr:465
SMTP_URL=
MAIL_FROM=

# ── Facultatif : connexion Google et Discord (un fournisseur apparaît quand ses deux valeurs sont remplies)
# URI de redirection à déclarer chez le fournisseur :
#   https://$API_DOMAIN/v1/auth/oauth/google/callback
#   https://$API_DOMAIN/v1/auth/oauth/discord/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
ENV
    umask 022
    chown root:"$APP" "$ENV_FILE"
    chmod 640 "$ENV_FILE"
    info "généré. Mots de passe et clé de signature n'existent que dans ce fichier."
else
    info "déjà présent : conservé tel quel"
fi

# ── 6. Service de l'API ───────────────────────────────────────────────────────
step "6 · Services systemd"
cat >"/etc/systemd/system/$APP-api.service" <<UNIT
[Unit]
Description=$APP — API
After=network.target postgresql.service $APP-redis.service
Wants=$APP-redis.service

[Service]
User=$APP
Group=$APP
WorkingDirectory=$SRV/current/backend
EnvironmentFile=$ENV_FILE
ExecStart=$OPT/node/bin/node dist/server.js
Restart=always
RestartSec=3
# Cloisonnement : pas d'accès à /home (donc aux fichiers de l'autre application),
# système de fichiers en lecture seule, ressources plafonnées pour ne pas lui nuire.
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
MemoryMax=512M
CPUQuota=100%
TasksMax=256

[Install]
WantedBy=multi-user.target
UNIT
install -o root -g root -m 750 "$HERE/release.sh" "/usr/local/sbin/$APP-release"
systemctl daemon-reload
systemctl enable --now "$APP-redis" >/dev/null
systemctl enable "$APP-api" >/dev/null 2>&1
info "$APP-redis démarré ; $APP-api démarrera au premier déploiement"

# ── 7. Vhost nginx ────────────────────────────────────────────────────────────
step "7 · nginx ($API_DOMAIN)"
if [ ! -s "$ETC/tls/origin.pem" ] || [ ! -s "$ETC/tls/origin.key" ]; then
    warn "certificat d'origine Cloudflare absent : vhost NON installé."
    info "Cloudflare → SSL/TLS → Origin Server → Create Certificate pour $API_DOMAIN, puis coller :"
    info "  le certificat dans  $ETC/tls/origin.pem"
    info "  la clé privée dans  $ETC/tls/origin.key"
    info "et relancer ce script."
else
    chown root:root "$ETC/tls/origin.pem" "$ETC/tls/origin.key"
    chmod 600 "$ETC/tls/origin.key"
    BACKUP=""
    if [ -f "$VHOST_AVAIL" ]; then
        BACKUP="$(mktemp)"
        cp "$VHOST_AVAIL" "$BACKUP"
    fi
    sed -e "s/@APP@/$APP/g" -e "s/@API_DOMAIN@/$API_DOMAIN/g" -e "s/@API_PORT@/$API_PORT/g" \
        "$HERE/nginx-api.conf.template" >"$VHOST_AVAIL"
    ln -sfn "$VHOST_AVAIL" "$VHOST_ENABLED"
    if nginx -t 2>/dev/null; then
        # reload et non restart : les connexions de l'autre application ne sont pas coupées
        systemctl reload nginx
        info "vhost installé et nginx rechargé"
    else
        if [ -n "$BACKUP" ]; then cp "$BACKUP" "$VHOST_AVAIL"; else rm -f "$VHOST_AVAIL" "$VHOST_ENABLED"; fi
        nginx -t >/dev/null 2>&1 || true
        die "nginx -t a refusé le vhost : état précédent remis, rien n'a changé en ligne"
    fi
fi

step "Terminé"
info "Reste à faire : compléter APP_NAME, SMTP_URL et MAIL_FROM dans $ENV_FILE (sudo nano),"
info "pointer $API_DOMAIN vers ce VPS dans Cloudflare (proxifié), puis lancer deploy.sh depuis le PC."
