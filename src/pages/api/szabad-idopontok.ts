import type { APIRoute } from 'astro';
import { beallitasok } from '../../lib/foglalas/beallitasok.ts';
import { foglaltOrak } from '../../lib/foglalas/db.ts';
import { maiNap, szabadIdopontok } from '../../lib/foglalas/idopontok.ts';
import { adatbazis, json } from '../../lib/foglalas/szerver.ts';

export const prerender = false;

// Csak a szabad órák, személyes adat nélkül.
export const GET: APIRoute = () => {
  const most = new Date();
  const napok = szabadIdopontok(most, beallitasok, foglaltOrak(adatbazis(), maiNap(most)));
  return json({ hosszPerc: beallitasok.hosszPerc, napok });
};
