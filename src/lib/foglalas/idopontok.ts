// Foglalási szabályok tiszta függvényekkel: a napok `ÉÉÉÉ-HH-NN`, az órák `ÓÓ:PP` formájú szövegek.
// A kliens is használja a felirat-függvényeket, ezért itt nem lehet Node-függőség vagy a beállítások importja.

export interface IdopontSzabalyok {
  hetNapjai: number[];
  kezdoOrak: string[];
  legkorabbanNapMulva: number;
  legkesobbNapMulva: number;
  pihenonapok: string[];
  zarvaIdoszakok: { tol: string; ig: string }[];
  zartOrak: { nap: string; ora: string }[];
}

const IDOZONA = 'Europe/Budapest';

const napBol = (nap: string) => {
  const [ev, honap, nap_] = nap.split('-').map(Number);
  return new Date(Date.UTC(ev, honap - 1, nap_));
};

const hozzaad = (nap: string, napok: number) => {
  const d = napBol(nap);
  d.setUTCDate(d.getUTCDate() + napok);
  return d.toISOString().slice(0, 10);
};

// A szerver UTC-n fut, a „ma” és a „most” mindig a magyar idő szerint értendő.
export const maiNap = (most: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: IDOZONA }).format(most);

const jelenlegiOra = (most: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: IDOZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(most);

export const ervenyesNapFormatum = (nap: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(nap) && !Number.isNaN(napBol(nap).getTime()) && napBol(nap).toISOString().slice(0, 10) === nap;

// Húsvétvasárnap a Gauss-féle (anonim gregorián) algoritmussal.
function husvet(ev: number) {
  const a = ev % 19;
  const b = Math.floor(ev / 100);
  const c = ev % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const honap = Math.floor((h + l - 7 * m + 114) / 31);
  const nap = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ev}-${String(honap).padStart(2, '0')}-${String(nap).padStart(2, '0')}`;
}

// A törvényes munkaszüneti napok (Mt. 102. §). Az áthelyezett pihenőnapok évente rendeletben jelennek meg, azok a `pihenonapok` listában vannak.
export function unnepnapok(ev: number) {
  const vasarnap = husvet(ev);
  return new Set([
    `${ev}-01-01`,
    `${ev}-03-15`,
    hozzaad(vasarnap, -2),
    hozzaad(vasarnap, 1),
    `${ev}-05-01`,
    hozzaad(vasarnap, 50),
    `${ev}-08-20`,
    `${ev}-10-23`,
    `${ev}-11-01`,
    `${ev}-12-25`,
    `${ev}-12-26`,
  ]);
}

function nyitvaVan(nap: string, sz: IdopontSzabalyok) {
  return (
    sz.hetNapjai.includes(napBol(nap).getUTCDay()) &&
    !unnepnapok(Number(nap.slice(0, 4))).has(nap) &&
    !sz.pihenonapok.includes(nap) &&
    !sz.zarvaIdoszakok.some((z) => z.tol <= nap && nap <= z.ig)
  );
}

function napOrai(nap: string, most: Date, sz: IdopontSzabalyok) {
  const ma = maiNap(most);
  const ora = jelenlegiOra(most);
  return sz.kezdoOrak.filter((o) => !(nap === ma && o <= ora) && !sz.zartOrak.some((z) => z.nap === nap && z.ora === o));
}

// A foglalási időablak minden foglalható napja a nyitvatartás szerint lehetséges óráival.
export function foglalhatoIdopontok(most: Date, sz: IdopontSzabalyok) {
  const ma = maiNap(most);
  const eredmeny: Record<string, string[]> = {};
  for (let i = sz.legkorabbanNapMulva; i <= sz.legkesobbNapMulva; i++) {
    const nap = hozzaad(ma, i);
    if (!nyitvaVan(nap, sz)) continue;
    const orak = napOrai(nap, most, sz);
    if (orak.length > 0) eredmeny[nap] = orak;
  }
  return eredmeny;
}

// Csak a szabad órák: a foglaltak nem jutnak el a látogatóhoz.
export function szabadIdopontok(most: Date, sz: IdopontSzabalyok, foglaltak: { nap: string; ora: string }[]) {
  const eredmeny: Record<string, string[]> = {};
  for (const [nap, orak] of Object.entries(foglalhatoIdopontok(most, sz))) {
    const szabad = orak.filter((o) => !foglaltak.some((f) => f.nap === nap && f.ora === o));
    if (szabad.length > 0) eredmeny[nap] = szabad;
  }
  return eredmeny;
}

export function ervenyesIdopont(nap: string, ora: string, most: Date, sz: IdopontSzabalyok) {
  return ervenyesNapFormatum(nap) && (foglalhatoIdopontok(most, sz)[nap] ?? []).includes(ora);
}

// Az űrlap alapértelmezett napja: a holnapi, vagy ha az nem foglalható, az utána következő első szabad nap.
export function alapertelmezettNap(napok: string[], most: Date) {
  const holnap = hozzaad(maiNap(most), 1);
  return napok.find((n) => n >= holnap) ?? napok[0];
}

export const napFelirat = (nap: string) =>
  new Intl.DateTimeFormat('hu-HU', { dateStyle: 'full', timeZone: 'UTC' }).format(napBol(nap));

export function oraFelirat(ora: string, hosszPerc: number) {
  const [o, p] = ora.split(':').map(Number);
  const vege = o * 60 + p + hosszPerc;
  return `${o}:${String(p).padStart(2, '0')}–${Math.floor(vege / 60)}:${String(vege % 60).padStart(2, '0')}`;
}

// Magyar helyi idő → UTC. Az óraátállítás éjszaka történik, nyitvatartási időben nem okoz gondot.
export function utcIdopont(nap: string, ora: string) {
  const tipp = new Date(`${nap}T${ora}:00Z`);
  const helyi = new Intl.DateTimeFormat('sv-SE', { timeZone: IDOZONA, dateStyle: 'short', timeStyle: 'medium' }).format(tipp);
  const eltolas = new Date(`${helyi.replace(' ', 'T')}Z`).getTime() - tipp.getTime();
  return new Date(tipp.getTime() - eltolas);
}
