import { ervenyesIdopont, maiNap, szabadIdopontok } from '../../shared/idopontok.ts';
import { aktivFoglalasok, foglal, foglaltOrak, regiekTorlese } from './db.ts';
import { levelekKuldese } from './email.ts';
import { adatbazis, beallitasok } from './kapcsolat.ts';
import { korlatonBelul } from './korlat.ts';
import { urlapEllenorzes } from './urlap.ts';

export interface ApiValasz {
  status: number;
  tartalom: unknown;
}

// Csak a szabad órák, személyes adat nélkül.
export function szabadIdopontokLekerese(): ApiValasz {
  const most = new Date();
  const sz = beallitasok();
  const napok = szabadIdopontok(most, sz, foglaltOrak(adatbazis(), maiNap(most)));
  return { status: 200, tartalom: { hosszPerc: sz.hosszPerc, napok } };
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
  const sz = beallitasok();
  if (!ervenyesIdopont(adatok.nap, adatok.ora, most, sz)) return { status: 400, tartalom: { hiba: 'idopont' } };

  const kapcsolat = adatbazis();
  if (aktivFoglalasok(kapcsolat, adatok.email, adatok.telefon, maiNap(most)) >= sz.maxAktivFoglalas) {
    return { status: 429, tartalom: { hiba: 'tul-sok-foglalas' } };
  }

  const id = foglal(kapcsolat, adatok, most);
  if (id === null) return { status: 409, tartalom: { hiba: 'foglalt' } };

  regiekTorlese(kapcsolat, most);
  levelekKuldese({ ...adatok, id }, sz, most).catch((err) => console.error(`[foglalas] levélküldési hiba (${id}):`, err?.message));
  return { status: 201, tartalom: { ok: true } };
}
