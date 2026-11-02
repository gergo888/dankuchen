import { beallitasok } from './beallitasok.ts';
import { lemondasok, megnyitas, regiekTorlese } from './db.ts';

type Db = ReturnType<typeof megnyitas>;

let db: Db | undefined;

// Egy példány a folyamat teljes élettartamára. A JSON módosítása telepítéssel és újraindítással jár,
// ezért a lemondások érvényesítéséhez elég az első megnyitás.
export function adatbazis() {
  if (!db) {
    db = megnyitas(process.env.DB_PATH ?? 'data/foglalasok.db');
    const most = new Date();
    lemondasok(db, beallitasok.lemondottFoglalasok, most);
    regiekTorlese(db, most);
  }
  return db;
}

const LIMIT = 5;
const ABLAK_MS = 10 * 60 * 1000;
const kerelmek = new Map<string, number[]>();

// IP-nkénti korlát csak memóriában, így IP-cím nem kerül az adatbázisba.
export function korlatonBelul(ip: string, most: number) {
  for (const [kulcs, idok] of kerelmek) {
    const friss = idok.filter((t) => most - t < ABLAK_MS);
    if (friss.length > 0) kerelmek.set(kulcs, friss);
    else kerelmek.delete(kulcs);
  }
  const idok = kerelmek.get(ip) ?? [];
  if (idok.length >= LIMIT) return false;
  kerelmek.set(ip, [...idok, most]);
  return true;
}

export const json = (tartalom: unknown, status = 200) =>
  new Response(JSON.stringify(tartalom), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
