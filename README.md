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

- `src/content/konyhak/*.md` – konyhamodellek (név, alcím, csoport, sorrend, főoldali kiemelés, kép, galéria, leírás)
- `src/content/szolgaltatasok/*.md` – Látványtervezés, Kiszállítás, Helyszíni szerelés
- `src/content/reszletek/*.md` – okos részletek a Konyhák oldalon
- `src/content/szovegek/lamello.md` – Lamelló bemutatkozás
- `src/data/studio.json` – cím, nyitvatartás, telefon, e-mail, kapcsolattartó, cégadatok
- `src/assets/` – képek és logók (az Astro build közben webre optimalizálja őket)

Új konyhamodell: másolj le egy meglévő md fájlt, írd át, és tedd a képeit a `src/assets/konyhak/<modell>/` mappába.

## Arculat

A színek és fontok a DANKÜCHEN Markenidentität (2026) alapján a `src/styles/global.css` fájlban vannak. A DAN piros csak a fő foglalás gombon szerepel, a stúdióblokk és a jelvény Tamarillo színű (exkluzív stúdió).

### Márkafontok

A Gazpacho Medium Italic és a GT Walsheim Regular licencköteles, ezért nincsenek a repóban. Webes licenc esetén tedd őket ide:

```
public/fonts/Gazpacho-MediumItalic.woff2
public/fonts/GT-Walsheim-Regular.woff2
```

Amíg nincsenek ott, az oldal a tartalék fontokat használja: Fraunces Italic (címsor) és Montserrat (szöveg, a guideline webes tartaléka).

## Időpontfoglaló űrlap

Alapból a látogató levelezőprogramján keresztül küldi el az adatokat a `studio.json` e-mail címére. Megbízhatóbb egy űrlapszolgáltatás (pl. Formspree): a címét a `PUBLIC_FORM_ENDPOINT` környezeti változóban add meg (lásd `.env.example`), siker után a `/koszonjuk/` oldalra irányít.
