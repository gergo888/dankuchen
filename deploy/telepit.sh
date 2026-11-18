#!/usr/bin/env bash
# Az oldal és a foglalási API telepítése. Használat: deploy/telepit.sh [frontend|backend], paraméter nélkül mindkettő.
# A szerveren (a repó ott az ubuntu felhasználóé) helyben telepít, sudo-val; máshol SSH-n át a szerverre.
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
# Az éles foglalási API portja (deploy/dankuchen.service, deploy/apache-dankuchen.conf). A 4322 a fejlesztésé.
ELES_PORT=4330

# A szolgáltatás fájlja csak a szerveren létezik: ott helyben telepít.
if [ -f /etc/systemd/system/dankuchen.service ]; then
  HELYI=true
  echo "Telepítés helyben, ezen a szerveren."
else
  HELYI=false
  echo "Telepítés SSH-n át: $SZERVER"
fi

# Parancs a szerveren, rootként.
szerveren() {
  if $HELYI; then sudo bash -c "$1"; else $SSH_OPCIOK "$SZERVER" "$1"; fi
}

# Fájlok másolása a szerverre: masol <tulajdonos> [rsync-kapcsolók...] <forrás...> <cél a szerveren>
masol() {
  local tulaj=$1
  shift
  local cel=${*: -1}
  local tobbi=("${@:1:$#-1}")
  if $HELYI; then
    sudo rsync -a --chown="$tulaj" "${tobbi[@]}" "$cel"
  else
    rsync -az --chown="$tulaj" -e "$SSH_OPCIOK" "${tobbi[@]}" "$SZERVER:$cel"
  fi
}

if [ "$CEL" != frontend ]; then
  npm --prefix backend test
fi
if [ "$CEL" != backend ]; then
  npm --prefix frontend run build
fi

if [ "$CEL" != backend ]; then
  # Az előző statikus verzió mentése, az 5 legutóbbi marad.
  szerveren "cp -a $WEBROOT /root/dankuchen-mentes-$(date +%Y%m%d-%H%M) && ls -dt /root/dankuchen-mentes-* | tail -n +6 | xargs -r rm -rf"
  masol ubuntu:ubuntu --delete frontend/dist/ "$WEBROOT/"
fi

if [ "$CEL" != frontend ]; then
  # Az adatbázis a /var/lib/dankuchen mappában van, ezt az rsync nem éri el.
  masol root:root --delete --exclude node_modules --exclude test --exclude data --exclude '.env*' backend/ "$APP/backend/"
  masol root:root --delete shared/ "$APP/shared/"
  masol root:root deploy/foglalasok.mjs deploy/mentes.mjs "$APP/"
  # Az újraindításkor lefuthat egy adatbázis-migráció, ezért előtte mentés készül (a napi mentések mellé).
  szerveren "runuser -u dankuchen -- env DB_PATH=/var/lib/dankuchen/foglalasok.db node --disable-warning=ExperimentalWarning $APP/mentes.mjs"
  szerveren "cd $APP/backend && npm ci --omit=dev --ignore-scripts --no-audit --no-fund && systemctl restart dankuchen && sleep 2 && curl -fsS -o /dev/null http://127.0.0.1:$ELES_PORT/api/szabad-idopontok && echo 'A foglalási API válaszol.'"
fi
