import type { FoglalasAdatok } from './db.ts';

const szoveg = (ertek: unknown) => (typeof ertek === 'string' ? ertek.trim() : '');
const egysoros = (s: string) => !/[\r\n\t\p{Cc}]/u.test(s);

// A beküldött mezők ellenőrzése. Hibás adatnál a hibás mezők nevét adja vissza.
export function urlapEllenorzes(adat: Record<string, unknown>): { adatok: FoglalasAdatok; hibak: string[] } {
  const adatok = {
    nap: szoveg(adat.nap),
    ora: szoveg(adat.ora),
    nev: szoveg(adat.nev),
    telefon: szoveg(adat.telefon),
    email: szoveg(adat.email),
    telepules: szoveg(adat.telepules),
    uzenet: szoveg(adat.uzenet),
  };
  const hibak: string[] = [];
  if (!adatok.nev || adatok.nev.length > 100 || !egysoros(adatok.nev)) hibak.push('nev');
  if (!/^\+?[\d\s()/-]{6,25}$/.test(adatok.telefon)) hibak.push('telefon');
  if (adatok.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adatok.email)) hibak.push('email');
  if (adatok.telepules.length > 100 || !egysoros(adatok.telepules)) hibak.push('telepules');
  if (adatok.uzenet.length > 2000) hibak.push('uzenet');
  if (adat.adatkezeles !== 'elfogadva') hibak.push('adatkezeles');
  return { adatok, hibak };
}
