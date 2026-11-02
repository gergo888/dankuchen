#!/usr/bin/env bash
# Az oldal és az időpontfoglaló API telepítése a szerverre. Hibás foglalas.json vagy bukó teszt esetén nem tölt fel semmit.
set -euo pipefail
cd "$(dirname "$0")/.."

SZERVER=root@fabutorwebaruhaz.hu
SSH_OPCIOK='ssh -p 2222 -o BatchMode=yes'
WEBROOT=/var/www/dankuchen
APP=/opt/dankuchen

npm test
BASE_PATH=/dankuchen npm run build

# Az előző statikus verzió mentése, az 5 legutóbbi marad. Az adatbázis a webrooton kívül van, azt az rsync nem éri el.
$SSH_OPCIOK "$SZERVER" "cp -a $WEBROOT /root/dankuchen-mentes-$(date +%Y%m%d-%H%M) && ls -dt /root/dankuchen-mentes-* | tail -n +6 | xargs -r rm -rf"

rsync -az --delete --chown=ubuntu:ubuntu -e "$SSH_OPCIOK" dist/client/ "$SZERVER:$WEBROOT/"
rsync -az --delete --chown=root:root -e "$SSH_OPCIOK" dist/server/ "$SZERVER:$APP/server/"
rsync -az --chown=root:root -e "$SSH_OPCIOK" package.json package-lock.json deploy/foglalasok.mjs deploy/mentes.mjs "$SZERVER:$APP/"

$SSH_OPCIOK "$SZERVER" "cd $APP && npm ci --omit=dev --ignore-scripts --no-audit --no-fund && systemctl restart dankuchen && sleep 2 && curl -fsS -o /dev/null http://127.0.0.1:4322/dankuchen/api/szabad-idopontok && echo 'A foglalási API válaszol.'"
