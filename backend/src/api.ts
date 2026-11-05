import { ervenyesIdopont, maiNap, szabadIdopontok } from '../../shared/idopontok.ts';
import { beallitasok } from './beallitasok.ts';
import { aktivFoglalasok, foglal, foglaltOrak, lemondasok, megnyitas, regiekTorlese } from './db.ts';
import { levelekKuldese } from './email.ts';
import { korlatonBelul } from './korlat.ts';
import { urlapEllenorzes } from './urlap.ts';

export interface ApiValasz {
  status: number;
  tartalom: unknown;
}

let db: ReturnType<typeof megnyitas> | undefined;

// Egy példány a folyamat teljes élettartamára. A JSON módosítása telepítéssel és újraindítással jár,
// ezért a lemondások érvényesítéséhez elég az első megnyitás.
function adatbazis() {
  if (!db) {
    db = megnyitas(process.env.DB_PATH ?? 'data/foglalasok.db');
    const most = new Date();
    lemondasok(db, beallitasok.lemondottFoglalasok, most);
    regiekTorlese(db, most);
  }
  return db;
}

// Csak a szabad órák, személyes adat nélkül.
export function szabadIdopontokLekerese(): ApiValasz {
  const most = new Date();
  const napok = szabadIdopontok(most, beallitasok, foglaltOrak(adatbazis(), maiNap(most)));
  return { status: 200, tartalom: { hosszPerc: beallitasok.hosszPerc, napok } };
}

export function foglalasBekuldese(bekuldott: unknown, ip: string): ApiValasz {
  if (!bekuldott || typeof bekuldott !== 'object') return { status: 400, tartalom: { hiba: 'adat' } };
  const adat = bekuldott as Record<string, unknown>;

  // A robotok kitöltik a rejtett mezőt. Sikert kapnak, hogy ne próbálkozzanak tovább.
  if (adat._gotcha) return { status: 201, tartalom: { ok: true } };

  const most = new Date();
  if (!korlatonBelul(ip, most.getTime())) return { status: 429, tartalom: { hiba: 'tul-sok-keres' } };

  const { adatok, hibak } = urlapEllenorzes(adat);
  if (hibak.length > 0) return { status: 400, tartalom: { hiba: 'adat', mezok: hibak } };
  if (!ervenyesIdopont(adatok.nap, adatok.ora, most, beallitasok)) return { status: 400, tartalom: { hiba: 'idopont' } };

  const kapcsolat = adatbazis();
  if (aktivFoglalasok(kapcsolat, adatok.email, adatok.telefon, maiNap(most)) >= beallitasok.maxAktivFoglalas) {
    return { status: 429, tartalom: { hiba: 'tul-sok-foglalas' } };
  }

  const id = foglal(kapcsolat, adatok, most);
  if (id === null) return { status: 409, tartalom: { hiba: 'foglalt' } };

  regiekTorlese(kapcsolat, most);
  levelekKuldese({ ...adatok, id }, beallitasok, most).catch((err) => console.error(`[foglalas] levélküldési hiba (${id}):`, err?.message));
  return { status: 201, tartalom: { ok: true } };
}
