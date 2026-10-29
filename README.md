# DANKÜCHEN Exkluzív Stúdió Kaposvár

A Lamelló Kft. kaposvári DANKÜCHEN bemutatótermének weboldala, [Astro](https://astro.build) alapon.

## Indítás

Node.js 22.23.4 vagy újabb kell (`.nvmrc`: 24).

```sh
npm install
npm run dev      # fejlesztői szerver: http://localhost:4321
npm run build    # statikus oldal a dist/ mappába
npm run preview  # a build megtekintése
```

## Oldalak

| Útvonal | Fájl |
|---|---|
| `/` | `src/pages/index.astro` – Főoldal |
| `/konyhak/` | `src/pages/konyhak.astro` – Konyhák (szűrő, galéria, okos részletek) |
| `/kapcsolat/` | `src/pages/kapcsolat.astro` – Elérhetőség, térkép, Lamelló bemutatkozás |
| `/idopontfoglalas/` | `src/pages/idopontfoglalas.astro` – Látványtervezés foglalás |
| `/koszonjuk/` | sikeres foglalás után |
| `/adatkezeles/` | adatkezelési tájékoztató (a szöveg még hiányzik) |

## Tartalom szerkesztése

A szövegek és képek md fájlokban vannak, kód nélkül szerkeszthetők:

- `src/content/konyhak/*.md` – konyhamodellek (név, alcím, csoportok, sorrend, főoldali kiemelés, kép, galéria, leírás)
- `src/content/szolgaltatasok/*.md` – Látványtervezés, Kiszállítás, Helyszíni szerelés
- `src/content/reszletek/*.md` – okos részletek a Konyhák oldalon
- `src/content/szovegek/lamello.md` – Lamelló bemutatkozás
- `src/data/studio.json` – cím, nyitvatartás, telefon, e-mail, kapcsolattartó, cégadatok
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

## Időpontfoglaló űrlap

Az űrlap a [Formspree](https://formspree.io) szolgáltatáson keresztül küld e-mailt. A végpont címe a `src/data/studio.json` `foglalasUrlap` mezőjében van, a címzett e-mail címet a Formspree fiókban kell beállítani. Az oldal háttérben küld, siker után a `/koszonjuk/` oldalra irányít, hiba esetén üzenetet és a telefonszámot mutatja. A `_gotcha` rejtett mező a spamrobotokat szűri.
