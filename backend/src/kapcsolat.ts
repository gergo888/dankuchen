import { ALAPERTEKEK, foglalasiEllenorzes, technikai } from './beallitasok.ts';
import type { Beallitasok, FoglalasiBeallitasok } from './beallitasok.ts';
import { beallitasokBetoltese, beallitasokMentese, megnyitas, regiekTorlese } from './db.ts';

// Egy adatbázis-kapcsolat és a beállítások egy példánya a folyamat teljes élettartamára.
// Az API és az admin is ezt használja, így az adminban mentett beállítás azonnal érvényes.
let db: ReturnType<typeof megnyitas> | undefined;
let foglalasi: FoglalasiBeallitasok;

export function adatbazis() {
  if (!db) {
    const most = new Date();
    db = megnyitas(process.env.DB_PATH ?? 'data/foglalasok.db');
    foglalasi = beallitasokBetoltese(db, ALAPERTEKEK, most);
    regiekTorlese(db, most);
  }
  return db;
}

export function beallitasok(): Beallitasok {
  adatbazis();
  return { ...foglalasi, ...technikai };
}

export function beallitasokFrissitese(uj: FoglalasiBeallitasok) {
  const ellenorzott = foglalasiEllenorzes(uj);
  beallitasokMentese(adatbazis(), ellenorzott, new Date());
  foglalasi = ellenorzott;
}
