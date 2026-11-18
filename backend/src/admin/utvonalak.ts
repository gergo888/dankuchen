import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ervenyesNapFormatum, maiNap, unnepnapok } from '../../../shared/idopontok.ts';
import { foglalasiHibak } from '../beallitasok.ts';
import type { FoglalasiBeallitasok } from '../beallitasok.ts';
import { foglal, foglalasLekerese, foglalasLista, lemond, napFoglalasai } from '../db.ts';
import type { FoglalasSor, Nezet } from '../db.ts';
import { lemondoLevelKuldese, visszaigazolasKuldese } from '../email.ts';
import type { KuldesEredmeny } from '../email.ts';
import { adatbazis, beallitasok, beallitasokFrissitese } from '../kapcsolat.ts';
import { urlapEllenorzes } from '../urlap.ts';
import { jelszoEllenorzes } from './jelszo.ts';
import {
  azonosEredet,
  belepesEngedett,
  egyezik,
  hibasBelepes,
  hitelesitesBeallitasa,
  keresIp,
  munkamenetEllenorzes,
  munkamenetLetrehozasa,
  munkamenetTorlese,
  sikeresBelepes,
  sutiFejlec,
  sutiOlvasasa,
  sutiTorloFejlec,
} from './munkamenet.ts';
import type { Hitelesites } from './munkamenet.ts';
import * as oldalak from './oldalak.ts';
import type { OraAllapot, Uzenet } from './oldalak.ts';

const MAX_TORZS_BAJT = 16 * 1024;

const FEJLECEK = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  // A „same-origin” mellett a saját POST-ok Origin fejléce megmarad, külső linkre viszont nem megy hivatkozó.
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
};

const STATIKUS: Record<string, { tipus: string; tartalom: Buffer }> = {
  '/admin.css': { tipus: 'text/css; charset=utf-8', tartalom: readFileSync(new URL('./admin.css', import.meta.url)) },
  '/admin.js': { tipus: 'text/javascript; charset=utf-8', tartalom: readFileSync(new URL('./admin.js', import.meta.url)) },
};

// ---- Válaszok ----

function kuld(res: ServerResponse, status: number, tartalom: string, sutik: string[] = []) {
  res.writeHead(status, { ...FEJLECEK, 'Content-Type': 'text/html; charset=utf-8', ...(sutik.length ? { 'Set-Cookie': sutik } : {}) });
  res.end(tartalom);
}

function atiranyit(res: ServerResponse, hova: string, sutik: string[] = [], status = 303) {
  res.writeHead(status, { ...FEJLECEK, Location: hova, ...(sutik.length ? { 'Set-Cookie': sutik } : {}) });
  res.end();
}

// A törzs szövege, vagy `null`, ha túl nagy.
function torzsBeolvasasa(req: IncomingMessage) {
  return new Promise<string | null>((ok, hiba) => {
    const darabok: Buffer[] = [];
    let meret = 0;
    req.on('data', (darab: Buffer) => {
      meret += darab.length;
      if (meret <= MAX_TORZS_BAJT) darabok.push(darab);
    });
    req.on('end', () => ok(meret > MAX_TORZS_BAJT ? null : Buffer.concat(darabok).toString('utf-8')));
    req.on('error', hiba);
  });
}

// Csak admin-útvonalra lehet visszairányítani, más oldalra nem.
const biztonsagosVissza = (cel: string | null) => (cel && /^\/admin\/[^/\\]?/.test(cel) && !cel.startsWith('//') && !/[\\\r\n]/.test(cel) ? cel : '/admin/');

// ---- Visszajelzések ----

// Az üzenet kódja a címben utazik, így újratöltéskor nem megy el újra az űrlap, és beírt szöveg sem kerül a címbe.
const LEVEL: Record<KuldesEredmeny, string> = {
  elkuldve: 'Az értesítő levél elment.',
  'nincs-smtp': 'Levél nem ment ki, mert a levélküldés nincs beállítva a szerveren.',
  hiba: 'A levelet nem sikerült elküldeni, értesítsd a látogatót telefonon.',
};

function uzenetKodbol(kod: string | null): Uzenet | null {
  if (!kod) return null;
  const [alap, level] = kod.split('.') as [string, KuldesEredmeny | undefined];
  const levelSzoveg = level && LEVEL[level] ? ` ${LEVEL[level]}` : '';
  const tipus = level === 'hiba' ? 'figyelmeztetes' : 'siker';
  const szoveg: Record<string, string> = {
    lemondva: 'A foglalás lemondva, az óra a weboldalon újra foglalható.',
    felveve: 'A foglalás rögzítve, az óra a weboldalon már foglalt.',
    mentve: 'A beállítások elmentve.',
    'zarva-mentve': 'Elmentve.',
  };
  return szoveg[alap] ? { tipus, szoveg: szoveg[alap] + levelSzoveg } : null;
}

// ---- Zárva tartás ellenőrzése ----

const hetNapja = (nap: string) => new Date(`${nap}T00:00:00Z`).getUTCDay();

// Miért nem lehet a weboldalon erre a napra foglalni. Üres lista, ha a nap nyitva van.
function zarvaOkai(nap: string, sz: FoglalasiBeallitasok) {
  const okok: string[] = [];
  if (!sz.hetNapjai.includes(hetNapja(nap))) okok.push('A stúdió ezen a napon nem fogad foglalást.');
  if (unnepnapok(Number(nap.slice(0, 4))).has(nap)) okok.push('Törvényes ünnep.');
  if (sz.pihenonapok.includes(nap)) okok.push('Pihenőnap.');
  for (const z of sz.zarvaIdoszakok) if (z.tol <= nap && nap <= z.ig) okok.push(`Zárva tartott időszak${z.ok ? `: ${z.ok}` : ''}.`);
  return okok;
}

const zarvaTartott = (sz: FoglalasiBeallitasok) => (f: FoglalasSor) =>
  zarvaOkai(f.nap, sz).length > 0 || sz.zartOrak.some((z) => z.nap === f.nap && z.ora === f.ora) || !sz.kezdoOrak.includes(f.ora);

function napKulonbseg(tol: string, ig: string) {
  return Math.round((Date.parse(`${ig}T00:00:00Z`) - Date.parse(`${tol}T00:00:00Z`)) / 864e5);
}

// ---- Belépés ----

async function belepes(req: IncomingMessage, res: ServerResponse, h: Hitelesites, urlap: URLSearchParams) {
  const vissza = biztonsagosVissza(urlap.get('vissza'));
  const felhasznalo = urlap.get('felhasznalo')?.trim() ?? '';
  const ip = keresIp(req);
  const most = Date.now();
  if (!belepesEngedett(ip, most)) {
    return kuld(res, 429, oldalak.belepesOldal({ vissza, felhasznalo, hiba: 'Túl sok sikertelen próbálkozás. Próbáld újra negyedóra múlva.' }));
  }
  // A jelszót akkor is ellenőrzi, ha a név rossz, hogy a válaszidőből ne derüljön ki, melyik hibás.
  const jelszoJo = await jelszoEllenorzes(urlap.get('jelszo') ?? '', h.jelszoHash);
  if (!(egyezik(felhasznalo, h.felhasznalo) && jelszoJo)) {
    hibasBelepes(ip, most);
    console.warn('[admin] sikertelen belépés');
    return kuld(res, 401, oldalak.belepesOldal({ vissza, felhasznalo, hiba: 'Hibás felhasználónév vagy jelszó.' }));
  }
  sikeresBelepes(ip);
  const token = munkamenetLetrehozasa(adatbazis(), h, new Date());
  console.log('[admin] belépés');
  atiranyit(res, vissza, [sutiFejlec(token)]);
}

// ---- Foglalások ----

function lista(res: ServerResponse, url: URL, csrf: string, sutik: string[]) {
  const nezet = (['kozelgo', 'korabbi', 'lemondott'].includes(url.searchParams.get('nezet') ?? '') ? url.searchParams.get('nezet') : 'kozelgo') as Nezet;
  const kereses = (url.searchParams.get('q') ?? '').slice(0, 100);
  const mainap = maiNap(new Date());
  const sz = beallitasok();
  const sorok = foglalasLista(adatbazis(), nezet, mainap, kereses);
  kuld(res, 200, oldalak.listaOldal({ nezet, kereses, sorok, mainap, sz, zarva: zarvaTartott(sz), csrf, uzenet: uzenetKodbol(url.searchParams.get('uzenet')) }), sutik);
}

function reszletek(res: ServerResponse, url: URL, id: number, csrf: string, sutik: string[]) {
  const f = foglalasLekerese(adatbazis(), id);
  if (!f) return kuld(res, 404, oldalak.hibaOldal('Nincs ilyen foglalás', 'Lehet, hogy közben törölték, vagy 2 évnél régebbi.', csrf), sutik);
  const sz = beallitasok();
  kuld(res, 200, oldalak.reszletekOldal({ f, mainap: maiNap(new Date()), sz, zarva: zarvaTartott(sz)(f), csrf, uzenet: uzenetKodbol(url.searchParams.get('uzenet')) }), sutik);
}

async function lemondas(res: ServerResponse, id: number, urlap: URLSearchParams, csrf: string) {
  const db = adatbazis();
  const f = foglalasLekerese(db, id);
  if (!f) return kuld(res, 404, oldalak.hibaOldal('Nincs ilyen foglalás', 'Lehet, hogy közben törölték.', csrf));
  const most = new Date();
  if (f.lemondva || f.nap < maiNap(most)) return atiranyit(res, `/admin/foglalas/${id}`);
  const indok = (urlap.get('indok') ?? '').trim().slice(0, 500);
  if (!lemond(db, id, most, indok)) return atiranyit(res, `/admin/foglalas/${id}`);
  console.log(`[admin] lemondva: ${id}. foglalás`);
  let kod = 'lemondva';
  if (urlap.get('ertesites') === 'igen' && f.email) kod += `.${await lemondoLevelKuldese(f, beallitasok(), indok, most)}`;
  atiranyit(res, `/admin/foglalas/${id}?uzenet=${kod}`);
}

// ---- Új foglalás ----

const HIBASZOVEGEK: Record<string, string> = {
  nap: 'Mai vagy későbbi napot válassz.',
  ora: 'Válassz egy szabad kezdő órát.',
  nev: 'Add meg a nevet (legfeljebb 100 karakter, egy sorban).',
  telefon: 'Érvényes telefonszám kell, pl. +36 20 123 4567.',
  email: 'Érvénytelen e-mail cím. Hagyd üresen, ha nincs.',
  telepules: 'Legfeljebb 100 karakter, egy sorban.',
  uzenet: 'Legfeljebb 2000 karakter.',
};

function ujOldalAdatai(nap: string, sz: FoglalasiBeallitasok, most: Date) {
  const mainap = maiNap(most);
  if (!nap) return { mainap, orak: [], figyelmeztetesek: [], napHiba: undefined };
  if (!ervenyesNapFormatum(nap) || nap < mainap) return { mainap, orak: [], figyelmeztetesek: [], napHiba: HIBASZOVEGEK.nap };
  const foglalasok = new Map(napFoglalasai(adatbazis(), nap).map((f) => [f.ora, f.nev]));
  const zartak = new Map(sz.zartOrak.filter((z) => z.nap === nap).map((z) => [z.ora, z.ok || true] as const));
  const orak: OraAllapot[] = sz.kezdoOrak.map((ora) => ({ ora, foglalt: foglalasok.get(ora), lezart: zartak.get(ora) }));
  const figyelmeztetesek = zarvaOkai(nap, sz).map((ok) => `${ok} A stúdió ettől még felvehet foglalást.`);
  const kulonbseg = napKulonbseg(mainap, nap);
  if (kulonbseg < sz.legkorabbanNapMulva || kulonbseg > sz.legkesobbNapMulva) figyelmeztetesek.push('A weboldalon erre a napra nem lehet foglalni, mert kívül esik a foglalási időablakon.');
  return { mainap, orak, figyelmeztetesek, napHiba: undefined };
}

function ujUrlap(res: ServerResponse, nap: string, ertekek: Record<string, string>, hibak: Record<string, string>, csrf: string, sutik: string[] = [], status = 200, uzenet: Uzenet | null = null) {
  const sz = beallitasok();
  const adatok = ujOldalAdatai(nap, sz, new Date());
  const osszesHiba = adatok.napHiba ? { ...hibak, nap: adatok.napHiba } : hibak;
  kuld(res, status, oldalak.ujOldal({ nap, mainap: adatok.mainap, sz, orak: adatok.orak, figyelmeztetesek: adatok.figyelmeztetesek, ertekek, hibak: osszesHiba, csrf, uzenet }), sutik);
}

async function ujFoglalas(res: ServerResponse, urlap: URLSearchParams, csrf: string) {
  const ertekek = Object.fromEntries(['nap', 'ora', 'nev', 'telefon', 'email', 'telepules', 'uzenet'].map((k) => [k, urlap.get(k) ?? '']));
  ertekek.visszaigazolas = urlap.get('visszaigazolas') === 'igen' ? 'igen' : 'nem';
  const { adatok, hibak } = urlapEllenorzes(ertekek, { emailKotelezo: false, adatkezelesKell: false });
  const most = new Date();
  const sz = beallitasok();
  if (!ervenyesNapFormatum(adatok.nap) || adatok.nap < maiNap(most)) hibak.push('nap');
  if (!sz.kezdoOrak.includes(adatok.ora)) hibak.push('ora');
  const hibaSzovegek = Object.fromEntries(hibak.map((h) => [h, HIBASZOVEGEK[h] ?? 'Hibás érték.']));
  if (hibak.length) return ujUrlap(res, adatok.nap, ertekek, hibaSzovegek, csrf, [], 400, { tipus: 'hiba', szoveg: 'Javítsd a megjelölt mezőket.' });

  const id = foglal(adatbazis(), adatok, most, 'telefon');
  if (id === null) {
    return ujUrlap(res, adatok.nap, { ...ertekek, ora: '' }, { ora: 'Ezt az órát közben lefoglalták, válassz másikat.' }, csrf, [], 409, {
      tipus: 'hiba',
      szoveg: 'Ezt az órát közben lefoglalták.',
    });
  }
  console.log(`[admin] telefonos foglalás rögzítve: ${id}. foglalás`);
  let kod = 'felveve';
  if (ertekek.visszaigazolas === 'igen' && adatok.email) kod += `.${await visszaigazolasKuldese({ ...adatok, id }, sz, most)}`;
  atiranyit(res, `/admin/foglalas/${id}?uzenet=${kod}`);
}

// ---- Zárva tartás ----

function erintettFoglalasok(sz: FoglalasiBeallitasok) {
  return foglalasLista(adatbazis(), 'kozelgo', maiNap(new Date())).filter(zarvaTartott(sz));
}

function zarva(res: ServerResponse, csrf: string, sutik: string[], uzenet: Uzenet | null, status = 200) {
  const sz = beallitasok();
  kuld(res, status, oldalak.zarvaOldal({ sz, erintett: erintettFoglalasok(sz), mainap: maiNap(new Date()), csrf, uzenet }), sutik);
}

function zarvaMentes(res: ServerResponse, urlap: URLSearchParams, csrf: string) {
  const regi = beallitasok();
  const uj: FoglalasiBeallitasok = {
    ...regi,
    pihenonapok: [...regi.pihenonapok],
    zarvaIdoszakok: [...regi.zarvaIdoszakok],
    zartOrak: [...regi.zartOrak],
  };
  const m = (k: string) => (urlap.get(k) ?? '').trim();
  const ok = (k: string) => m(k).slice(0, 200) || undefined;
  switch (m('muvelet')) {
    case 'idoszak-hozzaad':
      uj.zarvaIdoszakok = [...uj.zarvaIdoszakok, { tol: m('tol'), ig: m('ig'), ok: ok('ok') }].sort((a, b) => a.tol.localeCompare(b.tol));
      break;
    case 'idoszak-torol': {
      const i = uj.zarvaIdoszakok.findIndex((z) => z.tol === m('tol') && z.ig === m('ig'));
      if (i >= 0) uj.zarvaIdoszakok.splice(i, 1);
      break;
    }
    case 'pihenonap-hozzaad':
      if (!uj.pihenonapok.includes(m('pihenonap'))) uj.pihenonapok = [...uj.pihenonapok, m('pihenonap')].sort();
      break;
    case 'pihenonap-torol':
      uj.pihenonapok = uj.pihenonapok.filter((n) => n !== m('nap'));
      break;
    case 'ora-hozzaad':
      if (!uj.zartOrak.some((z) => z.nap === m('zartnap') && z.ora === m('ora'))) {
        uj.zartOrak = [...uj.zartOrak, { nap: m('zartnap'), ora: m('ora'), ok: ok('okora') }].sort((a, b) => `${a.nap}${a.ora}`.localeCompare(`${b.nap}${b.ora}`));
      }
      break;
    case 'ora-torol':
      uj.zartOrak = uj.zartOrak.filter((z) => !(z.nap === m('nap') && z.ora === m('ora')));
      break;
    default:
      return zarva(res, csrf, [], { tipus: 'hiba', szoveg: 'Ismeretlen művelet.' }, 400);
  }
  const hibak = foglalasiHibak(uj);
  if (hibak) return zarva(res, csrf, [], { tipus: 'hiba', szoveg: `Nem mentettem: ${Object.values(hibak).join('; ')}.` }, 400);
  beallitasokFrissitese(uj);
  console.log(`[admin] zárva tartás módosítva: ${m('muvelet')}`);
  atiranyit(res, '/admin/zarva?uzenet=zarva-mentve');
}

// ---- Beállítások ----

function beallitasErtekek(sz: FoglalasiBeallitasok): Record<string, string | string[]> {
  return {
    hetNapjai: sz.hetNapjai.map(String),
    kezdoOrak: sz.kezdoOrak.join(', '),
    hosszPerc: String(sz.hosszPerc),
    legkorabbanNapMulva: String(sz.legkorabbanNapMulva),
    legkesobbNapMulva: String(sz.legkesobbNapMulva),
    maxAktivFoglalas: String(sz.maxAktivFoglalas),
    ertesitesiCimek: sz.ertesitesiCimek.join('\n'),
  };
}

const szamma = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : Number.NaN);
// „8:00” → „08:00”, így a kezdő órák szövegként is helyesen rendeződnek.
const oraNormalizalas = (s: string) => (/^\d:\d\d$/.test(s) ? `0${s}` : s);

function beallitasMentes(res: ServerResponse, urlap: URLSearchParams, csrf: string) {
  const ertekek: Record<string, string | string[]> = {
    hetNapjai: urlap.getAll('hetNapjai'),
    kezdoOrak: urlap.get('kezdoOrak') ?? '',
    hosszPerc: urlap.get('hosszPerc') ?? '',
    legkorabbanNapMulva: urlap.get('legkorabbanNapMulva') ?? '',
    legkesobbNapMulva: urlap.get('legkesobbNapMulva') ?? '',
    maxAktivFoglalas: urlap.get('maxAktivFoglalas') ?? '',
    ertesitesiCimek: urlap.get('ertesitesiCimek') ?? '',
  };
  const regi = beallitasok();
  const uj = {
    ...regi,
    hetNapjai: [...new Set((ertekek.hetNapjai as string[]).map(szamma))].sort(),
    kezdoOrak: (ertekek.kezdoOrak as string).split(/[\s,;]+/).filter(Boolean).map(oraNormalizalas).sort(),
    hosszPerc: szamma(ertekek.hosszPerc as string),
    legkorabbanNapMulva: szamma(ertekek.legkorabbanNapMulva as string),
    legkesobbNapMulva: szamma(ertekek.legkesobbNapMulva as string),
    maxAktivFoglalas: szamma(ertekek.maxAktivFoglalas as string),
    ertesitesiCimek: (ertekek.ertesitesiCimek as string).split(/[\s,;]+/).filter(Boolean),
  };
  const hibak = foglalasiHibak(uj);
  if (hibak) {
    if (hibak.zartOrak) hibak.zartOrak += '. Előbb töröld a Zárva tartás oldalon, vagy hagyd meg ezt a kezdő órát';
    return kuld(res, 400, oldalak.beallitasokOldal({ ertekek, hibak, csrf, uzenet: { tipus: 'hiba', szoveg: 'Nem mentettem, javítsd a megjelölt mezőket.' } }));
  }
  beallitasokFrissitese(uj);
  console.log('[admin] beállítások módosítva');
  atiranyit(res, '/admin/beallitasok?uzenet=mentve');
}

// ---- Útválasztás ----

export async function adminKeres(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/admin') return atiranyit(res, '/admin/', [], 301);
  const ut = url.pathname.slice('/admin'.length);
  const get = req.method === 'GET' || req.method === 'HEAD';
  const post = req.method === 'POST';
  if (!get && !post) return kuld(res, 405, oldalak.hibaOldal('Nem támogatott kérés', 'Ez a művelet itt nem érhető el.'));

  const statikus = STATIKUS[ut];
  if (statikus && get) {
    res.writeHead(200, { ...FEJLECEK, 'Content-Type': statikus.tipus, 'Cache-Control': 'no-cache' });
    return res.end(statikus.tartalom);
  }

  const h = hitelesitesBeallitasa();
  if (!h) return kuld(res, 503, oldalak.nincsBeallitvaOldal());

  let urlap = new URLSearchParams();
  if (post) {
    if (!azonosEredet(req)) return kuld(res, 403, oldalak.hibaOldal('Elutasítva', 'A kérés nem az admin felületről jött. Töltsd újra az oldalt, és próbáld újra.'));
    const torzs = await torzsBeolvasasa(req);
    if (torzs === null) return kuld(res, 413, oldalak.hibaOldal('Túl nagy kérés', 'A beküldött adat túl nagy.'));
    urlap = new URLSearchParams(torzs);
  }

  const db = adatbazis();
  const most = new Date();
  const token = sutiOlvasasa(req);
  const mm = token ? munkamenetEllenorzes(db, h, token, most) : null;

  if (ut === '/belepes') {
    if (post) return belepes(req, res, h, urlap);
    if (mm) return atiranyit(res, biztonsagosVissza(url.searchParams.get('vissza')));
    return kuld(res, 200, oldalak.belepesOldal({ vissza: biztonsagosVissza(url.searchParams.get('vissza')) }));
  }

  if (!mm) {
    const vissza = get ? `?vissza=${encodeURIComponent(url.pathname + url.search)}` : '';
    return atiranyit(res, `/admin/belepes${vissza}`, token ? [sutiTorloFejlec] : []);
  }
  const sutik = mm.megujitva && token ? [sutiFejlec(token)] : [];

  if (post && !egyezik(urlap.get('csrf') ?? '', mm.csrf)) {
    return kuld(res, 403, oldalak.hibaOldal('Elutasítva', 'Lejárt az űrlap. Töltsd újra az oldalt, és próbáld újra.', mm.csrf));
  }

  if (ut === '/kilepes' && post) {
    munkamenetTorlese(db, token!);
    return atiranyit(res, '/admin/belepes', [sutiTorloFejlec]);
  }
  if (ut === '/' && get) return lista(res, url, mm.csrf, sutik);
  if (ut === '/uj' && get) return ujUrlap(res, (url.searchParams.get('nap') ?? '').trim(), {}, {}, mm.csrf, sutik);
  if (ut === '/uj' && post) return ujFoglalas(res, urlap, mm.csrf);
  if (ut === '/zarva' && get) return zarva(res, mm.csrf, sutik, uzenetKodbol(url.searchParams.get('uzenet')));
  if (ut === '/zarva' && post) return zarvaMentes(res, urlap, mm.csrf);
  if (ut === '/beallitasok' && get) {
    return kuld(res, 200, oldalak.beallitasokOldal({ ertekek: beallitasErtekek(beallitasok()), hibak: {}, csrf: mm.csrf, uzenet: uzenetKodbol(url.searchParams.get('uzenet')) }), sutik);
  }
  if (ut === '/beallitasok' && post) return beallitasMentes(res, urlap, mm.csrf);

  const foglalasUt = /^\/foglalas\/(\d{1,9})(\/lemondas)?$/.exec(ut);
  if (foglalasUt && !foglalasUt[2] && get) return reszletek(res, url, Number(foglalasUt[1]), mm.csrf, sutik);
  if (foglalasUt && foglalasUt[2] && post) return lemondas(res, Number(foglalasUt[1]), urlap, mm.csrf);

  kuld(res, 404, oldalak.hibaOldal('Nincs ilyen oldal', 'Ez a cím nem létezik az admin felületen.', mm.csrf), sutik);
}
