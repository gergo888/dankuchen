import { napFelirat, oraFelirat, unnepnapok } from '../../../shared/idopontok.ts';
import type { FoglalasiBeallitasok } from '../beallitasok.ts';
import type { FoglalasSor, Nezet } from '../db.ts';
import { html, Html } from './html.ts';

// Az admin oldalai. Minden beírt adat a `html` sablonon át, escape-elve kerül a HTML-be.

export interface Uzenet {
  tipus: 'siker' | 'figyelmeztetes' | 'hiba';
  szoveg: string;
}

const MENU = [
  ['foglalasok', '/admin/', 'Foglalások'],
  ['uj', '/admin/uj', 'Új foglalás'],
  ['zarva', '/admin/zarva', 'Zárva tartás'],
  ['beallitasok', '/admin/beallitasok', 'Beállítások'],
] as const;

export type Menupont = (typeof MENU)[number][0];

const NAPNEVEK = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

export function keret({ cim, tartalom, csrf, aktiv, uzenet }: { cim: string; tartalom: Html; csrf?: string; aktiv?: Menupont; uzenet?: Uzenet | null }) {
  return html`<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${cim} – DANKÜCHEN admin</title>
<link rel="stylesheet" href="/admin/admin.css">
<script src="/admin/admin.js" defer></script>
</head>
<body>
<header class="fej">
  <div class="tarolo fej__sor">
    <a class="marka" href="/admin/">DANKÜCHEN <span>admin</span></a>
    ${
      csrf
        ? html`<nav class="menu" aria-label="Admin menü">
      <ul>
        ${MENU.map(([kulcs, href, felirat]) => html`<li><a href="${href}"${kulcs === aktiv ? html` aria-current="page"` : ''}>${felirat}</a></li>`)}
        <li><form method="post" action="/admin/kilepes"><input type="hidden" name="csrf" value="${csrf}"><button type="submit" class="link">Kilépés</button></form></li>
      </ul>
    </nav>`
        : ''
    }
  </div>
</header>
<main class="tarolo tartalom">
${uzenet ? html`<p class="uzenet uzenet--${uzenet.tipus}" role="${uzenet.tipus === 'hiba' ? 'alert' : 'status'}">${uzenet.szoveg}</p>` : ''}
${tartalom}
</main>
</body>
</html>
`.szoveg;
}

// ---- Segédek ----

const IDOZONA = 'Europe/Budapest';
const napRovid = (nap: string) =>
  new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'long', timeZone: 'UTC' }).format(new Date(`${nap}T00:00:00Z`));
const datumIdo = (iso: string) => new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium', timeStyle: 'short', timeZone: IDOZONA }).format(new Date(iso));
const telLink = (telefon: string) => `tel:${telefon.replace(/[^\d+]/g, '')}`;
const rovid = (s: string, hossz: number) => (s.length > hossz ? `${s.slice(0, hossz).trimEnd()}…` : s);
const csrfMezo = (csrf: string) => html`<input type="hidden" name="csrf" value="${csrf}">`;

function mezo(o: {
  nev: string;
  felirat: string;
  ertek?: string | number;
  tipus?: string;
  kotelezo?: boolean;
  hiba?: string;
  sugo?: string;
  extra?: Html;
  tobbsoros?: boolean;
}) {
  const leiras = [o.sugo ? `${o.nev}-sugo` : '', o.hiba ? `${o.nev}-hiba` : ''].filter(Boolean).join(' ');
  const kozos = html`id="${o.nev}" name="${o.nev}"${o.kotelezo ? html` required` : ''}${o.hiba ? html` aria-invalid="true"` : ''}${leiras ? html` aria-describedby="${leiras}"` : ''}${o.extra ?? ''}`;
  return html`<div class="mezo">
  <label for="${o.nev}">${o.felirat}${o.kotelezo ? '' : html` <span class="megj">(nem kötelező)</span>`}</label>
  ${o.tobbsoros ? html`<textarea ${kozos} rows="3">${o.ertek ?? ''}</textarea>` : html`<input type="${o.tipus ?? 'text'}" ${kozos} value="${o.ertek ?? ''}">`}
  ${o.sugo ? html`<p class="sugo" id="${o.nev}-sugo">${o.sugo}</p>` : ''}
  ${o.hiba ? html`<p class="mezo__hiba" id="${o.nev}-hiba">${o.hiba}</p>` : ''}
</div>`;
}

function cimkek(f: FoglalasSor, zarva: boolean) {
  return html`${f.forras === 'telefon' ? html`<span class="cimke">telefonos</span>` : ''}${f.lemondva ? html`<span class="cimke cimke--lemondva">lemondva</span>` : ''}${
    zarva && !f.lemondva ? html`<span class="cimke cimke--figy">zárva tartott időpont</span>` : ''
  }`;
}

// ---- Belépés ----

export function belepesOldal({ hiba, vissza, felhasznalo }: { hiba?: string; vissza: string; felhasznalo?: string }) {
  return keret({
    cim: 'Belépés',
    uzenet: hiba ? { tipus: 'hiba', szoveg: hiba } : null,
    tartalom: html`<section class="kartya belepes">
  <h1>Belépés</h1>
  <form method="post" action="/admin/belepes">
    <input type="hidden" name="vissza" value="${vissza}">
    ${mezo({ nev: 'felhasznalo', felirat: 'Felhasználónév', ertek: felhasznalo, kotelezo: true, extra: html` autocomplete="username" autocapitalize="none" spellcheck="false"` })}
    ${mezo({ nev: 'jelszo', felirat: 'Jelszó', tipus: 'password', kotelezo: true, extra: html` autocomplete="current-password"` })}
    <button class="gomb" type="submit">Belépés</button>
  </form>
</section>`,
  });
}

export const nincsBeallitvaOldal = () =>
  keret({ cim: 'Nincs beállítva', tartalom: html`<section class="kartya"><h1>Az admin felület még nincs beállítva</h1><p>A belépéshez előbb felhasználónevet és jelszót kell beállítani a szerveren.</p></section>` });

export const hibaOldal = (cim: string, szoveg: string, csrf?: string) =>
  keret({ cim, csrf, tartalom: html`<section class="kartya"><h1>${cim}</h1><p>${szoveg}</p><p><a href="/admin/">Vissza a foglalásokhoz</a></p></section>` });

// ---- Foglalások ----

const NEZETEK: [Nezet, string][] = [
  ['kozelgo', 'Közelgő'],
  ['korabbi', 'Korábbiak'],
  ['lemondott', 'Lemondottak'],
];

export function listaOldal(o: {
  nezet: Nezet;
  kereses: string;
  sorok: FoglalasSor[];
  mainap: string;
  sz: FoglalasiBeallitasok;
  zarva: (f: FoglalasSor) => boolean;
  csrf: string;
  uzenet?: Uzenet | null;
}) {
  const link = (nezet: Nezet) => `/admin/?nezet=${nezet}${o.kereses ? `&q=${encodeURIComponent(o.kereses)}` : ''}`;
  const sor = (f: FoglalasSor, datummal: boolean) => html`<li class="foglalas">
  <a class="foglalas__fo" href="/admin/foglalas/${f.id}">
    <span class="foglalas__ido">${datummal ? `${napRovid(f.nap)}, ` : ''}${oraFelirat(f.ora, o.sz.hosszPerc)}</span>
    <span class="foglalas__nev">${f.nev}</span>
  </a>
  <p class="foglalas__adatok"><a href="${telLink(f.telefon)}">${f.telefon}</a>${f.email ? html` · <a href="mailto:${f.email}">${f.email}</a>` : ''}${f.telepules ? ` · ${f.telepules}` : ''}</p>
  <p class="foglalas__cimkek">${cimkek(f, o.zarva(f))}</p>
  ${f.uzenet ? html`<p class="foglalas__uzenet">${rovid(f.uzenet, 160)}</p>` : ''}
</li>`;

  let lista: Html;
  if (o.sorok.length === 0) {
    lista = html`<p class="ures">${o.kereses ? 'Nincs a keresésnek megfelelő foglalás.' : 'Nincs ilyen foglalás.'}</p>`;
  } else if (o.nezet === 'kozelgo') {
    const napok = Map.groupBy(o.sorok, (f) => f.nap);
    lista = html`${[...napok].map(
      ([nap, sorok]) => html`<section class="nap${nap === o.mainap ? ' nap--ma' : ''}">
  <h2>${napFelirat(nap)}${nap === o.mainap ? ' – ma' : ''}</h2>
  <ul class="foglalasok">${sorok.map((f) => sor(f, false))}</ul>
</section>`,
    )}`;
  } else {
    lista = html`<ul class="foglalasok">${o.sorok.map((f) => sor(f, true))}</ul>`;
  }

  return keret({
    cim: 'Foglalások',
    aktiv: 'foglalasok',
    csrf: o.csrf,
    uzenet: o.uzenet,
    tartalom: html`<div class="fejlec">
  <h1>Foglalások</h1>
  <a class="gomb" href="/admin/uj">Új foglalás</a>
</div>
<nav class="fulek" aria-label="Foglalások szűrése">
  ${NEZETEK.map(([nezet, felirat]) => html`<a href="${link(nezet)}"${nezet === o.nezet ? html` aria-current="page"` : ''}>${felirat}</a>`)}
</nav>
<form class="kereses" method="get" action="/admin/" role="search">
  <input type="hidden" name="nezet" value="${o.nezet}">
  <label class="sr-only" for="q">Keresés névre, telefonra vagy e-mailre</label>
  <input type="search" id="q" name="q" value="${o.kereses}" placeholder="Név, telefon vagy e-mail">
  <button class="gomb gomb--masodlagos" type="submit">Keresés</button>
  ${o.kereses ? html`<a href="/admin/?nezet=${o.nezet}">Szűrés törlése</a>` : ''}
</form>
<p class="osszesen">${o.sorok.length} foglalás</p>
${lista}`,
  });
}

// ---- Egy foglalás ----

export function reszletekOldal(o: { f: FoglalasSor; mainap: string; sz: FoglalasiBeallitasok; zarva: boolean; csrf: string; uzenet?: Uzenet | null }) {
  const { f } = o;
  const idopont = `${napFelirat(f.nap)}, ${oraFelirat(f.ora, o.sz.hosszPerc)}`;
  const lemondhato = !f.lemondva && f.nap >= o.mainap;
  return keret({
    cim: f.nev,
    aktiv: 'foglalasok',
    csrf: o.csrf,
    uzenet: o.uzenet,
    tartalom: html`<p class="vissza"><a href="/admin/">← Foglalások</a></p>
<h1>${f.nev}</h1>
<p class="idopont">${idopont}</p>
<p>${cimkek(f, o.zarva)}</p>
<dl class="adatok">
  <dt>Telefon</dt><dd><a href="${telLink(f.telefon)}">${f.telefon}</a></dd>
  <dt>E-mail</dt><dd>${f.email ? html`<a href="mailto:${f.email}">${f.email}</a>` : '–'}</dd>
  <dt>Település</dt><dd>${f.telepules || '–'}</dd>
  <dt>Üzenet</dt><dd class="tobbsoros">${f.uzenet || '–'}</dd>
  <dt>Forrás</dt><dd>${f.forras === 'telefon' ? 'Telefonos, a stúdió rögzítette' : 'Weboldal'}</dd>
  <dt>Rögzítve</dt><dd>${datumIdo(f.letrehozva)}</dd>
  <dt>Azonosító</dt><dd>${f.id}</dd>
  ${f.lemondva ? html`<dt>Lemondva</dt><dd>${datumIdo(f.lemondva)}${f.lemondas_oka ? html`<br><span class="tobbsoros">Indok: ${f.lemondas_oka}</span>` : ''}</dd>` : ''}
</dl>
${
  lemondhato
    ? html`<section class="kartya kartya--veszely">
  <h2>Lemondás</h2>
  <p>Lemondás után az óra a weboldalon azonnal újra foglalható.</p>
  <form method="post" action="/admin/foglalas/${f.id}/lemondas" data-megerosites="${`Biztosan lemondod ${f.nev} időpontját (${idopont})?`}">
    ${csrfMezo(o.csrf)}
    ${mezo({ nev: 'indok', felirat: 'Indoklás a látogatónak', tobbsoros: true, extra: html` maxlength="500"`, sugo: 'Ha küldesz értesítőt, ez a szöveg is benne lesz.' })}
    <label class="jelolo"><input type="checkbox" name="ertesites" value="igen"${f.email ? html` checked` : html` disabled`}> <span>Értesítő levél a látogatónak${
      f.email ? '' : html` <span class="megj">(nincs e-mail cím, telefonon kell értesíteni)</span>`
    }</span></label>
    <button class="gomb gomb--veszely" type="submit">Foglalás lemondása</button>
  </form>
</section>`
    : ''
}`,
  });
}

// ---- Új foglalás ----

export interface OraAllapot {
  ora: string;
  foglalt?: string;
  lezart?: string | true;
}

export function ujOldal(o: {
  nap: string;
  mainap: string;
  sz: FoglalasiBeallitasok;
  orak: OraAllapot[];
  figyelmeztetesek: string[];
  ertekek: Record<string, string>;
  hibak: Record<string, string>;
  csrf: string;
  uzenet?: Uzenet | null;
}) {
  const e = o.ertekek;
  const valaszthato = o.orak.filter((ora) => !ora.foglalt);
  // Csak érvényes napnál készül el, mert a napFelirat hibás dátumra kivételt dob.
  const urlap = () => html`<h2>${napFelirat(o.nap)}</h2>
${o.figyelmeztetesek.length ? html`<ul class="uzenet uzenet--figyelmeztetes">${o.figyelmeztetesek.map((f) => html`<li>${f}</li>`)}</ul>` : ''}
${
  valaszthato.length === 0
    ? html`<p class="ures">Erre a napra minden kezdő óra foglalt.</p>`
    : html`<form method="post" action="/admin/uj" class="urlap">
  ${csrfMezo(o.csrf)}
  <input type="hidden" name="nap" value="${o.nap}">
  <fieldset class="orak"${o.hibak.ora ? html` aria-describedby="ora-hiba"` : ''}>
    <legend>Kezdő óra</legend>
    ${o.orak.map(
      (ora) => html`<label class="ora${ora.foglalt ? ' ora--foglalt' : ''}">
      <input type="radio" name="ora" value="${ora.ora}" required${ora.foglalt ? html` disabled` : ''}${e.ora === ora.ora ? html` checked` : ''}>
      <span>${oraFelirat(ora.ora, o.sz.hosszPerc)}</span>
      ${ora.foglalt ? html`<small>foglalt: ${ora.foglalt}</small>` : ora.lezart ? html`<small>lezárva${ora.lezart === true ? '' : `: ${ora.lezart}`}</small>` : ''}
    </label>`,
    )}
  </fieldset>
  ${o.hibak.ora ? html`<p class="mezo__hiba" id="ora-hiba">${o.hibak.ora}</p>` : ''}
  ${mezo({ nev: 'nev', felirat: 'Név', ertek: e.nev, kotelezo: true, hiba: o.hibak.nev, extra: html` maxlength="100" autocomplete="off"` })}
  ${mezo({ nev: 'telefon', felirat: 'Telefonszám', tipus: 'tel', ertek: e.telefon, kotelezo: true, hiba: o.hibak.telefon, extra: html` autocomplete="off"` })}
  ${mezo({ nev: 'email', felirat: 'E-mail cím', tipus: 'email', ertek: e.email, hiba: o.hibak.email, extra: html` maxlength="254" autocomplete="off"` })}
  ${mezo({ nev: 'telepules', felirat: 'Település', ertek: e.telepules, hiba: o.hibak.telepules, extra: html` maxlength="100" autocomplete="off"` })}
  ${mezo({ nev: 'uzenet', felirat: 'Megjegyzés', ertek: e.uzenet, hiba: o.hibak.uzenet, tobbsoros: true, extra: html` maxlength="2000"` })}
  <label class="jelolo"><input type="checkbox" name="visszaigazolas" value="igen" data-email-fuggo${e.visszaigazolas === 'nem' ? '' : html` checked`}> <span>Visszaigazoló levél a látogatónak <span class="megj">(ha van e-mail cím)</span></span></label>
  <button class="gomb" type="submit">Foglalás rögzítése</button>
</form>`
}`;

  return keret({
    cim: 'Új foglalás',
    aktiv: 'uj',
    csrf: o.csrf,
    uzenet: o.uzenet,
    tartalom: html`<h1>Új foglalás</h1>
<p>Telefonon vagy személyesen egyeztetett időpont rögzítése. Az óra a weboldalon azonnal foglalt lesz.</p>
<form method="get" action="/admin/uj" class="napvalaszto">
  <div class="mezo">
    <label for="nap">Nap</label>
    <input type="date" id="nap" name="nap" value="${o.nap}" min="${o.mainap}" required data-automatikus${o.hibak.nap ? html` aria-invalid="true" aria-describedby="nap-hiba"` : ''}>
    ${o.hibak.nap ? html`<p class="mezo__hiba" id="nap-hiba">${o.hibak.nap}</p>` : ''}
  </div>
  <button class="gomb gomb--masodlagos" type="submit">Órák mutatása</button>
</form>
${o.nap && !o.hibak.nap ? urlap() : ''}`,
  });
}

// ---- Zárva tartás ----

export function zarvaOldal(o: { sz: FoglalasiBeallitasok; erintett: FoglalasSor[]; mainap: string; csrf: string; uzenet?: Uzenet | null }) {
  const { sz } = o;
  const torles = (muvelet: string, mezok: Record<string, string>, felirat: string) => html`<form method="post" action="/admin/zarva" class="sor-torles" data-megerosites="${`Biztosan törlöd: ${felirat}?`}">
  ${csrfMezo(o.csrf)}<input type="hidden" name="muvelet" value="${muvelet}">${Object.entries(mezok).map(([k, v]) => html`<input type="hidden" name="${k}" value="${v}">`)}
  <button type="submit" class="link link--veszely">Törlés</button>
</form>`;
  const elmult = (nap: string) => (nap < o.mainap ? html` <span class="megj">(elmúlt)</span>` : '');
  const ev = Number(o.mainap.slice(0, 4));
  const unnepek = (ev_: number) => [...unnepnapok(ev_)].sort();

  return keret({
    cim: 'Zárva tartás',
    aktiv: 'zarva',
    csrf: o.csrf,
    uzenet: o.uzenet,
    tartalom: html`<h1>Zárva tartás</h1>
<p>A változás azonnal érvényes: a weboldalon ezekre a napokra és órákra nem lehet foglalni.</p>
${
  o.erintett.length
    ? html`<section class="kartya kartya--figy">
  <h2>Zárva tartott időpontra eső élő foglalások</h2>
  <p>Ezeket a rendszer nem mondja le magától. Ha kell, mondd le a foglalásnál, és értesítsd a látogatót.</p>
  <ul>${o.erintett.map((f) => html`<li><a href="/admin/foglalas/${f.id}">${napRovid(f.nap)}, ${oraFelirat(f.ora, sz.hosszPerc)} – ${f.nev}</a></li>`)}</ul>
</section>`
    : ''
}
<section class="kartya">
  <h2>Zárva tartott időszakok</h2>
  <p class="sugo">Szabadság, céges zárva tartás. Az első és az utolsó nap is zárva van.</p>
  ${
    sz.zarvaIdoszakok.length
      ? html`<ul class="tetelek">${sz.zarvaIdoszakok.map(
          (z) =>
            html`<li><span>${napRovid(z.tol)} – ${napRovid(z.ig)}${z.ok ? ` · ${z.ok}` : ''}${elmult(z.ig)}</span>${torles('idoszak-torol', { tol: z.tol, ig: z.ig }, `${z.tol} – ${z.ig}`)}</li>`,
        )}</ul>`
      : html`<p class="ures">Nincs.</p>`
  }
  <form method="post" action="/admin/zarva" class="sorba">
    ${csrfMezo(o.csrf)}<input type="hidden" name="muvelet" value="idoszak-hozzaad">
    ${mezo({ nev: 'tol', felirat: 'Első nap', tipus: 'date', kotelezo: true })}
    ${mezo({ nev: 'ig', felirat: 'Utolsó nap', tipus: 'date', kotelezo: true })}
    ${mezo({ nev: 'ok', felirat: 'Megjegyzés', extra: html` maxlength="200" placeholder="pl. Szabadság"` })}
    <button class="gomb" type="submit">Hozzáadás</button>
  </form>
</section>
<section class="kartya">
  <h2>Pihenőnapok</h2>
  <p class="sugo">A törvényes ünnepeket a rendszer magától kezeli. Ide a rendeletben áthelyezett pihenőnapok kerülnek.</p>
  ${
    sz.pihenonapok.length
      ? html`<ul class="tetelek">${[...sz.pihenonapok].sort().map((nap) => html`<li><span>${napFelirat(nap)}${elmult(nap)}</span>${torles('pihenonap-torol', { nap }, nap)}</li>`)}</ul>`
      : html`<p class="ures">Nincs.</p>`
  }
  <form method="post" action="/admin/zarva" class="sorba">
    ${csrfMezo(o.csrf)}<input type="hidden" name="muvelet" value="pihenonap-hozzaad">
    ${mezo({ nev: 'pihenonap', felirat: 'Nap', tipus: 'date', kotelezo: true })}
    <button class="gomb" type="submit">Hozzáadás</button>
  </form>
</section>
<section class="kartya">
  <h2>Lezárt órák</h2>
  <p class="sugo">Egy-egy óra, amikor a stúdió nem fogad webes foglalást. Telefonos foglaláshoz inkább az „Új foglalás” oldalt használd.</p>
  ${
    sz.zartOrak.length
      ? html`<ul class="tetelek">${[...sz.zartOrak]
          .sort((a, b) => `${a.nap}${a.ora}`.localeCompare(`${b.nap}${b.ora}`))
          .map(
            (z) =>
              html`<li><span>${napRovid(z.nap)}, ${oraFelirat(z.ora, sz.hosszPerc)}${z.ok ? ` · ${z.ok}` : ''}${elmult(z.nap)}</span>${torles('ora-torol', { nap: z.nap, ora: z.ora }, `${z.nap} ${z.ora}`)}</li>`,
          )}</ul>`
      : html`<p class="ures">Nincs.</p>`
  }
  <form method="post" action="/admin/zarva" class="sorba">
    ${csrfMezo(o.csrf)}<input type="hidden" name="muvelet" value="ora-hozzaad">
    ${mezo({ nev: 'zartnap', felirat: 'Nap', tipus: 'date', kotelezo: true })}
    <div class="mezo"><label for="zartora">Óra</label><select id="zartora" name="ora" required>${sz.kezdoOrak.map((ora) => html`<option value="${ora}">${oraFelirat(ora, sz.hosszPerc)}</option>`)}</select></div>
    ${mezo({ nev: 'okora', felirat: 'Megjegyzés', extra: html` maxlength="200"` })}
    <button class="gomb" type="submit">Hozzáadás</button>
  </form>
</section>
<details class="kartya">
  <summary>Törvényes ünnepek ${ev}-ben és ${ev + 1}-ben</summary>
  <ul class="tetelek tetelek--egyszeru">${[...unnepek(ev), ...unnepek(ev + 1)].map((nap) => html`<li>${napFelirat(nap)}</li>`)}</ul>
</details>`,
  });
}

// ---- Beállítások ----

export function beallitasokOldal(o: { ertekek: Record<string, string | string[]>; hibak: Record<string, string>; csrf: string; uzenet?: Uzenet | null }) {
  const e = o.ertekek;
  const napok = (e.hetNapjai as string[]) ?? [];
  return keret({
    cim: 'Beállítások',
    aktiv: 'beallitasok',
    csrf: o.csrf,
    uzenet: o.uzenet,
    tartalom: html`<h1>Nyitvatartás és értesítések</h1>
<p>A változás mentés után azonnal érvényes a weboldalon. A már rögzített foglalásokat nem érinti.</p>
<form method="post" action="/admin/beallitasok" class="urlap kartya">
  ${csrfMezo(o.csrf)}
  <fieldset class="mezo"${o.hibak.hetNapjai ? html` aria-describedby="hetNapjai-hiba"` : ''}>
    <legend>Foglalható napok</legend>
    <div class="napok">${[1, 2, 3, 4, 5, 6, 0].map(
      (n) => html`<label class="jelolo"><input type="checkbox" name="hetNapjai" value="${n}"${napok.includes(String(n)) ? html` checked` : ''}> <span>${NAPNEVEK[n]}</span></label>`,
    )}</div>
    ${o.hibak.hetNapjai ? html`<p class="mezo__hiba" id="hetNapjai-hiba">${o.hibak.hetNapjai}</p>` : ''}
  </fieldset>
  ${mezo({ nev: 'kezdoOrak', felirat: 'Kezdő órák', ertek: e.kezdoOrak as string, kotelezo: true, hiba: o.hibak.kezdoOrak ?? o.hibak.zartOrak, sugo: 'Vesszővel elválasztva, pl. 08:00, 09:00, 10:00' })}
  ${mezo({ nev: 'hosszPerc', felirat: 'Egy alkalom hossza (perc)', tipus: 'number', ertek: e.hosszPerc as string, kotelezo: true, hiba: o.hibak.hosszPerc, extra: html` min="15" max="480" step="5" inputmode="numeric"` })}
  ${mezo({ nev: 'legkorabbanNapMulva', felirat: 'Legkorábban hány nap múlvára lehet foglalni', tipus: 'number', ertek: e.legkorabbanNapMulva as string, kotelezo: true, hiba: o.hibak.legkorabbanNapMulva, sugo: '0 = aznapra is, 1 = holnaptól', extra: html` min="0" inputmode="numeric"` })}
  ${mezo({ nev: 'legkesobbNapMulva', felirat: 'Legkésőbb hány nap múlvára lehet foglalni', tipus: 'number', ertek: e.legkesobbNapMulva as string, kotelezo: true, hiba: o.hibak.legkesobbNapMulva, extra: html` min="1" max="366" inputmode="numeric"` })}
  ${mezo({ nev: 'maxAktivFoglalas', felirat: 'Élő foglalások száma egy e-mail címre vagy telefonszámra', tipus: 'number', ertek: e.maxAktivFoglalas as string, kotelezo: true, hiba: o.hibak.maxAktivFoglalas, extra: html` min="1" inputmode="numeric"` })}
  ${mezo({ nev: 'ertesitesiCimek', felirat: 'Értesítési címek', ertek: e.ertesitesiCimek as string, kotelezo: true, tobbsoros: true, hiba: o.hibak.ertesitesiCimek, sugo: 'Ezekre a címekre megy a levél az új webes foglalásokról, soronként egy.' })}
  <button class="gomb" type="submit">Mentés</button>
</form>
<p class="sugo">A levélküldés technikai beállításai (SMTP, feladó, a levelek tárgya) a <code>backend/foglalas.json</code> fájlban vannak, és telepítéssel módosíthatók.</p>`,
  });
}
