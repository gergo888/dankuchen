#!/usr/bin/env bash
# Pillanatkép az éles foglalási adatbázisról a saját gépre, például DBeaverhez.
# Használat: deploy/adatbazis-letoltes.sh [cél], alapértelmezés: ~/dankuchen-adatbazis/foglalasok.db
#
# A szerveren a napi mentés szkriptje (mentes.mjs, VACUUM INTO) egy ideiglenes mappába konzisztens
# másolatot készít. Ez a futó szolgáltatás mellett is biztonságos, és egyetlen fájl, WAL nélkül. A másolat
# SSH-n jön le, és a cél fájlt csak a sikeres letöltés után cseréli le.
#
# A letöltött fájl csak másolat: ami benne módosul, nem kerül vissza a szerverre. Az éles adatokat az
# admin felületen kell módosítani. A fájlban ügyfelek személyes adatai vannak, csak a tulajdonos olvashatja.
set -euo pipefail

SZERVER=root@fabutorwebaruhaz.hu
SSH_OPCIOK=(-p 2222 -o BatchMode=yes)
CEL="${1:-$HOME/dankuchen-adatbazis/foglalasok.db}"

umask 077
mkdir -p "$(dirname "$CEL")"
IDEIGLENES="$(mktemp "$CEL.XXXXXX")"
trap 'rm -f "$IDEIGLENES"' EXIT

ssh "${SSH_OPCIOK[@]}" "$SZERVER" 'bash -s' >"$IDEIGLENES" <<'EOF'
set -euo pipefail
m=$(mktemp -d)
trap 'rm -rf "$m"' EXIT
chown dankuchen "$m"
runuser -u dankuchen -- env DB_PATH=/var/lib/dankuchen/foglalasok.db MENTES_MAPPA="$m" \
  node --disable-warning=ExperimentalWarning /opt/dankuchen/mentes.mjs >/dev/null
cat "$m"/foglalasok-*.db
EOF

if [ "$(head -c 15 "$IDEIGLENES")" != 'SQLite format 3' ]; then
  echo "A letöltött fájl nem SQLite-adatbázis, a(z) $CEL nem változott." >&2
  exit 1
fi
mv -f "$IDEIGLENES" "$CEL"
echo "Letöltve: $CEL ($(stat -c %s "$CEL") bájt, $(date '+%Y-%m-%d %H:%M'))"
