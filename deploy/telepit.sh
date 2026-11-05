#!/usr/bin/env bash
# Az oldal és a foglalási API telepítése a szerverre. Használat: deploy/telepit.sh [frontend|backend], paraméter nélkül mindkettő.
# Hibás foglalas.json vagy bukó teszt esetén nem tölt fel semmit.
set -euo pipefail
cd "$(dirname "$0")/.."

CEL="${1:-mind}"
case "$CEL" in
  mind | frontend | backend) ;;
  *)
    echo "Használat: deploy/telepit.sh [frontend|backend]" >&2
    exit 1
    ;;
esac

SZERVER=root@fabutorwebaruhaz.hu
SSH_OPCIOK='ssh -p 2222 -o BatchMode=yes'
WEBROOT=/var/www/dankuchen
APP=/opt/dankuchen

if [ "$CEL" != frontend ]; then
  npm --prefix backend test
fi
if [ "$CEL" != backend ]; then
  npm --prefix frontend run build
fi

if [ "$CEL" != backend ]; then
  # Az előző statikus verzió mentése, az 5 legutóbbi marad.
  $SSH_OPCIOK "$SZERVER" "cp -a $WEBROOT /root/dankuchen-mentes-$(date +%Y%m%d-%H%M) && ls -dt /root/dankuchen-mentes-* | tail -n +6 | xargs -r rm -rf"
  rsync -az --delete --chown=ubuntu:ubuntu -e "$SSH_OPCIOK" frontend/dist/ "$SZERVER:$WEBROOT/"
fi

if [ "$CEL" != frontend ]; then
  # Az adatbázis a /var/lib/dankuchen mappában van, ezt az rsync nem éri el.
  rsync -az --delete --chown=root:root --exclude node_modules --exclude test --exclude data --exclude '.env*' -e "$SSH_OPCIOK" backend/ "$SZERVER:$APP/backend/"
  rsync -az --delete --chown=root:root -e "$SSH_OPCIOK" shared/ "$SZERVER:$APP/shared/"
  rsync -az --chown=root:root -e "$SSH_OPCIOK" deploy/foglalasok.mjs deploy/mentes.mjs "$SZERVER:$APP/"
  $SSH_OPCIOK "$SZERVER" "cd $APP/backend && npm ci --omit=dev --ignore-scripts --no-audit --no-fund && systemctl restart dankuchen && sleep 2 && curl -fsS -o /dev/null http://127.0.0.1:4322/api/szabad-idopontok && echo 'A foglalási API válaszol.'"
fi
