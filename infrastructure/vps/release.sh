#!/usr/bin/env bash
# Installé par provision.sh sous /usr/local/sbin/<nom de code>-release.
# Met en ligne une archive envoyée par deploy.sh, et revient à la version précédente
# si la nouvelle ne répond pas. Ne touche qu'à /srv/<nom de code> et à son service.
set -euo pipefail

APP="$(basename "$0")"
APP="${APP%-release}"
ARCHIVE="${1:-}"
SRV="/srv/$APP"
ENV_FILE="/etc/$APP/api.env"
NODE_BIN="/opt/$APP/node/bin"
KEEP=5

die() { printf '❌ %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "à lancer avec sudo"
[ -f "$ARCHIVE" ] || die "usage : $APP-release <archive.tar.gz>"
[ -f "$ENV_FILE" ] || die "$ENV_FILE absent : lancer provision.sh d'abord"
for key in APP_NAME SMTP_URL MAIL_FROM; do
    grep -Eq "^$key=.+" "$ENV_FILE" || die "$key est vide dans $ENV_FILE : l'API refuserait de démarrer"
done

PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"
RELEASE="$SRV/releases/$(date +%Y%m%d-%H%M%S)"
PREVIOUS="$(readlink -f "$SRV/current" 2>/dev/null || true)"
as_app() { runuser -u "$APP" -- env HOME="$SRV" PATH="$NODE_BIN:/usr/bin:/bin" "$@"; }

echo "→ extraction dans $RELEASE"
install -d -o "$APP" -g "$APP" -m 750 "$RELEASE"
tar -xzf "$ARCHIVE" -C "$RELEASE" --no-same-owner
chown -R "$APP:$APP" "$RELEASE"

echo "→ installation des dépendances de production"
(cd "$RELEASE" && as_app npm ci --omit=dev --workspace backend --no-audit --no-fund >/dev/null)

healthy() {
    for _ in $(seq 1 60); do
        curl -fsS -o /dev/null "http://127.0.0.1:$PORT/health" 2>/dev/null && return 0
        sleep 1
    done
    return 1
}

echo "→ bascule et redémarrage (les migrations s'appliquent au démarrage)"
ln -sfn "$RELEASE" "$SRV/current"
systemctl restart "$APP-api"

if healthy; then
    echo "✅ en ligne : $RELEASE"
else
    echo "⚠️  la nouvelle version ne répond pas. Dernières lignes du journal :"
    journalctl -u "$APP-api" -n 20 --no-pager || true
    if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
        ln -sfn "$PREVIOUS" "$SRV/current"
        systemctl restart "$APP-api"
        healthy && die "retour à la version précédente ($PREVIOUS) : elle répond"
        die "retour à la version précédente ($PREVIOUS), mais elle ne répond pas non plus"
    fi
    systemctl stop "$APP-api"
    die "premier déploiement en échec : service arrêté"
fi

# Ne garder que les dernières versions
ls -1dt "$SRV"/releases/*/ | tail -n +$((KEEP + 1)) | while read -r old; do
    [ "$(readlink -f "$old")" = "$(readlink -f "$SRV/current")" ] || rm -rf "$old"
done
rm -f "$ARCHIVE"
