import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { foglalasiEllenorzes } from './beallitasok.ts';
import type { FoglalasiBeallitasok } from './beallitasok.ts';

export interface FoglalasAdatok {
  nap: string;
  ora: string;
  nev: string;
  telefon: string;
  email: string;
  telepules: string;
  uzenet: string;
}

export type Forras = 'web' | 'telefon';

export interface FoglalasSor extends FoglalasAdatok {
  id: number;
  letrehozva: string;
  lemondva: string | null;
  forras: Forras;
  lemondas_oka: string | null;
}

const MEGORZES_EV = 2;

// A feltételes egyedi index zárja ki a dupla foglalást, a lemondott óra viszont újra foglalható.
// Az AUTOINCREMENT miatt egy törölt foglalás azonosítója nem kerül újra kiosztásra.
const SEMA = `
  CREATE TABLE IF NOT EXISTS foglalas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nap TEXT NOT NULL,
    ora TEXT NOT NULL,
    nev TEXT NOT NULL,
    telefon TEXT NOT NULL,
    email TEXT NOT NULL,
    telepules TEXT NOT NULL,
    uzenet TEXT NOT NULL,
    letrehozva TEXT NOT NULL,
    lemondva TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS foglalas_idopont ON foglalas (nap, ora) WHERE lemondva IS NULL;
`;

// Sorrendben lefutó sémamódosítások. A már lefutottak számát a `PRAGMA user_version` tárolja,
// így a meglévő adatbázis a foglalásaival együtt frissül. Új módosítás mindig a lista végére kerül.
const MIGRACIOK = [
  // 1. Admin felület: telefonos foglalás, lemondás oka, szerkeszthető beállítások, belépési munkamenetek.
  `ALTER TABLE foglalas ADD COLUMN forras TEXT NOT NULL DEFAULT 'web';
   ALTER TABLE foglalas ADD COLUMN lemondas_oka TEXT;
   CREATE TABLE beallitasok (id INTEGER PRIMARY KEY CHECK (id = 1), adat TEXT NOT NULL, modositva TEXT NOT NULL);
   CREATE TABLE munkamenet (token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, ujjlenyomat TEXT NOT NULL, lejar TEXT NOT NULL);`,
];

function migracio(db: DatabaseSync) {
  const { user_version: verzio } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let i = verzio; i < MIGRACIOK.length; i++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(MIGRACIOK[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

export function megnyitas(utvonal: string) {
  if (utvonal !== ':memory:') mkdirSync(dirname(utvonal), { recursive: true });
  const db = new DatabaseSync(utvonal);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(SEMA);
  migracio(db);
  return db;
}

// A foglalás azonosítója, vagy `null`, ha az órát közben már lefoglalták.
export function foglal(db: DatabaseSync, f: FoglalasAdatok, most: Date, forras: Forras = 'web') {
  const eredmeny = db
    .prepare(
      `INSERT INTO foglalas (nap, ora, nev, telefon, email, telepules, uzenet, letrehozva, forras)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (nap, ora) WHERE lemondva IS NULL DO NOTHING`,
    )
    .run(f.nap, f.ora, f.nev, f.telefon, f.email, f.telepules, f.uzenet, most.toISOString(), forras);
  return eredmeny.changes === 0 ? null : Number(eredmeny.lastInsertRowid);
}

export function foglaltOrak(db: DatabaseSync, mainap: string) {
  return db.prepare('SELECT nap, ora FROM foglalas WHERE lemondva IS NULL AND nap >= ?').all(mainap) as unknown as {
    nap: string;
    ora: string;
  }[];
}

const csakSzamok = (telefon: string) => telefon.replace(/\D/g, '');

// Ugyanarra az e-mail címre vagy telefonszámra szóló élő, jövőbeli foglalások száma.
export function aktivFoglalasok(db: DatabaseSync, email: string, telefon: string, mainap: string) {
  const sorok = db.prepare('SELECT email, telefon FROM foglalas WHERE lemondva IS NULL AND nap >= ?').all(mainap) as unknown as {
    email: string;
    telefon: string;
  }[];
  return sorok.filter((s) => (s.email && s.email.toLowerCase() === email.toLowerCase()) || csakSzamok(s.telefon) === csakSzamok(telefon)).length;
}

// Igaz, ha a foglalás élő volt, és most lemondva lett.
export function lemond(db: DatabaseSync, id: number, most: Date, ok: string | null) {
  return db.prepare('UPDATE foglalas SET lemondva = ?, lemondas_oka = ? WHERE id = ? AND lemondva IS NULL').run(most.toISOString(), ok || null, id).changes === 1;
}

export function foglalasLekerese(db: DatabaseSync, id: number) {
  return db.prepare('SELECT * FROM foglalas WHERE id = ?').get(id) as unknown as FoglalasSor | undefined;
}

export type Nezet = 'kozelgo' | 'korabbi' | 'lemondott';

// Az admin listája. A közelgők időrendben, a korábbiak és a lemondottak a legutóbbitól visszafelé.
export function foglalasLista(db: DatabaseSync, nezet: Nezet, mainap: string, kereses = '', limit = 300) {
  const feltetel = {
    kozelgo: 'lemondva IS NULL AND nap >= :ma',
    korabbi: 'lemondva IS NULL AND nap < :ma',
    lemondott: 'lemondva IS NOT NULL',
  }[nezet];
  const rendezes = nezet === 'kozelgo' ? 'nap, ora' : 'nap DESC, ora DESC';
  const minta = kereses.trim().toLowerCase();
  const lekeres = db.prepare(`SELECT * FROM foglalas WHERE ${feltetel} ORDER BY ${rendezes}`);
  const sorok = (feltetel.includes(':ma') ? lekeres.all({ ma: mainap }) : lekeres.all()) as unknown as FoglalasSor[];
  // A keresés a JS-ben fut, mert az SQLite LOWER() nem ismeri az ékezetes nagybetűket.
  const szamok = csakSzamok(minta);
  return (minta
    ? sorok.filter(
        (s) =>
          s.nev.toLowerCase().includes(minta) || s.email.toLowerCase().includes(minta) || (szamok.length >= 3 && csakSzamok(s.telefon).includes(szamok)),
      )
    : sorok
  ).slice(0, limit);
}

// Egy nap élő foglalásai óránként, az új foglalás űrlapjához.
export function napFoglalasai(db: DatabaseSync, nap: string) {
  return db.prepare('SELECT * FROM foglalas WHERE lemondva IS NULL AND nap = ? ORDER BY ora').all(nap) as unknown as FoglalasSor[];
}

// Az adatkezelési tájékoztató szerint az adatokat legfeljebb 2 évig őrizzük meg.
export function regiekTorlese(db: DatabaseSync, most: Date) {
  const hatar = new Date(most);
  hatar.setUTCFullYear(hatar.getUTCFullYear() - MEGORZES_EV);
  return db.prepare('DELETE FROM foglalas WHERE letrehozva < ?').run(hatar.toISOString()).changes;
}

// Az adminban szerkeszthető beállítások. Üres adatbázisnál az alapértékek kerülnek bele.
export function beallitasokBetoltese(db: DatabaseSync, alap: FoglalasiBeallitasok, most: Date) {
  const sor = db.prepare('SELECT adat FROM beallitasok WHERE id = 1').get() as { adat: string } | undefined;
  if (!sor) {
    beallitasokMentese(db, alap, most);
    return alap;
  }
  return foglalasiEllenorzes(JSON.parse(sor.adat));
}

export function beallitasokMentese(db: DatabaseSync, uj: FoglalasiBeallitasok, most: Date) {
  db.prepare('INSERT INTO beallitasok (id, adat, modositva) VALUES (1, ?, ?) ON CONFLICT (id) DO UPDATE SET adat = excluded.adat, modositva = excluded.modositva').run(
    JSON.stringify(foglalasiEllenorzes(uj)),
    most.toISOString(),
  );
}
