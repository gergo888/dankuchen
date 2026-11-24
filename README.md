# DANKÜCHEN Exkluzív Stúdió Kaposvár

A Lamelló Kft. kaposvári DANKÜCHEN bemutatótermének weboldala, [Astro](https://astro.build) alapon.

## Indítás

Node.js 22.23.4 vagy újabb kell (`.nvmrc`: 24). A parancsok a repó gyökeréből futnak.

```sh
npm run setup    # függőségek telepítése mindkét alkalmazásban
npm run dev      # backend (127.0.0.1:4322) és frontend (http://localhost:4321) együtt, a Ctrl+C mindkettőt leállítja
npm run build    # a frontend buildje a frontend/dist/ mappába
npm test         # a backend tesztjei: foglalási szabályok, API, admin felület, beállítások
```

Az admin felület fejlesztéskor a http://localhost:4321/admin/ címen érhető el. Előtte próbajelszó kell: a `node backend/admin-jelszo.ts --kiir` kiírja a két sort, ezeket a gitből kizárt `backend/.env` fájlba kell másolni, és az `npm run dev` beolvassa (módosítás után újra kell indítani).

A fejlesztői szerverek csak helyben figyelnek (127.0.0.1). Az éles foglalási API a szerveren a 4330-as porton fut, így a 4321 és a 4322 a fejlesztésé.

### Fejlesztés a VPS-en

> **Szünetel (2026-11-18):** a VPS processzora nem tudja futtatni a képfeldolgozó `sharp` csomagot, ezért ott nem készül el a frontend buildje, és a fejlesztői szerveren sem jelennek meg a feldolgozott képek. Addig a fejlesztés és a frontend telepítése a saját gépről megy. Az állapot és az újrapróbálás lépései: [docs/vps-koltoztetes.md](docs/vps-koltoztetes.md).

A repó a szerveren is megvan: `/home/ubuntu/dankuchen`, az `ubuntu` felhasználóé. Ott ugyanúgy `npm run dev` indítja a két fejlesztői szervert (érdemes `tmux`-ban, hogy a kapcsolat bontása után is fusson), a saját gépről pedig SSH-alagúton érhetők el:

```sh
ssh -p 2222 -N -L 4321:127.0.0.1:4321 -L 4322:127.0.0.1:4322 ubuntu@fabutorwebaruhaz.hu
```

Vagy a saját gép `~/.ssh/config` fájljába, utána elég az `ssh -N dankuchen-dev`:

```
Host dankuchen-dev
    HostName fabutorwebaruhaz.hu
    Port 2222
    User ubuntu
    LocalForward 4321 127.0.0.1:4321
    LocalForward 4322 127.0.0.1:4322
```

Amíg az alagút él, a saját gépen a http://localhost:4321 az oldal, a http://localhost:4321/admin/ az admin, a http://localhost:4322/api/szabad-idopontok a backend.

- **Fejlesztői adatok:** az adatbázis a gitből kizárt `backend/data/foglalasok.db`, külön az élestől. A `/etc/dankuchen/dankuchen.env` tartalmát (SMTP-jelszó, éles adatbázis) soha nem szabad a `backend/.env`-be másolni, mert akkor a fejlesztés éles leveleket küldene, vagy az éles adatbázisba írna.
- **Pusholás a szerverről:** az `ubuntu` felhasználó SSH-kulcsát fel kell venni a GitHubra, a távoli címet pedig SSH-ra állítani: `git remote set-url origin git@github.com:gergo888/dankuchen.git`.
- **Két munkapéldány:** ha a saját gépen is van klón, munka előtt mindig `git pull`, hogy a két példány ne ágazzon el.
- **Build a szerveren:** a frontend buildje a képek miatt egy-két percig terheli a processzort, amin a webáruház is fut.

## Oldalak

| Útvonal | Fájl |
|---|---|
| `/` | `frontend/src/pages/index.astro` – Főoldal |
| `/konyhak/` | `frontend/src/pages/konyhak.astro` – Konyhák (szűrő, galéria, okos részletek). A galéria közös a DAN FIRST oldallal: `frontend/src/components/Galeria.astro` (lapozás a kis képekkel, nagyítás a főképre kattintva) |
| `/dan-first/` | `frontend/src/pages/dan-first.astro` – DAN FIRST konyhacsomagok, letölthető katalógus |
| `/kapcsolat/` | `frontend/src/pages/kapcsolat.astro` – Elérhetőség, térkép, Lamelló bemutatkozás |
| `/idopontfoglalas/` | `frontend/src/pages/idopontfoglalas.astro` – Látványtervezés foglalás |
| `/koszonjuk/` | sikeres foglalás után |
| `/adatkezeles/` | adatkezelési tájékoztató (`frontend/src/content/szovegek/adatkezeles.md`) |
| nem létező cím | `frontend/src/pages/404.astro` – saját hibaoldal (az Apache `ErrorDocument` sora irányítja ide) |
| `/robots.txt`, `/llms.txt` | `frontend/src/pages/robots.txt.ts`, `frontend/src/pages/llms.txt.ts` – lásd: Keresők és AI |
| `/sitemap-index.xml` | a build készíti (`@astrojs/sitemap`) |
| `/api/szabad-idopontok` | `backend/src/api.ts` – szabad órák |
| `/api/foglalas` | `backend/src/api.ts` – foglalás beküldése |
| `/admin/` | `backend/src/admin/` – admin felület belépéssel, lásd: Időpontfoglaló rendszer |

## Felépítés

A projekt két külön alkalmazásból áll, saját `package.json`-nal:

- **`frontend/`:** tisztán statikus Astro-oldal. A build HTML-, CSS-, JS- és képfájlokat állít elő, ezeket az Apache szolgálja ki.
- **`backend/`:** a foglalási API és az admin felület, egy kis Node-szerver külső keretrendszer nélkül. Az Apache a `/api` és az `/admin` útvonalon éri el, kívülről közvetlenül nem elérhető. Nincs buildje, a Node közvetlenül futtatja a TypeScript-fájlokat.

Ami mindkettőnek kell, a `shared/` mappában van.

```
Böngésző
   │
   ▼
Apache (443-as port, dankuchenkaposvar.hu)
   ├─ /...        → /var/www/dankuchen      statikus oldalak (frontend)
   ├─ /api/...    → Node, 127.0.0.1:4330    szabad órák, foglalás (backend)
   └─ /admin/...  → Node, 127.0.0.1:4330    admin felület, belépéssel (backend)
                       ├─ SQLite fájl       /var/lib/dankuchen/foglalasok.db
                       └─ SMTP              mail.fws.hu:587 (e-mailek)
```

Az oldal a `dankuchenkaposvar.hu` domain gyökerében fut, saját virtual hostban (`deploy/apache-dankuchen.conf`), a webáruházzal közös szerveren. A korábbi `fabutorwebaruhaz.hu/dankuchen` cím ide irányít. A frontend belső linkjei a `url()` segédfüggvénnyel (`frontend/src/utils/url.ts`) készülnek, így a build a `BASE_PATH` változóval alkönyvtárba is készíthető. A backend az útvonal végét nézi, ezért ez nem érinti. A `/_astro/` fájlok nevében hash van, ezért a böngésző egy évig tárolhatja őket, a HTML-t viszont mindig ellenőrzi. Fejlesztéskor az Astro dev szervere továbbítja az `/api` és az `/admin` kéréseket a backendnek (`frontend/astro.config.mjs`).

### Könyvtárak

```
.
├── package.json                   közös parancsok (setup, dev, build, test), függőség nélkül
├── dev.mjs                        a két alkalmazás együttes indítása fejlesztéshez
├── .nvmrc                         Node verzió
├── frontend/                      statikus Astro-oldal
│   ├── package.json               astro
│   ├── astro.config.mjs           base útvonal, CSS a HTML-be, fejlesztői proxy az API-hoz és az adminhoz
│   ├── public/                    változtatás nélkül kerül az oldalra
│   │   └── dan-first/             letölthető DAN FIRST katalógus
│   └── src/
│       ├── assets/                képek, logók (a build webre optimalizálja őket) és márkafontok
│       ├── components/            Header, Footer, Galeria, Ikon, Jelveny, Szolgaltatasok
│       ├── content/               md tartalom: konyhak, reszletek, szolgaltatasok, dan-first, szovegek
│       ├── content.config.ts      a tartalomgyűjtemények sémái
│       ├── layouts/Layout.astro   közös oldalváz: head, fontok, fejléc, lábléc
│       ├── pages/                 minden fájl egy útvonal
│       ├── styles/global.css      színek, fontok, közös osztályok
│       └── utils/url.ts           belső linkek a base útvonallal
├── backend/                       foglalási API és admin felület
│   ├── package.json               nodemailer, zod
│   ├── foglalas.json              a levélküldés technikai beállításai (a foglalási beállítások az adminban vannak)
│   ├── admin-jelszo.ts            az admin felhasználónevének és jelszavának beállítása
│   ├── .env.example               minta a szerveren lévő env fájlhoz
│   ├── data/                      helyi fejlesztői adatbázis (nincs a gitben)
│   ├── src/                       a szerver kódja (lásd lent)
│   └── test/                      tesztek
├── shared/                        amit mindkét alkalmazás használ
│   ├── studio.json                cím, nyitvatartás, telefon, cégadatok, „Mit hozz magaddal?” lista
│   └── idopontok.ts               foglalási szabályok és dátumfeliratok
└── deploy/                        telepítés és üzemeltetés (lásd lent)
```

### Az időpontfoglalás kódja

| Fájl | Mit csinál |
|---|---|
| `frontend/src/pages/idopontfoglalas.astro` | Az űrlap és a böngészőben futó script: betölti a szabad órákat, beküldi a foglalást, megjeleníti a hibákat |
| `backend/src/server.ts` | HTTP-szerver: útválasztás, kérés beolvasása, JSON-válasz |
| `backend/src/api.ts` | A két végpont: a szabad órák lekérése, a foglalás ellenőrzése és mentése, a levélküldés elindítása |
| `backend/src/kapcsolat.ts` | Az adatbázis-kapcsolat és a beállítások egyetlen példánya. Az API és az admin is ezt használja, így az adminban mentett beállítás azonnal érvényes |
| `backend/src/beallitasok.ts` | A foglalási beállítások sémája és alapértékei (`ALAPERTEKEK`), a `foglalas.json` beolvasása és ellenőrzése |
| `backend/src/db.ts` | SQLite: séma és migrációk, foglalás, lemondás, az admin listái, a beállítások tárolása, 2 évnél régebbi sorok törlése |
| `backend/src/korlat.ts` | IP-nkénti korlát |
| `backend/src/urlap.ts` | A beküldött mezők ellenőrzése (az admin telefonos foglalásánál az e-mail nem kötelező) |
| `backend/src/email.ts` | A visszaigazoló, az értesítő és a lemondó levél, a naptármelléklet, a küldés. A feladó neve és a tárgyak a `foglalas.json` fájlból jönnek |
| `backend/src/admin/utvonalak.ts` | Az admin útválasztása és műveletei: belépés, lista, lemondás, telefonos foglalás, zárva tartás, beállítások |
| `backend/src/admin/munkamenet.ts` | Munkamenet-süti, CSRF- és Origin-ellenőrzés, a sikertelen belépések korlátja |
| `backend/src/admin/jelszo.ts` | A jelszó scrypt-hash-e és ellenőrzése |
| `backend/src/admin/oldalak.ts`, `html.ts` | Az oldalak HTML-sablonjai. A `html` sablon minden beillesztett értéket escape-el |
| `backend/src/admin/admin.css`, `admin.js` | Az admin stílusa és az egyetlen szkriptje (megerősítő kérdések) |
| `shared/idopontok.ts` | Szabályok: ünnepek, foglalható napok és órák, dátumfeliratok. A böngésző is használja a feliratokhoz, ezért nincs benne Node-függőség és beállítás-import |

Egy foglalás útja:

1. Az oldal betöltésekor a böngésző lekéri a szabad órákat, és ebből tölti fel a Dátum és az Óra mezőt.
2. Beküldéskor a szerver sorban ellenőrzi a rejtett mezőt, az IP-korlátot, a mezőket, az időpontot a szabályok szerint, végül az élő foglalások számát.
3. A mentésnél az adatbázis egyedi indexe dönt: ha az órát közben lefoglalták, a válasz `409`, és az űrlap frissíti a listát.
4. Siker esetén a válasz `201`, a böngésző a köszönőoldalra lép, a levelek a háttérben mennek ki. Ha a levélküldés nem sikerül, a foglalás érvényes marad, a hiba a naplóba kerül.

| Válasz | Jelentés |
|---|---|
| `201` | Sikeres foglalás |
| `400` | Hibás adat (`adat`) vagy nem foglalható időpont (`idopont`) |
| `404`, `405` | Ismeretlen útvonal (`nincs-ilyen`), rossz metódus (`metodus`) |
| `409` | Az órát közben lefoglalták (`foglalt`) |
| `413` | A kérés 16 KB-nál nagyobb (`tul-nagy`) |
| `429` | Túl sok kérés erről az IP-ről (`tul-sok-keres`), vagy túl sok élő foglalás (`tul-sok-foglalas`) |
| `500` | Váratlan hiba (`szerver`), a részletek a naplóba kerülnek |

Az adatbázis a szolgáltatás indulása utáni első kérésnél nyílik meg. Ekkor fut le az esetleges sémamódosítás (a `PRAGMA user_version` szerint, a meglévő foglalások megmaradnak), üres adatbázisnál ekkor kerülnek bele a beállítások alapértékei, és ekkor törlődnek a 2 évnél régebbi sorok. A `deploy/telepit.sh` előtte mentést készít, és az ellenőrző hívása miatt mindez telepítéskor azonnal megtörténik.

## Tartalom szerkesztése

A szövegek és képek md fájlokban vannak, kód nélkül szerkeszthetők:

- `frontend/src/content/konyhak/*.md` – konyhamodellek (név, alcím, csoportok, sorrend, főoldali kiemelés, kép, galéria, leírás)
- `frontend/src/content/szolgaltatasok/*.md` – Látványtervezés, Kiszállítás, Helyszíni szerelés
- `frontend/src/content/reszletek/*.md` – okos részletek a Konyhák oldalon
- `frontend/src/content/dan-first/*.md` – DAN FIRST csomagok (Urban Line, Cozy Chic, Family Concept): név, elrendezés, ár, képek, bútor- és géplista. A minden csomagban közös tételek, az előnyök és a frontszínek a `frontend/src/pages/dan-first.astro` elején vannak.
- `frontend/public/dan-first/dan-first-katalogus.pdf` – a letölthető DAN FIRST katalógus (új katalógusnál ugyanezzel a névvel kell felülírni)
- `frontend/src/content/szovegek/lamello.md` – Lamelló bemutatkozás
- `shared/studio.json` – cím, nyitvatartás, telefon, e-mail, közösségi oldalak (a lábléc ikonjai), kapcsolattartó, cégadatok, „Mit hozz magaddal?” lista (az oldal és a visszaigazoló levél is használja)
- `backend/foglalas.json` – az időpontfoglalás minden beállítása (lásd lent)
- `frontend/src/assets/` – képek és logók (az Astro build közben webre optimalizálja őket)

A `csoportok` mezőben egy modell több csoportban is szerepelhet (pl. `csoportok: [fogantyus, videkies]`). A lehetséges értékek: `fogantyu-nelkuli`, `fogantyus`, `videkies`, `kis-meretu`. Ezekből lesznek a Konyhák oldal szűrőgombjai.

Új konyhamodell: másolj le egy meglévő md fájlt, írd át, és tedd a képeit a `frontend/src/assets/konyhak/<modell>/` mappába.

## Arculat

A színek és fontok a DANKÜCHEN Markenidentität (2026) alapján a `frontend/src/styles/global.css` fájlban vannak. A DAN piros csak a fő foglalás gombon szerepel, a stúdióblokk és a jelvény Tamarillo színű (exkluzív stúdió).

### Márkafontok

A Gazpacho Medium Italic és a GT Walsheim Regular licencköteles (webes használatra licencelt). A woff2 fájlok a repóban vannak:

```
frontend/src/assets/fonts/Gazpacho-MediumItalic.woff2
frontend/src/assets/fonts/GT-Walsheim-Regular.woff2
```

A woff2 fájlok az eredeti OTF-ekből készülnek, csak az oldalhoz szükséges karakterekkel (latin, magyar ékezetek, tipográfiai jelek, €, →). Így fontonként kb. 15–19 KB-osak a ~90–100 KB-os OTF helyett. Előállításuk (a fontTools és a brotli Python csomag kell hozzá: `pip install fonttools brotli`):

```sh
KARAKTEREK='U+0020-007E,U+00A0-00FF,U+0150-0151,U+0170-0171,U+2013-2014,U+2018-201E,U+2022,U+2026,U+20AC,U+2192'
python3 -m fontTools.subset Gazpacho-MediumItalic.otf --flavor=woff2 --unicodes="$KARAKTEREK" \
  --layout-features='kern,liga,calt' --output-file=frontend/src/assets/fonts/Gazpacho-MediumItalic.woff2
python3 -m fontTools.subset GT-Walsheim-LC-Regular.otf --flavor=woff2 --unicodes="$KARAKTEREK" \
  --layout-features='kern,liga,calt' --output-file=frontend/src/assets/fonts/GT-Walsheim-Regular.woff2
```

Ha a szövegbe új különleges karakter kerül (pl. más nyíl vagy ×), add hozzá a `KARAKTEREK` listához, és generáld újra a fájlokat. Különben az a karakter tartalék fontban jelenik meg. A build hash-t tesz a fájlnévbe, ezért az új változatot a visszatérő látogatók is azonnal megkapják.

A `@font-face` szabályok és a fontok előtöltése (`<link rel="preload">`) a `frontend/src/layouts/Layout.astro` `<head>` részében vannak, így a böngésző már a HTML-ből tudja, mit kell letöltenie. Ha a fontok nem töltődnek be, az oldal rendszerfontokat használ (Georgia a címsorokhoz, a rendszer sans-serif fontja a szöveghez).

## Keresők és AI

Minden ezekhez szükséges adat a meglévő forrásokból készül a build közben, külön karbantartást nem igényel:

- **Strukturált adat (JSON-LD):** minden oldalon a stúdió helyi üzletként (`FurnitureStore`) a `shared/studio.json` adataiból: név, cím, telefon, e-mail, nyitvatartás, közösségi oldalak (`sameAs`). A DAN FIRST oldalon a csomagok termékként, a tartalomban megadott árral. A címet, a nyitvatartást, a telefonszámot és az árat a `frontend/src/utils/studio.ts` bontja fel. Ha valamelyik formátuma megváltozik (pl. `"Hétfő–péntek"`, `"8:00–16:00"`, `"2.399.000 Ft"`), a build hibával leáll, és megmondja, melyik mezővel van gond.
- **Link előnézete** (Facebook, Messenger, Viber, e-mail): az `og:` adatok a `Layout.astro` fájlban vannak. A kép alapértelmezésben a főoldal hero képe, egy oldal a `kep` és a `kepLeiras` paraméterrel adhat sajátot.
- **`robots.txt`:** minden robot, az AI-keresőké is, olvashatja az oldalt, csak az `/api/` tiltott.
- **`sitemap-index.xml`:** a köszönőoldal és a 404-es oldal nélkül. Ezeken `noindex` van.
- **`llms.txt`:** rövid összefoglaló az AI-keresőknek a stúdió adataiból, a konyhamodellekből és a DAN FIRST csomagokból.

### WebMCP: időpontfoglalás AI-agenteknek

A [WebMCP](https://developer.chrome.com/docs/ai/webmcp) segítségével a böngészőben futó AI-agentek (pl. Gemini in Chrome) kattintgatás nélkül, típusos eszközökön keresztül használhatják a foglalást. Az eszközök az `/idopontfoglalas/` oldalon regisztrálódnak, a kódjuk a `frontend/src/utils/webmcp.ts` fájlban van:

| Eszköz | Mit csinál |
|---|---|
| `szabad_idopontok` | Csak olvas. Paraméter nélkül a foglalható napokat adja vissza a szabad időpontok számával, `nap` megadásával az adott nap kezdési időpontjait. |
| `idopont_foglalasa` | Valódi foglalást hoz létre, a foglaló és a stúdió is levelet kap. `consequentialHint` jelzéssel, így az agent vagy a Chrome megerősítést kérhet. Az `adatkezeles_elfogadva` paraméternek `true`-nak kell lennie, különben nem foglal. |

Az eszközök ugyanazt a beküldést és ugyanazt a backendet használják, mint az űrlap, így a backend ellenőrzései és korlátai rájuk is érvényesek. Agentes foglalásnál nincs átirányítás a köszönőoldalra, mert akkor az agent nem kapná meg az eredményt. A látogató ilyenkor az űrlap fölötti sávban látja a foglalást.

**Origin trial:** az API a Chrome-ban próbaidőszakban van. A látogatóknál a `Layout.astro` `<head>` részébe tett token kapcsolja be. A token a `webmcp.ts` fájlban van, a `https://dankuchenkaposvar.hu` címre szól, és **2027. március 30-án lejár**. Előtte meg kell újítani a [regisztrációs oldalon](https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241), majd ki kell cserélni a fájlban.

**Kipróbálás:** helyben a Chrome-ot a `chrome://flags/#enable-webmcp-testing` kapcsolóval vagy az `--enable-experimental-web-platform-features` indítási kapcsolóval kell futtatni. Ezután a konzolban a `document.modelContext.getTools()` hívás mutatja az eszközöket. Valódi agenttel a [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) bővítmény a legegyszerűbb, ehhez Gemini API-kulcs kell. Élesben a foglalás valódi leveleket küld.

## Google Tag Manager, Meta Pixel és sütihozzájárulás

Az oldalon Google Tag Manager fut (`GTM-PCN2CJD3`, benne a GA4-mérés: `G-GM7398BY4M`, a „https://dankuchenkaposvar.hu/” Analytics-fiókban), a [Google Consent Mode](https://developers.google.com/tag-platform/security/guides/consent?consentmode=advanced) haladó módjában:

- **Alapérték:** a `Layout.astro` `<head>` részének elején, egyetlen szkriptben minden hozzájárulási típus `denied`. Hozzájárulás nélkül a Google csak sütik nélküli jelzéseket kap. Utána jön a tárolt választás visszaállítása, és csak ezután a GTM indítása (`gtag('js')`, `frontend/src/utils/google.ts`).
- **Betöltés:** a kb. 200 KB-os `gtm.js` csak akkor töltődik be, ha az oldal betöltődött (`load`), és a fő tartalom (LCP, a nyitókép) is kirajzolódott, utána üresjáratban. Így nem lassítja az első megjelenítést (PageSpeed: FCP, LCP). Ahol a böngésző nem jelzi az LCP-t, vagy a lap háttérben nyílt meg, a `load` után 5 s-mal indul. A GTM a már lezajlott DOM Ready és Window Loaded eseményeket is lefuttatja, a Tag Assistant előnézete is működik. Ára: aki addig távozik, az nem jelenik meg a mérésben.
- **A GTM „Test your website” tesztje** a HTML-ben `<script src="…gtm.js">` címkét keres, ezért a késleltetett betöltés mellett „nem található” eredményt ad. A mérés ettől működik: ellenőrzése a GTM „Preview” (Tag Assistant) módjában vagy a GA4 valós idejű jelentésében.
- **Banner:** `frontend/src/components/SutiBanner.astro`. Két kategóriát kezel: statisztika (`analytics_storage`) és marketing (`ad_storage`, `ad_user_data`, `ad_personalization`). A választás a böngésző helyi tárhelyén van (`dankuchen-suti`), 12 hónapig. A lábléc „Süti-beállítások” gombja újranyitja. Visszavonáskor a `_ga*`, `_gcl_*`, `_fbp` és `_fbc` sütik törlődnek.
- **Meta Pixel** (`1699439024914908`, `frontend/src/utils/meta.ts`): a Facebook- és Instagram-hirdetések mérése. Csak „Marketing” hozzájárulással töltődik be: tárolt választásnál a GTM-mel együtt, a nyitókép kirajzolása után; a banner elfogadásakor azonnal. Visszavonáskor a `fbq('consent', 'revoke')` leállítja a küldést. A Meta-féle `<noscript>` kép szándékosan nincs az oldalon, mert hozzájárulás nélkül is elküldené a látogatást. Hozzájárulás nélkül (így a PageSpeed-mérésben is) egyáltalán nem töltődik be.
- **Újrakérdezés:** ha új kategóriát igénylő címke kerül az oldalra vagy a GTM-tárolóba, vagy az adatkezelési tájékoztató lényegesen változik, a `HOZZAJARULAS_VERZIO` növelésével mindenkitől újra hozzájárulást kér. Utoljára 2026-11-23-án nőtt (2), a Meta Pixel miatt.
- **Más címke a tárolóban:** ha nem Google-címke kerül a GTM-tárolóba, annak a GTM-ben külön hozzájárulási feltételt kell beállítani, és fel kell venni az adatkezelési tájékoztatóba. A Meta Pixel ne kerüljön a GTM-be is, mert akkor kétszer mérne.
- **Kipróbálás:** a böngésző konzoljában a `localStorage.removeItem('dankuchen-suti')` törli a választást, újratöltés után a banner újra megjelenik.

## Időpontfoglaló rendszer

A frontend statikus, a foglalást a külön futó backend intézi (`backend/`). A foglalások SQLite-ban vannak, a dupla foglalást az adatbázis egyedi indexe zárja ki. A látogató csak a szabad órákat kapja meg, és a szerver minden beküldésnél újra ellenőrzi az időpontot.

### Admin felület

Címe `https://dankuchenkaposvar.hu/admin/`, egy közös fiókkal lehet belépni. Minden változás azonnal érvényes, telepíteni nem kell.

| Oldal | Mit lehet |
|---|---|
| Foglalások | Közelgő, korábbi és lemondott foglalások, keresés névre, telefonra, e-mailre. A foglalás részletei, lemondás indoklással és értesítő levéllel |
| Új foglalás | Telefonon vagy személyesen egyeztetett időpont rögzítése, választható visszaigazoló levéllel. Az óra a weboldalon azonnal foglalt lesz |
| Zárva tartás | Zárva tartott időszakok (szabadság), áthelyezett pihenőnapok, lezárt órák. Jelzi, ha élő foglalás esik zárva tartott időpontra, de nem mondja le |
| Beállítások | Foglalható napok, kezdő órák, az alkalom hossza, meddig előre lehet foglalni, egy címre jutó élő foglalások száma, értesítési címek |

- **Belépés:** a felhasználónév és a jelszó scrypt-hash-e a szerveren van, a `/etc/dankuchen/dankuchen.env` fájlban. Beállítás és csere rootként: `node /opt/dankuchen/backend/admin-jelszo.ts`. Rejtett beírással kéri a jelszót (legalább 12 karakter), beírja a fájlba, és újraindítja a szolgáltatást. Csere után minden korábbi belépés érvénytelen. Amíg nincs beállítva, az admin nem érhető el.
- **Biztonság:** a belépés 14 napig él (`__Host-` süti: `HttpOnly`, `Secure`, `SameSite=Lax`). Minden űrlapnál CSRF-token és Origin-ellenőrzés van. Sikertelen belépésből IP-nként 15 percenként 5, összesen óránként 30 lehet. A válaszokban szigorú CSP van, és a beírt adat mindig escape-elve jelenik meg. A műveletek egy-egy sort írnak a naplóba (`journalctl -u dankuchen`), személyes adat nélkül.
- **Lemondás:** az óra azonnal újra szabad. Ha van e-mail cím, a látogató értesítő levelet kaphat az indoklással és egy lemondó naptármelléklettel. Ha a levél nem ment ki, az admin kiírja.
- **Végleges törlés** (törlési kérelemre): `deploy/foglalasok.mjs`, a szerveren (a használata a fájl elején). A 2 évnél régebbi foglalások automatikusan törlődnek.

### Beállítások

A foglalási beállítások az adatbázisban vannak (`beallitasok` tábla), az adminban módosíthatók, és a napi mentés ezeket is menti. Üres adatbázisnál a `backend/src/beallitasok.ts` `ALAPERTEKEK` értékeivel indul.

A `backend/foglalas.json` a levélküldés technikai beállításait tartalmazza. **A módosítása után telepíteni kell** (`deploy/telepit.sh backend`). Hibás értékre az `npm test` hibát ad, és a telepítés nem indul el.

| Feladat | Mező |
|---|---|
| Az oldal címe, a levelek linkjeihez (perjel nélkül) | `oldalCim` |
| SMTP szerver és felhasználó | `email.smtpHost`, `smtpPort`, `felhasznalo` |
| A küldő szerver teljes domainneve, ezzel mutatkozik be a levelezőszervernek | `email.szerverNev` |
| A feladó neve és címe | `email.feladoNev`, `felado` |
| A levelek tárgya (a `{idopont}` és a `{nev}` helyére a foglalás adatai kerülnek) | `email.targyLatogatonak`, `targyStudionak`, `targyLemondas` |

- **Ünnepnapok:** a törvényes ünnepeket a kód számolja ki, a mozgó ünnepeket is. Az áthelyezett pihenőnapok évente rendeletben jelennek meg, ezeket az admin Zárva tartás oldalán kell a pihenőnapok közé felvenni (a szombati munkanapokat nem, mert a stúdió szombaton zárva van). A 2026-os adat a 10/2025. (IV. 30.) NGM rendeletből van, **a 2027-es rendelet adatai még nincsenek felvéve**.
- **E-mail:** webes foglalásnál a látogató visszaigazolást kap, az értesítési címek értesítést, benne a foglalás admin-linkjével. Mindkettő `.ics` naptármelléklettel megy. A jelszó nem lehet a JSON-ban, mert az a gitbe kerül: az `SMTP_JELSZO` környezeti változóban van (`backend/.env.example`). Nélküle a foglalás működik, de nem megy ki levél.
- **Visszaélés ellen:** rejtett `_gotcha` mező, `maxAktivFoglalas`, és IP-nként 10 percenként 5 kérés (csak memóriában, IP-cím nem kerül az adatbázisba).
- **Fejlesztés:** az `npm run dev` mindent elindít, az adatbázis a gitből kizárt `backend/data/foglalasok.db`, levél nem megy ki. Az adminhoz a `backend/.env` fájlban kell próbajelszó (lásd: Indítás).

## Telepítés

A telepítés a repóból indul, a saját gépről vagy a szerveren lévő példányból (`/home/ubuntu/dankuchen`). A `deploy/telepit.sh` maga ismeri fel, hol fut: a szerveren helyben másol és indít újra (`sudo`-val, az `ubuntu` felhasználó jelszó nélkül használhatja), máshol SSH-n át (`root@fabutorwebaruhaz.hu`, 2222-es port). Induláskor kiírja, melyik módban fut. A frontend egyelőre csak a saját gépről telepíthető, mert a VPS-en nem készül el a buildje (lásd: [docs/vps-koltoztetes.md](docs/vps-koltoztetes.md)). A két alkalmazás külön is telepíthető:

```sh
deploy/telepit.sh            # mindkettő
deploy/telepit.sh frontend   # szövegek, képek, oldalak; a foglalási szolgáltatás nem indul újra
deploy/telepit.sh backend    # API- és adminkód, foglalas.json
```

A `shared/` mappa módosítása után mindkettőt telepíteni kell.

- **Frontend:** buildel, elmenti a szerveren a jelenlegi statikus oldalt (`/root/dankuchen-mentes-<dátum>`, az 5 legutóbbi marad), majd feltölti az újat.
- **Backend:** lefuttatja a teszteket, feltölti a fájlokat, menti az adatbázist, telepíti a függőségeket, újraindítja a szolgáltatást, és ellenőrzi, hogy az API válaszol. Hibás `foglalas.json` vagy bukó teszt esetén nem tölt fel semmit.

Azt tölti fel, ami a munkakönyvtárban van, a nem commitolt változásokkal együtt.

### Mi hová kerül

| A repóból | A szerveren | Tartalma |
|---|---|---|
| `frontend/dist/` | `/var/www/dankuchen/` | statikus oldal |
| `backend/` (`node_modules`, `test`, `data`, `.env*` nélkül) | `/opt/dankuchen/backend/` | API- és adminkód, `foglalas.json`, `admin-jelszo.ts`, helyben települ a `node_modules` (`npm ci`) |
| `shared/` | `/opt/dankuchen/shared/` | közös adatok és szabályok |
| `deploy/foglalasok.mjs`, `deploy/mentes.mjs` | `/opt/dankuchen/` | segédszkriptek |

Ezeket a telepítés nem érinti, csak a szerveren léteznek:

| A szerveren | Tartalma |
|---|---|
| `/var/lib/dankuchen/foglalasok.db` | a foglalások, a foglalási beállítások és az admin munkamenetei, csak a `dankuchen` felhasználó olvashatja |
| `/var/lib/dankuchen/mentesek/` | az adatbázis napi mentései, a 14 legutóbbi marad |
| `/etc/dankuchen/dankuchen.env` | `DB_PATH`, `SMTP_JELSZO`, `ADMIN_FELHASZNALO`, `ADMIN_JELSZO_HASH` |

A `deploy/` mappa többi fájlja egyszeri szerverbeállításhoz kell, a `telepit.sh` nem másolja fel:

| A repóban | A szerveren | Mit csinál |
|---|---|---|
| `deploy/dankuchen.service` | `/etc/systemd/system/` | futtatja a Node-ot |
| `deploy/dankuchen-mentes.service`, `.timer` | `/etc/systemd/system/` | napi adatbázis-mentés 3:30-kor (a szerver UTC szerint) |
| `deploy/apache-dankuchen.conf` | `/etc/apache2/sites-available/zz-dankuchenkaposvar.hu.conf` | a domain virtual hostja: kiszolgálja az oldalt, és továbbítja az API- és admin-kéréseket a Node-nak |

### Szolgáltatások a szerveren

| Szolgáltatás | Szerepe | Ha leáll |
|---|---|---|
| `apache2` | Kiszolgálja az oldalt, és továbbítja az API-kéréseket | Az oldal és a webáruház sem érhető el |
| `dankuchen` | Node-folyamat a `127.0.0.1:4330` címen, a foglalási API és az admin felület | Az oldal működik, de nem lehet foglalni: hibaüzenet és telefonszám jelenik meg. Az admin sem érhető el |
| `dankuchen-mentes.timer` | Elindítja a napi mentést | Minden működik, de nem készül új mentés |

MySQL és PHP nem kell. Az SQLite nem külön szolgáltatás, hanem egy fájl, amelyet a Node-folyamat kezel.

```sh
systemctl status dankuchen                                    # fut-e
journalctl -u dankuchen -f                                    # napló, levélküldési hibák
systemctl restart dankuchen                                   # újraindítás
sudo -u dankuchen node /opt/dankuchen/foglalasok.mjs lista    # közelgő foglalások
node /opt/dankuchen/backend/admin-jelszo.ts                     # az admin felhasználóneve és jelszava
```

### Az adatbázis megnyitása DBeaverrel

Az SQLite egy fájl a szerveren, nincs hálózati elérése, ezért a DBeaver távolról nem tud rá csatlakozni. A DBeaver SSH-alagútja csak szerveres adatbázisokhoz (MySQL, PostgreSQL) jó. Az éles fájlt SSHFS-en át megnyitni sem szabad: WAL módban fut, és hálózati fájlrendszeren a zárolás nem működik, az adatbázis megsérülhet.

Ehelyett egy friss pillanatkép jön le a saját gépre:

```sh
deploy/adatbazis-letoltes.sh    # ~/dankuchen-adatbazis/foglalasok.db, vagy a megadott helyre
```

A másolat a napi mentés módszerével készül (`VACUUM INTO`), a futó oldal mellett is biztonságos. Egyetlen fájl, WAL nélkül, és csak a tulajdonos olvashatja. Ügyfelek személyes adatai vannak benne, ezért a gépről sem szabad továbbadni.

A kapcsolat létrehozása DBeaverben:

1. *Database → New Database Connection → SQLite*. Első alkalommal a DBeaver felajánlja az SQLite-meghajtó letöltését.
2. *Path*: a letöltött fájl teljes útvonala, például `/home/<felhasználó>/dankuchen-adatbazis/foglalasok.db`.
3. A kapcsolat beállításainál (*General*) érdemes bekapcsolni a *Read-only connection* opciót. A másolatban végzett módosítás úgysem kerül vissza a szerverre: az éles adatokat az admin felületen kell módosítani.

Friss adatokhoz újra kell futtatni a szkriptet, utána a DBeaverben a kapcsolaton *Disconnect*, majd újracsatlakozás (vagy *Invalidate/Reconnect*). A táblák:

- `foglalas`: a foglalások;
- `beallitasok`: a foglalási beállítások, JSON-ban;
- `munkamenet`: az admin belépései, csak a tokenek hash-ével.

### Hol mit lehet módosítani

| Mit | Hol | Utána |
|---|---|---|
| Szövegek, képek, oldalak | `frontend/`, a saját gépen | `deploy/telepit.sh frontend` |
| Nyitvatartás, zárva tartás, értesítési címek, lemondás | az admin felület (`/admin/`) | azonnal érvényes |
| API- és adminkód, a levélküldés beállításai (`foglalas.json`) | `backend/`, a saját gépen | `deploy/telepit.sh backend` |
| Cégadatok, „Mit hozz magaddal?”, foglalási szabályok | `shared/`, a saját gépen | `deploy/telepit.sh` |
| SMTP-jelszó, adatbázis helye | `/etc/dankuchen/dankuchen.env`, a szerveren | `systemctl restart dankuchen` |
| Az admin felhasználóneve és jelszava | `node /opt/dankuchen/backend/admin-jelszo.ts`, a szerveren | a szkript újraindítja a szolgáltatást |
| Port, futtatás módja | `/etc/systemd/system/dankuchen.service`, a szerveren | `systemctl daemon-reload && systemctl restart dankuchen` |
| API továbbítása, a domain beállításai | `/etc/apache2/sites-available/zz-dankuchenkaposvar.hu.conf`, a szerveren | `apache2ctl configtest && systemctl reload apache2` |

A `foglalas.json` a szerveren is megvan (`/opt/dankuchen/backend/foglalas.json`), sürgős esetben ott is átírható, és a `systemctl restart dankuchen` után érvényes. Ilyenkor nem fut le a teszt, így hibás JSON-nal a szolgáltatás nem indul el (`journalctl -u dankuchen` mutatja az okot), a következő telepítés pedig felülírja, ezért a változást a repóba is be kell vezetni.

A port módosításához a `dankuchen.service` mellett az Apache-szabályokat (`/api/` és `/admin/`) és a `deploy/telepit.sh` `ELES_PORT` változóját is át kell írni. A 4321 és a 4322 a fejlesztői szervereké, élesen ne ezek legyenek.

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

# Apache: a tanúsítvány kéréséhez a 80-as virtual hostnak már élnie kell, a 443-as rész pedig csak a tanúsítvánnyal tölthető be.
# Előbb a deploy/apache-dankuchen.conf 80-as blokkját kell a /etc/apache2/sites-available/zz-dankuchenkaposvar.hu.conf fájlba írni
a2enmod proxy_http headers alias
a2ensite zz-dankuchenkaposvar.hu
apache2ctl configtest && systemctl reload apache2
certbot certonly --apache -d dankuchenkaposvar.hu -d www.dankuchenkaposvar.hu --deploy-hook "systemctl reload apache2"
# Utána a fájl teljes tartalma kerül a helyére
apache2ctl configtest && systemctl reload apache2

# Az admin felület belépése (az első telepítés után)
node /opt/dankuchen/backend/admin-jelszo.ts
```
