import type { APIRoute } from 'astro';
import { beallitasok } from '../../lib/foglalas/beallitasok.ts';
import { aktivFoglalasok, foglal, regiekTorlese } from '../../lib/foglalas/db.ts';
import { levelekKuldese } from '../../lib/foglalas/email.ts';
import { ervenyesIdopont, maiNap } from '../../lib/foglalas/idopontok.ts';
import { adatbazis, json, korlatonBelul } from '../../lib/foglalas/szerver.ts';
import { urlapEllenorzes } from '../../lib/foglalas/urlap.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const adat = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!adat || typeof adat !== 'object') return json({ hiba: 'adat' }, 400);

  // A robotok kitöltik a rejtett mezőt. Sikert kapnak, hogy ne próbálkozzanak tovább.
  if (adat._gotcha) return json({ ok: true }, 201);

  // Az Apache az X-Forwarded-For végére írja a valódi címet, a Node csak helyben érhető el.
  const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || clientAddress;
  const most = new Date();
  if (!korlatonBelul(ip, most.getTime())) return json({ hiba: 'tul-sok-keres' }, 429);

  const { adatok, hibak } = urlapEllenorzes(adat);
  if (hibak.length > 0) return json({ hiba: 'adat', mezok: hibak }, 400);
  if (!ervenyesIdopont(adatok.nap, adatok.ora, most, beallitasok)) return json({ hiba: 'idopont' }, 400);

  const db = adatbazis();
  if (aktivFoglalasok(db, adatok.email, adatok.telefon, maiNap(most)) >= beallitasok.maxAktivFoglalas) {
    return json({ hiba: 'tul-sok-foglalas' }, 429);
  }

  const id = foglal(db, adatok, most);
  if (id === null) return json({ hiba: 'foglalt' }, 409);

  regiekTorlese(db, most);
  levelekKuldese({ ...adatok, id }, beallitasok, most).catch((err) => console.error(`[foglalas] levélküldési hiba (${id}):`, err?.message));
  return json({ ok: true }, 201);
};
