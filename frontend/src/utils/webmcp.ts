// WebMCP (https://developer.chrome.com/docs/ai/webmcp): az időpontfoglalás eszközei a böngészőben futó AI-agenteknek.
// Csak olyan böngészőben regisztrálódik, amely ismeri a document.modelContext-et, máshol nem csinál semmit.
// A böngésző nem ellenőrzi a bemenetet a séma szerint, és a dobott hibából csak általános hibát ad át,
// ezért minden ellenőrzés itt van, és a hibák az agentnek szóló, javítást segítő szövegként térnek vissza.
import { napFelirat, oraFelirat } from '../../../shared/idopontok.ts';
import studio from '../../../shared/studio.json';

// Origin trial token a https://dankuchenkaposvar.hu címre (aldomainekkel). Ez kapcsolja be az API-t a látogatók Chrome-jában.
// Első feles token kell („Third-party matching” nélkül), a harmadik felest a Chrome itt WrongOrigin státusszal elutasítja.
// Lejár: 2027-03-30, előtte meg kell újítani: https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241
export const WEBMCP_ORIGIN_TRIAL =
  'AtvvPfmF1sSim6hLRUN7m043ktTS/UDyx4hfth14YGuWxvmjEdyKZH6S2+RF0JeI+i0N+OcF1nsDxVNeidkwQgkAAABneyJvcmlnaW4iOiJodHRwczovL2Rhbmt1Y2hlbmthcG9zdmFyLmh1OjQ0MyIsImZlYXR1cmUiOiJXZWJNQ1AiLCJleHBpcnkiOjE4MDYzNjQ4MDAsImlzU3ViZG9tYWluIjp0cnVlfQ==';

interface Eszkoz {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean };
  execute: (bemenet: Record<string, unknown>, extra: { signal: AbortSignal }) => Promise<unknown>;
}

declare global {
  interface Document {
    modelContext?: { registerTool(eszkoz: Eszkoz): void };
  }
}

export type FoglalasEredmeny = { ok: true } | { ok: false; kod: string; mezok: string[] };

interface Fuggosegek {
  // Friss szabad időpontok (az oldalon látható listákat is frissíti). Hibánál null.
  szabadIdopontok: () => Promise<{ napok: Record<string, string[]>; hosszPerc: number } | null>;
  foglalas: (adat: Record<string, string>) => Promise<FoglalasEredmeny>;
  hibaSzoveg: (kod: string) => string;
  sikeresFoglalas: (szoveg: string) => void;
  adatkezelesUrl: string;
}

const NAP_MINTA = /^\d{4}-\d{2}-\d{2}$/;
const ORA_MINTA = /^\d{2}:\d{2}$/;
const MEZOK: Record<string, string> = {
  nap: 'nap',
  ora: 'óra',
  nev: 'név (legfeljebb 100 karakter, egy sorban)',
  telefon: 'telefonszám (pl. +36 20 123 4567)',
  email: 'e-mail cím',
  telepules: 'település (legfeljebb 100 karakter)',
  uzenet: 'üzenet (legfeljebb 2000 karakter)',
  adatkezeles: 'adatkezelési hozzájárulás',
};
const NEM_ELERHETO = 'Most nem tudjuk lekérni a szabad időpontokat. Próbáld újra később, vagy hívd a stúdiót: ' + studio.telefon;

export function eszkozokRegisztralasa(f: Fuggosegek) {
  const mc = document.modelContext;
  if (!mc) return;

  mc.registerTool({
    name: 'szabad_idopontok',
    description:
      'A DANKÜCHEN kaposvári stúdiójában foglalható, ingyenes látványtervezési időpontok. Paraméter nélkül a foglalható napokat adja vissza a szabad időpontok számával, egy adott napra (nap) a szabad kezdési időpontokat.',
    inputSchema: {
      type: 'object',
      properties: {
        nap: { type: 'string', pattern: NAP_MINTA.source, description: 'Nem kötelező. A nap ÉÉÉÉ-HH-NN formában, ha egy nap szabad óráira vagy kíváncsi.' },
      },
    },
    annotations: { readOnlyHint: true },
    execute: async ({ nap }) => {
      const adat = await f.szabadIdopontok();
      if (!adat) return NEM_ELERHETO;
      if (nap === undefined || nap === '') {
        const napok = Object.fromEntries(Object.entries(adat.napok).map(([n, orak]) => [n, orak.length]));
        return { idotartamPerc: adat.hosszPerc, szabadIdopontokNaponta: napok, megjegyzes: 'Egy nap kezdési időpontjait a nap paraméterrel kérdezheted le.' };
      }
      if (typeof nap !== 'string' || !NAP_MINTA.test(nap)) return 'Hibás nap: ÉÉÉÉ-HH-NN formában add meg, pl. 2026-11-09.';
      const orak = adat.napok[nap] ?? [];
      if (orak.length === 0) return `Ezen a napon (${nap}) nincs szabad időpont. Foglalható napok: ${Object.keys(adat.napok).join(', ') || 'nincs'}.`;
      return { nap, felirat: napFelirat(nap), idotartamPerc: adat.hosszPerc, kezdesiIdopontok: orak };
    },
  });

  mc.registerTool({
    name: 'idopont_foglalasa',
    description: `Időpont foglalása ingyenes, egyórás látványtervezésre a DANKÜCHEN stúdiójába (${studio.cim}). A foglalás valódi: a foglaló és a stúdió is e-mailt kap róla. Csak a felhasználó kérésére, az ő adataival használd. A napot és az órát a szabad_idopontok eszköz válaszából vedd.`,
    inputSchema: {
      type: 'object',
      properties: {
        nap: { type: 'string', pattern: NAP_MINTA.source, description: 'A foglalás napja ÉÉÉÉ-HH-NN formában, a szabad_idopontok válaszából.' },
        ora: { type: 'string', pattern: ORA_MINTA.source, description: 'Kezdési időpont ÓÓ:PP formában (pl. 10:00), a szabad_idopontok válaszából.' },
        nev: { type: 'string', maxLength: 100, description: 'A foglaló teljes neve.' },
        telefon: { type: 'string', description: 'A foglaló telefonszáma, pl. +36 20 123 4567.' },
        email: { type: 'string', format: 'email', description: 'A foglaló e-mail címe, ide megy a visszaigazolás.' },
        telepules: { type: 'string', maxLength: 100, description: 'A foglaló települése (nem kötelező).' },
        uzenet: { type: 'string', maxLength: 2000, description: 'Megjegyzés a stúdiónak, pl. a konyha mérete (nem kötelező).' },
        adatkezeles_elfogadva: { type: 'boolean', description: `Csak akkor true, ha a felhasználó elolvasta és elfogadta az adatkezelési tájékoztatót: ${f.adatkezelesUrl}` },
      },
      required: ['nap', 'ora', 'nev', 'telefon', 'email', 'adatkezeles_elfogadva'],
    },
    annotations: { consequentialHint: true },
    execute: async (bemenet, { signal }) => {
      const szoveg = (kulcs: string) => (typeof bemenet[kulcs] === 'string' ? (bemenet[kulcs] as string).trim() : '');
      const adat = { nap: szoveg('nap'), ora: szoveg('ora'), nev: szoveg('nev'), telefon: szoveg('telefon'), email: szoveg('email'), telepules: szoveg('telepules'), uzenet: szoveg('uzenet') };

      if (bemenet.adatkezeles_elfogadva !== true) {
        return `Nem foglaltam. A foglaláshoz a felhasználónak el kell fogadnia az adatkezelési tájékoztatót (${f.adatkezelesUrl}). Kérdezd meg tőle, és csak az elfogadása után hívd újra adatkezeles_elfogadva: true értékkel.`;
      }
      const hianyzik = (['nap', 'ora', 'nev', 'telefon', 'email'] as const).filter((k) => !adat[k]);
      if (hianyzik.length > 0) return `Nem foglaltam, hiányzik: ${hianyzik.map((k) => MEZOK[k]).join(', ')}.`;
      if (!NAP_MINTA.test(adat.nap) || !ORA_MINTA.test(adat.ora)) {
        return 'Nem foglaltam: a nap ÉÉÉÉ-HH-NN, az óra ÓÓ:PP formájú legyen (pl. 2026-11-09 és 10:00), a szabad_idopontok válaszából.';
      }
      if (signal.aborted) return 'A foglalást megszakították, nem küldtem el.';

      const eredmeny = await f.foglalas({ ...adat, adatkezeles: 'elfogadva' });
      if (!eredmeny.ok) {
        if (eredmeny.kod === 'adat' && eredmeny.mezok.length > 0) {
          return `Nem foglaltam, ezeket ellenőrizd: ${eredmeny.mezok.map((m) => MEZOK[m] ?? m).join(', ')}.`;
        }
        let valasz = `Nem foglaltam: ${f.hibaSzoveg(eredmeny.kod)}`;
        if (eredmeny.kod === 'foglalt' || eredmeny.kod === 'idopont') {
          const friss = await f.szabadIdopontok();
          const orak = friss?.napok[adat.nap] ?? [];
          valasz += orak.length ? ` Ezen a napon még szabad: ${orak.join(', ')}.` : ' Ezen a napon már nincs szabad időpont.';
        }
        return valasz;
      }

      // A foglalás megtörtént: előbb az oldal is frissül, csak utána jelzünk sikert.
      const friss = await f.szabadIdopontok();
      const visszajelzes = `Lefoglalva: ${napFelirat(adat.nap)}, ${oraFelirat(adat.ora, friss?.hosszPerc ?? 60)} (helyszín: ${studio.cim}). A visszaigazolást elküldtük a(z) ${adat.email} címre.`;
      f.sikeresFoglalas(visszajelzes);
      return visszajelzes;
    },
  });
}
