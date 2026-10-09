#!/usr/bin/env bash
# =============================================================================
# Déploiement de l'API depuis le PC (Git Bash) vers le VPS partagé.
#
#   VPS_HOST=mon-vps bash infrastructure/vps/deploy.sh --provision api.mondomaine.com
#       première fois (ou pour mettre à jour la configuration serveur)
#   VPS_HOST=mon-vps bash infrastructure/vps/deploy.sh
#       construit, teste, envoie et met en ligne ; retour arrière automatique si /health échoue
#   ... --dry-run     montre ce qui serait fait, sans rien envoyer
#
# Ce script vit dans le dépôt de cette application et ne dépend d'aucun fichier du dossier
# de l'autre application. Sur le VPS, il n'agit que par provision.sh et <nom de code>-release.
# =============================================================================
set -euo pipefail

APP="${APP_CODENAME:-newapp}"
VPS_USER="${VPS_USER:-ubuntu}"
VPS_HOST="${VPS_HOST:-}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

DRY_RUN=0
PROVISION_DOMAIN=""
while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run) DRY_RUN=1 ;;
        --provision) PROVISION_DOMAIN="${2:-}"; shift ;;
        *) echo "option inconnue : $1" >&2; exit 1 ;;
    esac
    shift
done

[ -n "$VPS_HOST" ] || { echo "❌ définir VPS_HOST (adresse du VPS)" >&2; exit 1; }
SSH="$VPS_USER@$VPS_HOST"
run() { if [ "$DRY_RUN" -eq 1 ]; then echo "[dry-run] $*"; else "$@"; fi; }

if [ -n "$PROVISION_DOMAIN" ]; then
    echo "── Préparation du VPS pour $PROVISION_DOMAIN"
    REMOTE_DIR="/tmp/$APP-provision"
    run ssh "$SSH" "rm -rf $REMOTE_DIR && mkdir -m 700 $REMOTE_DIR"
    run scp -q "$HERE/provision.sh" "$HERE/release.sh" "$HERE/nginx-api.conf.template" "$SSH:$REMOTE_DIR/"
    # -t : sudo demande son mot de passe dans ce terminal
    run ssh -t "$SSH" "sudo APP_CODENAME=$APP API_PORT=${API_PORT:-4710} REDIS_PORT=${REDIS_PORT:-6390} bash $REMOTE_DIR/provision.sh $PROVISION_DOMAIN; rm -rf $REMOTE_DIR"
    exit 0
fi

cd "$ROOT"
echo "── Vérifications locales"
npm run typecheck >/dev/null
npm test >/dev/null
echo "   types et tests : OK"

echo "── Construction"
rm -rf backend/dist
npm run build --workspace backend >/dev/null

ARCHIVE="$APP-$(date +%Y%m%d-%H%M%S).tar.gz"
LOCAL_ARCHIVE="${TMPDIR:-/tmp}/$ARCHIVE"
# Ni .env, ni tests, ni sources : seulement ce qui tourne en production. Les package.json du
# site et du logiciel ne servent qu'à garder le fichier de verrouillage cohérent : ni l'un ni
# l'autre n'est installé sur le VPS.
tar -czf "$LOCAL_ARCHIVE" package.json package-lock.json \
    backend/package.json backend/dist backend/migrations web/package.json desktop/package.json
echo "   archive : $(du -h "$LOCAL_ARCHIVE" | cut -f1)"

echo "── Envoi et mise en ligne"
run scp -q "$LOCAL_ARCHIVE" "$SSH:/tmp/$ARCHIVE"
run ssh -t "$SSH" "sudo /usr/local/sbin/$APP-release /tmp/$ARCHIVE"
rm -f "$LOCAL_ARCHIVE"
