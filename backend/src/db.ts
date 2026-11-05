import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface FoglalasAdatok {
  nap: string;
  ora: string;
  nev: string;
  telefon: string;
  email: string;
  telepules: string;
  uzenet: string;
}

const MEGORZES_EV = 2;

// A feltételes egyedi index zárja ki a dupla foglalást, a lemondott óra viszont újra foglalható.
// Az AUTOINCREMENT miatt egy törölt foglalás azonosítója nem kerül újra kiosztásra, így a
// `lemondottFoglalasok` listában maradt szám sosem érinthet későbbi foglalást.
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

export function megnyitas(utvonal: string) {
  if (utvonal !== ':memory:') mkdirSync(dirname(utvonal), { recursive: true });
  const db = new DatabaseSync(utvonal);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(SEMA);
  return db;
}

// A foglalás azonosítója, vagy `null`, ha az órát közben már lefoglalták.
export function foglal(db: DatabaseSync, f: FoglalasAdatok, most: Date) {
  const eredmeny = db
    .prepare(
      `INSERT INTO foglalas (nap, ora, nev, telefon, email, telepules, uzenet, letrehozva)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (nap, ora) WHERE lemondva IS NULL DO NOTHING`,
    )
    .run(f.nap, f.ora, f.nev, f.telefon, f.email, f.telepules, f.uzenet, most.toISOString());
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
  return sorok.filter((s) => s.email.toLowerCase() === email.toLowerCase() || csakSzamok(s.telefon) === csakSzamok(telefon)).length;
}

// A `lemondottFoglalasok` JSON-lista érvényesítése.
export function lemondasok(db: DatabaseSync, azonositok: number[], most: Date) {
  return db
    .prepare('UPDATE foglalas SET lemondva = ? WHERE lemondva IS NULL AND id IN (SELECT value FROM json_each(?))')
    .run(most.toISOString(), JSON.stringify(azonositok)).changes;
}

// Az adatkezelési tájékoztató szerint az adatokat legfeljebb 2 évig őrizzük meg.
export function regiekTorlese(db: DatabaseSync, most: Date) {
  const hatar = new Date(most);
  hatar.setUTCFullYear(hatar.getUTCFullYear() - MEGORZES_EV);
  return db.prepare('DELETE FROM foglalas WHERE letrehozva < ?').run(hatar.toISOString()).changes;
}
