# DANKÜCHEN Exkluzív Stúdió Kaposvár

A Lamelló Kft. kaposvári DANKÜCHEN bemutatótermének weboldala, [Astro](https://astro.build) alapon.

## Indítás

Node.js 22.23.4 vagy újabb kell (`.nvmrc`: 24).

```sh
npm install
npm run dev      # fejlesztői szerver: http://localhost:4321
npm run build    # statikus oldal a dist/client/, API a dist/server/ mappába
npm run preview  # a build megtekintése
npm test         # a foglalási szabályok és a foglalas.json ellenőrzése
```

## Oldalak

| Útvonal | Fájl |
|---|---|
| `/` | `src/pages/index.astro` – Főoldal |
| `/konyhak/` | `src/pages/konyhak.astro` – Konyhák (szűrő, galéria, okos részletek) |
| `/dan-first/` | `src/pages/dan-first.astro` – DAN FIRST konyhacsomagok, letölthető katalógus |
| `/kapcsolat/` | `src/pages/kapcsolat.astro` – Elérhetőség, térkép, Lamelló bemutatkozás |
| `/idopontfoglalas/` | `src/pages/idopontfoglalas.astro` – Látványtervezés foglalás |
| `/koszonjuk/` | sikeres foglalás után |
| `/adatkezeles/` | adatkezelési tájékoztató (`src/content/szovegek/adatkezeles.md`) |
| `/api/szabad-idopontok` | `src/pages/api/szabad-idopontok.ts` – szabad órák (Node) |
| `/api/foglalas` | `src/pages/api/foglalas.ts` – foglalás beküldése (Node) |

## Felépítés

Az oldal két részből áll. A látogató által látott oldalak statikus fájlok, ezeket a build állítja elő, és az Apache szolgálja ki. Csak az időpontfoglalás fut szerveren: egy kis Node-folyamat, amelyet az Apache a `/api` útvonalon ér el, és amely kívülről közvetlenül nem elérhető.

```
Böngésző
   │
   ▼
Apache (443-as port)
   ├─ /dankuchen/...      → /var/www/dankuchen      statikus oldalak
   └─ /dankuchen/api/...  → Node, 127.0.0.1:4322    szabad órák, foglalás
                               ├─ SQLite fájl       /var/lib/dankuchen/foglalasok.db
                               └─ SMTP              mail.fws.hu:587 (e-mailek)
```

A `/dankuchen` előtag a teszt szerver miatt van, és a build `BASE_PATH` értékéből jön. Saját domainen a build `BASE_PATH` nélkül készül, az előtag ekkor eltűnik. A belső linkek ezért mindig a `url()` segédfüggvénnyel (`src/utils/url.ts`) készülnek.

### Könyvtárak

```
.
├── astro.config.mjs          Astro beállítások: base útvonal, Node adapter
├── package.json              függőségek, npm parancsok
├── .nvmrc                    Node verzió
├── .env.example              minta a szerveren lévő env fájlhoz
├── data/                     helyi fejlesztői adatbázis (nincs a gitben)
├── public/                   változtatás nélkül kerül az oldalra
│   ├── dan-first/            letölthető DAN FIRST katalógus
│   └── fonts/                márkafontok
├── src/
│   ├── assets/               képek és logók, a build webre optimalizálja őket
│   ├── components/           Header, Footer, Ikon, Jelveny, Szolgaltatasok
│   ├── content/              md tartalom: konyhak, reszletek, szolgaltatasok, dan-first, szovegek
│   ├── content.config.ts     a tartalomgyűjtemények sémái
│   ├── data/
│   │   ├── studio.json       cím, nyitvatartás, telefon, cégadatok
│   │   └── foglalas.json     az időpontfoglalás minden beállítása
│   ├── layouts/Layout.astro  közös oldalváz: head, fontok, fejléc, lábléc
│   ├── lib/foglalas/         az időpontfoglalás kódja (lásd lent)
│   ├── pages/                minden fájl egy útvonal
│   │   └── api/              a két Node-on futó végpont
│   ├── styles/global.css     színek, fontok, közös osztályok
│   └── utils/url.ts          belső linkek a base útvonallal
├── test/foglalas.test.ts     a foglalási szabályok tesztjei
└── deploy/                   telepítés és üzemeltetés (lásd lent)
```

### Az időpontfoglalás kódja

| Fájl | Mit csinál |
|---|---|
| `src/pages/idopontfoglalas.astro` | Az űrlap és a böngészőben futó script: betölti a szabad órákat, beküldi a foglalást, megjeleníti a hibákat |
| `src/pages/api/szabad-idopontok.ts` | GET: a szabad órák napokra bontva, személyes adat nélkül |
| `src/pages/api/foglalas.ts` | POST: a foglalás ellenőrzése és mentése, a levélküldés elindítása |
| `src/lib/foglalas/idopontok.ts` | Szabályok: ünnepek, foglalható napok és órák, dátumfeliratok. A böngésző is használja a feliratokhoz, ezért nincs benne Node-függőség és beállítás-import |
| `src/lib/foglalas/beallitasok.ts` | Beolvassa és ellenőrzi a `foglalas.json` fájlt |
| `src/lib/foglalas/db.ts` | SQLite: tábla létrehozása, foglalás, foglalt órák, lemondás, 2 évnél régebbi sorok törlése |
| `src/lib/foglalas/szerver.ts` | Megnyitja az adatbázist, érvényesíti a lemondásokat, IP-korlát, JSON-válasz |
| `src/lib/foglalas/urlap.ts` | A beküldött mezők ellenőrzése |
| `src/lib/foglalas/email.ts` | A két levél szövege, a naptármelléklet, a küldés. A feladó neve és a tárgyak a `foglalas.json` fájlból jönnek |

Egy foglalás útja:

1. Az oldal betöltésekor a böngésző lekéri a szabad órákat, és ebből tölti fel a Dátum és az Óra mezőt.
2. Beküldéskor a szerver sorban ellenőrzi a rejtett mezőt, az IP-korlátot, a mezőket, az időpontot a szabályok szerint, végül az élő foglalások számát.
3. A mentésnél az adatbázis egyedi indexe dönt: ha az órát közben lefoglalták, a válasz `409`, és az űrlap frissíti a listát.
4. Siker esetén a válasz `201`, a böngésző a köszönőoldalra lép, a levelek a háttérben mennek ki. Ha a levélküldés nem sikerül, a foglalás érvényes marad, a hiba a naplóba kerül.

| Válasz | Jelentés |
|---|---|
| `201` | Sikeres foglalás |
| `400` | Hibás adat (`adat`) vagy nem foglalható időpont (`idopont`) |
| `409` | Az órát közben lefoglalták (`foglalt`) |
| `429` | Túl sok kérés erről az IP-ről (`tul-sok-keres`), vagy túl sok élő foglalás (`tul-sok-foglalas`) |

Az adatbázis a szolgáltatás indulása utáni első kérésnél nyílik meg. Ekkor érvényesülnek a `lemondottFoglalasok` azonosítói, és törlődnek a 2 évnél régebbi sorok. A `deploy/telepit.sh` ellenőrző hívása miatt ez telepítéskor azonnal megtörténik.

## Tartalom szerkesztése

A szövegek és képek md fájlokban vannak, kód nélkül szerkeszthetők:

- `src/content/konyhak/*.md` – konyhamodellek (név, alcím, csoportok, sorrend, főoldali kiemelés, kép, galéria, leírás)
- `src/content/szolgaltatasok/*.md` – Látványtervezés, Kiszállítás, Helyszíni szerelés
- `src/content/reszletek/*.md` – okos részletek a Konyhák oldalon
- `src/content/dan-first/*.md` – DAN FIRST csomagok (Urban Line, Cozy Chic, Family Concept): név, elrendezés, ár, képek, bútor- és géplista. A minden csomagban közös tételek, az előnyök és a frontszínek a `src/pages/dan-first.astro` elején vannak.
- `public/dan-first/dan-first-katalogus.pdf` – a letölthető DAN FIRST katalógus (új katalógusnál ugyanezzel a névvel kell felülírni)
- `src/content/szovegek/lamello.md` – Lamelló bemutatkozás
- `src/data/studio.json` – cím, nyitvatartás, telefon, e-mail, kapcsolattartó, cégadatok
- `src/data/foglalas.json` – az időpontfoglalás minden beállítása (lásd lent)
- `src/assets/` – képek és logók (az Astro build közben webre optimalizálja őket)

A `csoportok` mezőben egy modell több csoportban is szerepelhet (pl. `csoportok: [fogantyus, videkies]`). A lehetséges értékek: `fogantyu-nelkuli`, `fogantyus`, `videkies`, `kis-meretu`. Ezekből lesznek a Konyhák oldal szűrőgombjai.

Új konyhamodell: másolj le egy meglévő md fájlt, írd át, és tedd a képeit a `src/assets/konyhak/<modell>/` mappába.

## Arculat

A színek és fontok a DANKÜCHEN Markenidentität (2026) alapján a `src/styles/global.css` fájlban vannak. A DAN piros csak a fő foglalás gombon szerepel, a stúdióblokk és a jelvény Tamarillo színű (exkluzív stúdió).

### Márkafontok

A Gazpacho Medium Italic és a GT Walsheim Regular licencköteles (webes használatra licencelt). A woff2 fájlok a repóban vannak:

```
public/fonts/Gazpacho-MediumItalic.woff2
public/fonts/GT-Walsheim-Regular.woff2
```

A woff2 fájlok az eredeti OTF-ekből készülnek, csak az oldalhoz szükséges karakterekkel (latin, magyar ékezetek, tipográfiai jelek, €, →). Így fontonként kb. 15–19 KB-osak a ~90–100 KB-os OTF helyett. Előállításuk (a fontTools és a brotli Python csomag kell hozzá: `pip install fonttools brotli`):

```sh
KARAKTEREK='U+0020-007E,U+00A0-00FF,U+0150-0151,U+0170-0171,U+2013-2014,U+2018-201E,U+2022,U+2026,U+20AC,U+2192'
python3 -m fontTools.subset Gazpacho-MediumItalic.otf --flavor=woff2 --unicodes="$KARAKTEREK" \
  --layout-features='kern,liga,calt' --output-file=public/fonts/Gazpacho-MediumItalic.woff2
python3 -m fontTools.subset GT-Walsheim-LC-Regular.otf --flavor=woff2 --unicodes="$KARAKTEREK" \
  --layout-features='kern,liga,calt' --output-file=public/fonts/GT-Walsheim-Regular.woff2
```

Ha a szövegbe új különleges karakter kerül (pl. más nyíl vagy ×), add hozzá a `KARAKTEREK` listához, és generáld újra a fájlokat. Különben az a karakter tartalék fontban jelenik meg.

A `@font-face` szabályok és a fontok előtöltése (`<link rel="preload">`) a `src/layouts/Layout.astro` `<head>` részében vannak, így a böngésző már a HTML-ből tudja, mit kell letöltenie, és a `base` beállítást is követik. Ha a fájlok hiányoznak, az oldal rendszerfontokat használ (Georgia a címsorokhoz, a rendszer sans-serif fontja a szöveghez).

## Időpontfoglaló rendszer

Az oldalak statikusak maradnak, csak két API-végpont fut Node-on (`src/pages/api/`). A foglalások SQLite-ban vannak, a dupla foglalást az adatbázis egyedi indexe zárja ki. A látogató csak a szabad órákat kapja meg, és a szerver minden beküldésnél újra ellenőrzi az időpontot. Admin felület nincs, minden beállítás a `src/data/foglalas.json` fájlban van.

**A JSON módosítása után telepíteni kell** (`deploy/telepit.sh`), mert a fájl a buildbe kerül. Hibás értékre az `npm test` hibát ad, és a telepítés nem indul el.

| Feladat | Mező |
|---|---|
| Nyitvatartási napok (0 = vasárnap, 1 = hétfő … 6 = szombat) | `hetNapjai` |
| Választható kezdő órák, az alkalom hossza | `kezdoOrak`, `hosszPerc` |
| Meddig előre lehet foglalni | `legkorabbanNapMulva`, `legkesobbNapMulva` |
| Egy e-mail címre vagy telefonszámra jutó élő foglalások száma | `maxAktivFoglalas` |
| Áthelyezett pihenőnapok | `pihenonapok`, pl. `["2026-12-24"]` |
| Szabadság, céges zárva tartás | `zarvaIdoszakok`, pl. `[{ "tol": "2027-07-05", "ig": "2027-07-09", "ok": "Szabadság" }]` |
| Telefonos időpont, egy óra lezárása | `zartOrak`, pl. `[{ "nap": "2027-03-10", "ora": "10:00", "ok": "Kiss Anna" }]` |
| Webes foglalás lemondása | `lemondottFoglalasok`, pl. `[12, 15]` |
| Kik kapnak értesítést a foglalásról (egy vagy több cím) | `email.ertesitesiCimek` |
| SMTP szerver és felhasználó | `email.smtpHost`, `smtpPort`, `felhasznalo` |
| A feladó neve és címe | `email.feladoNev`, `felado` |
| A levelek tárgya (a `{idopont}` és a `{nev}` helyére a foglalás adatai kerülnek) | `email.targyLatogatonak`, `targyStudionak` |
| A visszaigazoló levél és az oldal „Mit hozz magaddal?” listája | `mitHozzMagaddal` |

- **Ünnepnapok:** a törvényes ünnepeket a kód számolja ki, a mozgó ünnepeket is. Az áthelyezett pihenőnapok évente rendeletben jelennek meg, ezeket kézzel kell a `pihenonapok` listába írni (a szombati munkanapokat nem, mert a stúdió szombaton zárva van). A 2026-os adat a 10/2025. (IV. 30.) NGM rendeletből van, **a 2027-es rendelet adatai még nincsenek felvéve**.
- **Lemondás:** a foglalás azonosítója a stúdiónak küldött levélben szerepel. Fel kell venni a `lemondottFoglalasok` listába és telepíteni, ettől az óra újra szabad. A látogató nem kap automatikus levelet, őt a stúdió értesíti.
- **Foglalás megtekintése és törlése a szerveren:** `deploy/foglalasok.mjs` (a használata a fájl elején). A 2 évnél régebbi foglalások automatikusan törlődnek.
- **E-mail:** a látogató visszaigazolást kap, az `ertesitesiCimek` minden címe értesítést, mindkettő `.ics` naptármelléklettel. A jelszó nem lehet a JSON-ban, mert az a gitbe kerül: az `SMTP_JELSZO` környezeti változóban van (`.env.example`). Nélküle a foglalás működik, de nem megy ki levél.
- **Visszaélés ellen:** rejtett `_gotcha` mező, `maxAktivFoglalas`, és IP-nként 10 percenként 5 kérés (csak memóriában, IP-cím nem kerül az adatbázisba).
- **Fejlesztés:** az `npm run dev` mindent elindít, az adatbázis a gitből kizárt `data/foglalasok.db`, levél nem megy ki.

## Telepítés

A telepítés a saját gépről, a repóból indul, és az oldalt és az API-t is frissíti:

```sh
deploy/telepit.sh
```

Sorban ezt csinálja: lefuttatja a teszteket, buildel `BASE_PATH=/dankuchen` értékkel, elmenti a szerveren a jelenlegi statikus oldalt (`/root/dankuchen-mentes-<dátum>`, az 5 legutóbbi marad), feltölti a fájlokat, telepíti a függőségeket, újraindítja a szolgáltatást, és ellenőrzi, hogy az API válaszol. Hibás `foglalas.json` vagy bukó teszt esetén nem tölt fel semmit. Azt tölti fel, ami a munkakönyvtárban van, a nem commitolt változásokkal együtt.

### Mi hová kerül

| A repóból | A szerveren | Tartalma |
|---|---|---|
| `dist/client/` | `/var/www/dankuchen/` | statikus oldal |
| `dist/server/` | `/opt/dankuchen/server/` | API kód |
| `package.json`, `package-lock.json` | `/opt/dankuchen/` | ezekből települ a `node_modules` (`npm ci`) |
| `deploy/foglalasok.mjs`, `deploy/mentes.mjs` | `/opt/dankuchen/` | segédszkriptek |

Ezeket a telepítés nem érinti, csak a szerveren léteznek:

| A szerveren | Tartalma |
|---|---|
| `/var/lib/dankuchen/foglalasok.db` | a foglalások, csak a `dankuchen` felhasználó olvashatja |
| `/var/lib/dankuchen/mentesek/` | az adatbázis napi mentései, a 14 legutóbbi marad |
| `/etc/dankuchen/dankuchen.env` | `DB_PATH`, `SMTP_JELSZO` |

A `deploy/` mappa többi fájlja egyszeri szerverbeállításhoz kell, a `telepit.sh` nem másolja fel:

| A repóban | A szerveren | Mit csinál |
|---|---|---|
| `deploy/dankuchen.service` | `/etc/systemd/system/` | futtatja a Node-ot |
| `deploy/dankuchen-mentes.service`, `.timer` | `/etc/systemd/system/` | napi adatbázis-mentés 3:30-kor (a szerver UTC szerint) |
| `deploy/apache-dankuchen.conf` | a tartalma a `/etc/apache2/sites-available/default-ssl.conf` fájlban | továbbítja az API-kéréseket a Node-nak |

### Szolgáltatások a szerveren

| Szolgáltatás | Szerepe | Ha leáll |
|---|---|---|
| `apache2` | Kiszolgálja az oldalt, és továbbítja az API-kéréseket | Az oldal és a webáruház sem érhető el |
| `dankuchen` | Node-folyamat a `127.0.0.1:4322` címen, a foglalási API | Az oldal működik, de nem lehet foglalni: hibaüzenet és telefonszám jelenik meg |
| `dankuchen-mentes.timer` | Elindítja a napi mentést | Minden működik, de nem készül új mentés |

MySQL és PHP nem kell. Az SQLite nem külön szolgáltatás, hanem egy fájl, amelyet a Node-folyamat kezel.

```sh
systemctl status dankuchen                                    # fut-e
journalctl -u dankuchen -f                                    # napló, levélküldési hibák
systemctl restart dankuchen                                   # újraindítás
sudo -u dankuchen node /opt/dankuchen/foglalasok.mjs lista    # közelgő foglalások
```

### Hol mit lehet módosítani

| Mit | Hol | Utána |
|---|---|---|
| Foglalási beállítások, szövegek, képek, kód | a repóban, a saját gépen | `deploy/telepit.sh` |
| SMTP-jelszó, adatbázis helye | `/etc/dankuchen/dankuchen.env`, a szerveren | `systemctl restart dankuchen` |
| Port, futtatás módja | `/etc/systemd/system/dankuchen.service`, a szerveren | `systemctl daemon-reload && systemctl restart dankuchen` |
| API továbbítása, jelszóvédelem | `/etc/apache2/sites-available/default-ssl.conf`, a szerveren | `apache2ctl configtest && systemctl reload apache2` |

A `foglalas.json` tartalma a buildbe kerül, ezért a szerveren nincs ilyen fájl, és a `/opt/dankuchen/server/` fájljait nem érdemes szerkeszteni, mert a következő telepítés felülírja őket. A port módosításához az Apache-szabályt és a `deploy/telepit.sh` ellenőrző hívását is át kell írni.

### Egyszeri szerverbeállítás

Új szerveren egyszer kell elvégezni, utána a `deploy/telepit.sh` elég:

```sh
# Node 24
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/nodesource.gpg
echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
apt-get update && apt-get install -y --no-install-recommends nodejs

# Felhasználó, mappák, jelszófájl (az SMTP_JELSZO értékét kézzel kell beírni)
useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin dankuchen
mkdir -p /opt/dankuchen /etc/dankuchen
printf 'DB_PATH=/var/lib/dankuchen/foglalasok.db\nSMTP_JELSZO=\n' > /etc/dankuchen/dankuchen.env
chown root:dankuchen /etc/dankuchen/dankuchen.env && chmod 640 /etc/dankuchen/dankuchen.env

# systemd: előbb a deploy/*.service és deploy/*.timer fájlokat kell az /etc/systemd/system/ mappába másolni
systemctl daemon-reload
systemctl enable dankuchen dankuchen-mentes.timer
systemctl start dankuchen-mentes.timer

# Apache: előbb a deploy/apache-dankuchen.conf tartalmát kell a virtual hostba írni
a2enmod proxy_http
apache2ctl configtest && systemctl reload apache2
```

### Éles indulás

A `<Location /dankuchen/api>` jelszóvédelmet az oldal `<Directory>` védelmével együtt le kell venni. Ha az oldal saját domainre kerül, a `deploy/telepit.sh` `BASE_PATH` értékét, az API-ellenőrzés útvonalát és az Apache-szabályt is módosítani kell, mert mindegyikben szerepel a `/dankuchen` előtag.
